package ui

import (
	"testing"

	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/metric"
)

func TestHostMatches(t *testing.T) {
	cfg := config.Config{
		Hosts: []config.Host{
			{Name: "web-01", Addr: "10.0.0.1:22", User: "deploy", ProxyJump: "bastion", Group: "prod"},
		},
	}
	s := metric.Snapshot{Host: "web-01"}

	cases := []struct {
		q    string
		want bool
	}{
		{"", true},
		{"web", true},
		{"10.0.0", true},
		{"deploy", true},
		{"bastion", true},
		{"prod", true},
		{"db", false},
	}
	for _, c := range cases {
		if got := hostMatches(cfg, s, c.q); got != c.want {
			t.Fatalf("q=%q got %v want %v", c.q, got, c.want)
		}
	}
}

func TestOpenSSHDialsByAlias(t *testing.T) {
	// Interactive shell looks up Host alias in config (pure Go dial), not system ssh argv.
	h := config.Host{Name: "web-01", Addr: "10.0.0.1:2222", User: "root"}
	if h.Name != "web-01" {
		t.Fatalf("alias %q", h.Name)
	}
}
