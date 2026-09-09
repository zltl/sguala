package sshx

import (
	"net"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/ssh"
)

type fakeAddr string

func (f fakeAddr) Network() string { return "tcp" }
func (f fakeAddr) String() string  { return string(f) }

func TestHostKeyCallbackAcceptNew(t *testing.T) {
	dir := t.TempDir()
	home := dir
	t.Setenv("HOME", home)
	sshDir := filepath.Join(home, ".ssh")
	if err := os.MkdirAll(sshDir, 0o700); err != nil {
		t.Fatal(err)
	}
	khPath := filepath.Join(sshDir, "known_hosts")
	if err := os.WriteFile(khPath, nil, 0o600); err != nil {
		t.Fatal(err)
	}

	// Generate a host key to present
	priv, err := loadOrMakeTestHostKey(t, dir)
	if err != nil {
		t.Fatal(err)
	}
	pub := priv.PublicKey()

	cb := hostKeyCallback()
	hostname := "10.1.2.3:22"
	remote := fakeAddr("10.1.2.3:22")

	if err := cb(hostname, remote, pub); err != nil {
		t.Fatalf("accept-new should allow unknown host: %v", err)
	}

	data, err := os.ReadFile(khPath)
	if err != nil {
		t.Fatal(err)
	}
	if len(data) == 0 {
		t.Fatal("expected known_hosts to be appended")
	}

	// Second connect with same key should succeed via known_hosts
	cb2 := hostKeyCallback()
	if err := cb2(hostname, remote, pub); err != nil {
		t.Fatalf("known host should verify: %v", err)
	}

	// Mismatch should fail
	priv2, err := loadOrMakeTestHostKey(t, filepath.Join(dir, "other"))
	if err != nil {
		t.Fatal(err)
	}
	err = cb2(hostname, remote, priv2.PublicKey())
	if err == nil {
		t.Fatal("expected mismatch error")
	}
}

func TestHostKeyCallbackAcceptsLookupErrors(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("HOME", dir)
	_ = os.MkdirAll(filepath.Join(dir, ".ssh"), 0o700)
	_ = os.WriteFile(filepath.Join(dir, ".ssh", "known_hosts"), nil, 0o600)

	priv, err := loadOrMakeTestHostKey(t, dir)
	if err != nil {
		t.Fatal(err)
	}
	cb := hostKeyCallback()
	// Bare hostname without port used to surface knownhosts SplitHostPort errors.
	if err := cb("10.1.2.3", fakeAddr("10.1.2.3:22"), priv.PublicKey()); err != nil {
		t.Fatalf("should auto-accept despite lookup quirk: %v", err)
	}
}

func loadOrMakeTestHostKey(t *testing.T, dir string) (ssh.Signer, error) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	path := writeTempKey(t, dir, "host_key")
	return loadSigner(path)
}

var _ net.Addr = fakeAddr("")
