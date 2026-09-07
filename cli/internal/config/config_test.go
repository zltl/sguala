package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	content := `
refresh: 5s
timeout: 3s
workers: 4
hosts:
  - name: a
    group: g
    addr: 1.2.3.4
    user: deploy
    identity: ~/.ssh/id_ed25519
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Refresh.Dur() != 5*time.Second {
		t.Fatalf("refresh=%v", cfg.Refresh.Dur())
	}
	if len(cfg.Hosts) != 1 {
		t.Fatalf("hosts=%d", len(cfg.Hosts))
	}
	if cfg.Hosts[0].Addr != "1.2.3.4:22" {
		t.Fatalf("addr=%s", cfg.Hosts[0].Addr)
	}
}

func TestDuplicateHost(t *testing.T) {
	cfg := Default()
	cfg.Hosts = []Host{
		{Name: "a", Addr: "h:22"},
		{Name: "a", Addr: "h2:22"},
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected duplicate error")
	}
}
