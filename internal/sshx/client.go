package sshx

import (
	"errors"
	"fmt"
	"io"
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

// defaultIdentityNames mirrors OpenSSH's common private key basenames.
var defaultIdentityNames = []string{
	"id_ed25519",
	"id_rsa",
	"id_ecdsa",
	"id_ecdsa_sk",
	"id_ed25519_sk",
	"id_dsa",
}

func loadSigner(path string) (ssh.Signer, error) {
	key, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	signer, err := ssh.ParsePrivateKey(key)
	if err != nil {
		// Passphrase-protected keys need the agent; skip file quietly.
		return nil, err
	}
	return signer, nil
}

func signerFingerprint(s ssh.Signer) string {
	return string(ssh.MarshalAuthorizedKey(s.PublicKey()))
}

// authMethods builds a single publickey AuthMethod (x/crypto/ssh only uses the
// first AuthMethod of each RFC 4252 type). Order matches OpenSSH preference:
// configured identity → ~/.ssh/id_* → ssh-agent.
// The returned closer must stay open until after Dial returns (agent signers
// need the socket during the handshake).
func authMethods(identity, password string) (methods []ssh.AuthMethod, closer io.Closer, err error) {
	var signers []ssh.Signer
	seen := make(map[string]struct{})
	add := func(s ssh.Signer) {
		if s == nil {
			return
		}
		fp := signerFingerprint(s)
		if _, ok := seen[fp]; ok {
			return
		}
		seen[fp] = struct{}{}
		signers = append(signers, s)
	}

	var identityErr error
	if identity != "" {
		path := ExpandHome(identity)
		s, e := loadSigner(path)
		if e != nil {
			identityErr = fmt.Errorf("read identity %s: %w", path, e)
		} else {
			add(s)
		}
	}

	if home, e := os.UserHomeDir(); e == nil {
		sshDir := filepath.Join(home, ".ssh")
		for _, name := range defaultIdentityNames {
			path := filepath.Join(sshDir, name)
			if identity != "" && ExpandHome(identity) == path {
				continue
			}
			if s, e := loadSigner(path); e == nil {
				add(s)
			}
		}
	}

	if sock := os.Getenv("SSH_AUTH_SOCK"); sock != "" {
		if conn, e := net.Dial("unix", sock); e == nil {
			closer = conn
			ag := agent.NewClient(conn)
			if as, e := ag.Signers(); e == nil {
				for _, s := range as {
					add(s)
				}
			}
		}
	}

	if len(signers) > 0 {
		// One PublicKeys method so every signer is actually attempted.
		methods = append(methods, ssh.PublicKeys(signers...))
	}

	if password != "" {
		methods = append(methods, ssh.Password(password))
		pw := password
		methods = append(methods, ssh.KeyboardInteractive(
			func(user, instruction string, questions []string, echos []bool) ([]string, error) {
				answers := make([]string, len(questions))
				for i := range questions {
					answers[i] = pw
				}
				return answers, nil
			},
		))
	}

	if len(methods) == 0 {
		if identityErr != nil {
			return nil, closer, identityErr
		}
		return nil, closer, fmt.Errorf("no auth methods: set identity, place a key in ~/.ssh, start ssh-agent, or set password")
	}
	return methods, closer, nil
}

func hostKeyCallback() ssh.HostKeyCallback {
	home, err := os.UserHomeDir()
	if err != nil {
		return ssh.InsecureIgnoreHostKey() //nolint:gosec
	}
	path := filepath.Join(home, ".ssh", "known_hosts")
	_ = os.MkdirAll(filepath.Dir(path), 0o700)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		_ = os.WriteFile(path, []byte{}, 0o600)
	}

	inner, err := knownhosts.New(path)
	if err != nil {
		// No usable known_hosts — monitoring list still needs to connect.
		return ssh.InsecureIgnoreHostKey() //nolint:gosec
	}

	// Monitoring list: auto-accept hosts (OpenSSH accept-new + tolerate
	// knownhosts address-format quirks). Key *mismatch* still fails.
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		err := inner(hostname, remote, key)
		if err == nil {
			return nil
		}
		var keyErr *knownhosts.KeyError
		if errors.As(err, &keyErr) && len(keyErr.Want) > 0 {
			return fmt.Errorf("host key mismatch for %s: %w", hostname, err)
		}
		// Unknown host, or knownhosts lookup error (e.g. addr without port):
		// accept and best-effort remember the key so later checks succeed.
		_ = appendKnownHost(path, hostname, remote, key)
		return nil
	}
}

func appendKnownHost(path, hostname string, remote net.Addr, key ssh.PublicKey) error {
	if key == nil {
		return nil
	}
	addrs := make([]string, 0, 2)
	if hostname != "" {
		// knownhosts.Line/Normalize want host or host:port / [host]:port
		addrs = append(addrs, hostname)
	}
	if remote != nil {
		if rs := remote.String(); rs != "" && rs != hostname {
			addrs = append(addrs, rs)
		}
	}
	if len(addrs) == 0 {
		return nil
	}
	line := knownhosts.Line(addrs, key)
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintln(f, line)
	return err
}

func Dial(opts DialOptions) (*ssh.Client, error) {
	if opts.Timeout <= 0 {
		opts.Timeout = 5 * time.Second
	}
	auths, closer, err := authMethods(opts.Identity, opts.Password)
	if closer != nil {
		defer closer.Close()
	}
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
