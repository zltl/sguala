package remote

import (
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/zltl/sguala/internal/config"
	"github.com/zltl/sguala/internal/secret"
	"github.com/zltl/sguala/internal/sshx"
	"golang.org/x/crypto/ssh"
	"golang.org/x/term"
)

// Dial connects to a configured host (Identity / agent / password + ProxyJump).
// Call cleanup when done (closes target and jump).
func Dial(cfg config.Config, host config.Host) (*ssh.Client, func(), error) {
	var jump *ssh.Client
	cleanup := func() {
		if jump != nil {
			_ = jump.Close()
		}
	}
	if host.ProxyJump != "" {
		jc, err := dialJump(cfg, host.ProxyJump)
		if err != nil {
			return nil, nil, err
		}
		jump = jc
	}
	pw, _, _ := secret.Get(host.Name)
	client, err := sshx.Dial(sshx.DialOptions{
		Addr:     host.Addr,
		User:     host.User,
		Identity: host.Identity,
		Password: pw,
		Timeout:  cfg.Timeout.Dur(),
		Jump:     jump,
	})
	if err != nil {
		cleanup()
		return nil, nil, err
	}
	return client, func() {
		_ = client.Close()
		cleanup()
	}, nil
}

// DialByName looks up host alias in cfg and dials.
func DialByName(cfg config.Config, name string) (*ssh.Client, func(), error) {
	h, ok := cfg.HostByName(name)
	if !ok {
		return nil, nil, fmt.Errorf("unknown host %q (not in SSH config)", name)
	}
	return Dial(cfg, h)
}

func dialJump(cfg config.Config, jump string) (*ssh.Client, error) {
	if h, ok := cfg.HostByName(jump); ok {
		pw, _, _ := secret.Get(h.Name)
		return sshx.Dial(sshx.DialOptions{
			Addr:     h.Addr,
			User:     h.User,
			Identity: h.Identity,
			Password: pw,
			Timeout:  cfg.Timeout.Dur(),
		})
	}
	user, addr := parseJump(jump)
	if user == "" {
		user = "root"
	}
	pw, _, _ := secret.Get(jump)
	return sshx.Dial(sshx.DialOptions{
		Addr:     addr,
		User:     user,
		Password: pw,
		Timeout:  cfg.Timeout.Dur(),
	})
}

func parseJump(s string) (user, addr string) {
	addr = s
	if at := strings.IndexByte(s, '@'); at >= 0 {
		user = s[:at]
		addr = s[at+1:]
	}
	if !hasPort(addr) {
		addr += ":22"
	}
	return user, addr
}

func hasPort(addr string) bool {
	if addr == "" {
		return false
	}
	if addr[0] == '[' {
		return strings.Contains(addr, "]:")
	}
	return strings.Contains(addr, ":")
}

// Shell runs an interactive login shell on client (raw local TTY + remote PTY).
func Shell(client *ssh.Client) error {
	session, err := client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return fmt.Errorf("stdin is not a terminal")
	}
	oldState, err := term.MakeRaw(fd)
	if err != nil {
		return err
	}
	defer func() { _ = term.Restore(fd, oldState) }()

	w, h, err := term.GetSize(fd)
	if err != nil || w <= 0 || h <= 0 {
		w, h = 80, 24
	}
	termName := os.Getenv("TERM")
	if termName == "" {
		termName = "xterm-256color"
	}
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty(termName, h, w, modes); err != nil {
		return fmt.Errorf("request pty: %w", err)
	}

	// Strip remote OSC 0/1/2 (window/icon title) so Host alias / group titles stick.
	outFilter := &oscTitleFilter{w: os.Stdout}
	session.Stdout = outFilter
	session.Stderr = outFilter
	stdin, err := session.StdinPipe()
	if err != nil {
		return err
	}
	go func() {
		_, _ = io.Copy(stdin, os.Stdin)
		_ = stdin.Close()
	}()

	if err := session.Shell(); err != nil {
		return err
	}

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGWINCH)
	go func() {
		for range ch {
			if ww, hh, e := term.GetSize(fd); e == nil && ww > 0 && hh > 0 {
				_ = session.WindowChange(hh, ww)
			}
		}
	}()
	defer signal.Stop(ch)

	return session.Wait()
}

// oscTitleFilter drops OSC 0/1/2 (set window/icon title). Other OSC pass through.
type oscTitleFilter struct {
	w     io.Writer
	state int
	buf   []byte // bytes held while deciding (ESC ] …)
}

const (
	oscNorm = iota
	oscEsc
	oscBody // after ESC ], collecting until BEL or ST
)

func (f *oscTitleFilter) Write(p []byte) (int, error) {
	var out []byte
	flushHeld := func() {
		if len(f.buf) > 0 {
			out = append(out, f.buf...)
			f.buf = f.buf[:0]
		}
	}
	for _, b := range p {
		switch f.state {
		case oscNorm:
			if b == 0x1b {
				f.state = oscEsc
				f.buf = append(f.buf[:0], b)
			} else {
				out = append(out, b)
			}
		case oscEsc:
			f.buf = append(f.buf, b)
			if b == ']' {
				f.state = oscBody
			} else {
				flushHeld()
				f.state = oscNorm
			}
		case oscBody:
			f.buf = append(f.buf, b)
			ended := false
			st := false
			if b == 0x07 {
				ended = true
			} else if b == '\\' && len(f.buf) >= 2 && f.buf[len(f.buf)-2] == 0x1b {
				ended = true
				st = true
			}
			if !ended {
				// safety: abort hold if OSC grows huge (malformed)
				if len(f.buf) > 4096 {
					flushHeld()
					f.state = oscNorm
				}
				continue
			}
			payload := f.buf
			// ESC ] … BEL  or  ESC ] … ESC \
			end := len(payload) - 1
			if st {
				end = len(payload) - 2
			}
			body := payload[2:end] // after ESC ]
			drop := isTitleOSC(body)
			if !drop {
				out = append(out, payload...)
			}
			f.buf = f.buf[:0]
			f.state = oscNorm
		}
	}
	if len(out) > 0 {
		if _, err := f.w.Write(out); err != nil {
			return 0, err
		}
	}
	return len(p), nil
}

func isTitleOSC(body []byte) bool {
	// Ps is 0, 1, or 2 optionally followed by ;Pt
	if len(body) == 0 {
		return false
	}
	ps := body[0]
	if ps != '0' && ps != '1' && ps != '2' {
		return false
	}
	if len(body) == 1 {
		return true
	}
	return body[1] == ';'
}
