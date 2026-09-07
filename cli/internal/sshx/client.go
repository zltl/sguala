package sshx

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
	"golang.org/x/crypto/ssh/knownhosts"
)

type DialOptions struct {
	Addr     string
	User     string
	Identity string // optional path
	Password string // optional
	Timeout  time.Duration
	// Jump is an optional bastion connection already established;
	// if set, dial target through jump with DirectTCPIP.
	Jump *ssh.Client
}

func ExpandHome(p string) string {
	if p == "" {
		return p
	}
	if strings.HasPrefix(p, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return p
		}
		return filepath.Join(home, p[2:])
	}
	return p
}

func authMethods(identity, password string) ([]ssh.AuthMethod, error) {
	var methods []ssh.AuthMethod

	if sock := os.Getenv("SSH_AUTH_SOCK"); sock != "" {
		if conn, err := net.Dial("unix", sock); err == nil {
			ag := agent.NewClient(conn)
			methods = append(methods, ssh.PublicKeysCallback(ag.Signers))
		}
	}

	if identity != "" {
		path := ExpandHome(identity)
		key, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read identity %s: %w", path, err)
		}
		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("parse identity %s: %w", path, err)
		}
		methods = append(methods, ssh.PublicKeys(signer))
	}

	if password != "" {
		methods = append(methods, ssh.Password(password))
	}

	if len(methods) == 0 {
		return nil, fmt.Errorf("no auth methods: set identity, SSH_AUTH_SOCK, or password")
	}
	return methods, nil
}

func hostKeyCallback() ssh.HostKeyCallback {
	home, err := os.UserHomeDir()
	if err != nil {
		return ssh.InsecureIgnoreHostKey() //nolint:gosec
	}
	path := filepath.Join(home, ".ssh", "known_hosts")
	cb, err := knownhosts.New(path)
	if err != nil {
		// Missing known_hosts is common on fresh boxes; fall back insecurely
		// but prefer known_hosts when present.
		return ssh.InsecureIgnoreHostKey() //nolint:gosec
	}
	return cb
}

func Dial(opts DialOptions) (*ssh.Client, error) {
	if opts.Timeout <= 0 {
		opts.Timeout = 5 * time.Second
	}
	auths, err := authMethods(opts.Identity, opts.Password)
	if err != nil {
		return nil, err
	}
	cfg := &ssh.ClientConfig{
		User:            opts.User,
		Auth:            auths,
		HostKeyCallback: hostKeyCallback(),
		Timeout:         opts.Timeout,
	}

	if opts.Jump != nil {
		conn, err := opts.Jump.Dial("tcp", opts.Addr)
		if err != nil {
			return nil, fmt.Errorf("jump dial %s: %w", opts.Addr, err)
		}
		c, chans, reqs, err := ssh.NewClientConn(conn, opts.Addr, cfg)
		if err != nil {
			_ = conn.Close()
			return nil, err
		}
		return ssh.NewClient(c, chans, reqs), nil
	}

	return ssh.Dial("tcp", opts.Addr, cfg)
}

func Run(client *ssh.Client, cmd string, timeout time.Duration) (string, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	type result struct {
		out []byte
		err error
	}
	ch := make(chan result, 1)
	go func() {
		out, err := session.CombinedOutput(cmd)
		ch <- result{out, err}
	}()

	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case r := <-ch:
		return string(r.out), r.err
	case <-timer.C:
		_ = session.Close()
		return "", fmt.Errorf("command timeout after %s", timeout)
	}
}
