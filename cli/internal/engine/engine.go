package engine

import (
	"context"
	"sync"
	"time"

	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/metric"
	"github.com/zltl/sguala/cli/internal/sshx"
	"golang.org/x/crypto/ssh"
)

// UpdateFunc is called whenever a host snapshot is refreshed.
type UpdateFunc func(metric.Snapshot)

type Engine struct {
	mu      sync.RWMutex
	cfg     config.Config
	snaps   map[string]metric.Snapshot
	onUpdate UpdateFunc
}

func New(cfg config.Config, onUpdate UpdateFunc) *Engine {
	e := &Engine{
		cfg:      cfg,
		snaps:    make(map[string]metric.Snapshot),
		onUpdate: onUpdate,
	}
	for _, h := range cfg.Hosts {
		e.snaps[h.Name] = metric.Snapshot{
			Host:   h.Name,
			Group:  h.Group,
			Online: false,
		}
	}
	return e
}

func (e *Engine) SetOnUpdate(fn UpdateFunc) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.onUpdate = fn
}

func (e *Engine) Config() config.Config {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.cfg
}

func (e *Engine) SetConfig(cfg config.Config) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cfg = cfg
	next := make(map[string]metric.Snapshot, len(cfg.Hosts))
	for _, h := range cfg.Hosts {
		if s, ok := e.snaps[h.Name]; ok {
			s.Group = h.Group
			next[h.Name] = s
		} else {
			next[h.Name] = metric.Snapshot{Host: h.Name, Group: h.Group}
		}
	}
	e.snaps = next
}

func (e *Engine) Snapshots() []metric.Snapshot {
	e.mu.RLock()
	defer e.mu.RUnlock()
	out := make([]metric.Snapshot, 0, len(e.snaps))
	// Stable order: follow config host order
	for _, h := range e.cfg.Hosts {
		if s, ok := e.snaps[h.Name]; ok {
			out = append(out, s)
		}
	}
	return out
}

func (e *Engine) Snapshot(name string) (metric.Snapshot, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	s, ok := e.snaps[name]
	return s, ok
}

func (e *Engine) store(s metric.Snapshot) {
	e.mu.Lock()
	e.snaps[s.Host] = s
	e.mu.Unlock()
	if e.onUpdate != nil {
		e.onUpdate(s)
	}
}

// RunOnce collects all hosts concurrently.
func (e *Engine) RunOnce(ctx context.Context) {
	cfg := e.Config()
	workers := cfg.Workers
	if workers <= 0 {
		workers = 8
	}

	type job struct {
		host config.Host
	}
	jobs := make(chan job)
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobs {
				select {
				case <-ctx.Done():
					return
				default:
				}
				s := e.collectHost(cfg, j.host)
				e.store(s)
			}
		}()
	}

	go func() {
		for _, h := range cfg.Hosts {
			select {
			case <-ctx.Done():
				close(jobs)
				return
			case jobs <- job{host: h}:
			}
		}
		close(jobs)
	}()

	wg.Wait()
}

func (e *Engine) collectHost(cfg config.Config, host config.Host) metric.Snapshot {
	var jump *ssh.Client
	if host.ProxyJump != "" {
		jc, err := e.dialJump(cfg, host.ProxyJump)
		if err != nil {
			return metric.Offline(host.Name, host.Group, err)
		}
		jump = jc
		defer jump.Close()
	}
	return metric.Collect(cfg, host, jump)
}

func (e *Engine) dialJump(cfg config.Config, jump string) (*ssh.Client, error) {
	// If jump matches a configured host name, use that host's credentials.
	if h, ok := cfg.HostByName(jump); ok {
		return sshx.Dial(sshx.DialOptions{
			Addr:     h.Addr,
			User:     h.User,
			Identity: h.Identity,
			Timeout:  cfg.Timeout.Dur(),
		})
	}
	// Otherwise parse user@host:port
	user, addr := parseJump(jump)
	if user == "" {
		user = "root"
	}
	return sshx.Dial(sshx.DialOptions{
		Addr:    addr,
		User:    user,
		Timeout: cfg.Timeout.Dur(),
	})
}

func parseJump(s string) (user, addr string) {
	// user@host:port or host:port or host
	user = ""
	addr = s
	if at := indexByte(s, '@'); at >= 0 {
		user = s[:at]
		addr = s[at+1:]
	}
	if !configHasPort(addr) {
		addr = addr + ":22"
	}
	return user, addr
}

func indexByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

func configHasPort(addr string) bool {
	if addr == "" {
		return false
	}
	if addr[0] == '[' {
		return len(addr) > 2 && addr[len(addr)-1] != ']'
	}
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return true
		}
	}
	return false
}

// Loop refreshes until ctx is cancelled.
func (e *Engine) Loop(ctx context.Context) {
	e.RunOnce(ctx)
	for {
		cfg := e.Config()
		timer := time.NewTimer(cfg.Refresh.Dur())
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
			e.RunOnce(ctx)
		}
	}
}
