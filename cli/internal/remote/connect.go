package remote

import (
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/secret"
	"github.com/zltl/sguala/cli/internal/sshx"
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

	session.Stdout = os.Stdout
	session.Stderr = os.Stderr
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
