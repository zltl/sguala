package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadSettings(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	content := `
refresh: 5s
timeout: 3s
workers: 4
hosts:
  - name: legacy
    addr: 1.2.3.4
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := LoadSettings(path)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Refresh.Dur() != 5*time.Second {
		t.Fatalf("refresh=%v", cfg.Refresh.Dur())
	}
	if len(cfg.Hosts) != 0 {
		t.Fatalf("legacy hosts should be ignored, got %d", len(cfg.Hosts))
	}
}

func TestAttachSSHHosts(t *testing.T) {
	dir := t.TempDir()
	sshPath := filepath.Join(dir, "config")
	content := `
Host bastion
  HostName 10.0.0.1
  User jump
  Port 22

Host web
  HostName 10.0.0.2
  User deploy
  Port 2222
  IdentityFile /tmp/id
  ProxyJump bastion
`
	if err := os.WriteFile(sshPath, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := Default()
	cfg.SSHConfig = sshPath
	if err := AttachSSHHosts(&cfg); err != nil {
		t.Fatal(err)
	}
	if len(cfg.Hosts) != 2 {
		t.Fatalf("hosts=%d", len(cfg.Hosts))
	}
	h, ok := cfg.HostByName("web")
	if !ok {
		t.Fatal("missing web")
	}
	if h.Addr != "10.0.0.2:2222" || h.User != "deploy" || h.ProxyJump != "bastion" {
		t.Fatalf("web=%+v", h)
	}
}
