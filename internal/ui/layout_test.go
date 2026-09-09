package ui

import (
	"testing"

	"github.com/mattn/go-runewidth"
	"github.com/zltl/sguala/internal/config"
	"github.com/zltl/sguala/internal/metric"
)

func TestOverviewColWidthsFitsContent(t *testing.T) {
	m := Model{width: 140}
	cfg := config.Config{
		Hosts: []config.Host{
			{Name: "roompad-US-OLD", Addr: "10.18.50.20:3333", User: "weride", Group: "production"},
		},
	}
	m.rows = []metric.Snapshot{{Host: "roompad-US-OLD", Group: "production"}}
	groupW, hostW, addrW := m.overviewColWidths(cfg)
	wantGroup := runewidth.StringWidth("production")
	wantHost := runewidth.StringWidth("roompad-US-OLD")
	wantAddr := runewidth.StringWidth("weride@10.18.50.20:3333")
	if groupW < wantGroup {
		t.Fatalf("groupW=%d want >= %d", groupW, wantGroup)
	}
	if hostW < wantHost {
		t.Fatalf("hostW=%d want >= %d", hostW, wantHost)
	}
	if addrW < wantAddr {
		t.Fatalf("addrW=%d want >= %d", addrW, wantAddr)
	}
}

func TestHostGroupFallsBackToConfig(t *testing.T) {
	cfg := config.Config{
		Hosts: []config.Host{{Name: "web", Group: "edge"}},
	}
	s := metric.Snapshot{Host: "web"}
	if got := hostGroup(cfg, s); got != "edge" {
		t.Fatalf("got %q", got)
	}
}

func TestClampListOffset(t *testing.T) {
	// Fits entirely.
	if got := clampListOffset(0, 3, 5, 10); got != 0 {
		t.Fatalf("fit: got %d", got)
	}
	// Scroll down to keep cursor visible.
	if got := clampListOffset(0, 15, 30, 10); got != 6 {
		t.Fatalf("down: got %d want 6", got)
	}
	// Keep offset when cursor stays inside window.
	if got := clampListOffset(10, 15, 30, 10); got != 10 {
		t.Fatalf("inside: got %d want 10", got)
	}
	// Scroll up.
	if got := clampListOffset(10, 5, 30, 10); got != 5 {
		t.Fatalf("up: got %d want 5", got)
	}
	// Clamp to max.
	if got := clampListOffset(100, 29, 30, 10); got != 20 {
		t.Fatalf("max: got %d want 20", got)
	}
}
