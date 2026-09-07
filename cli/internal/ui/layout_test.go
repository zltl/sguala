package ui

import (
	"testing"

	"github.com/mattn/go-runewidth"
	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/metric"
)

func TestOverviewColWidthsFitsContent(t *testing.T) {
	m := Model{width: 120}
	cfg := config.Config{
		Hosts: []config.Host{
			{Name: "roompad-US-OLD", Addr: "10.18.50.20:3333", User: "weride"},
		},
	}
	m.rows = []metric.Snapshot{{Host: "roompad-US-OLD"}}
	hostW, addrW := m.overviewColWidths(cfg)
	wantHost := runewidth.StringWidth("roompad-US-OLD")
	wantAddr := runewidth.StringWidth("weride@10.18.50.20:3333")
	if hostW < wantHost {
		t.Fatalf("hostW=%d want >= %d", hostW, wantHost)
	}
	if addrW < wantAddr {
		t.Fatalf("addrW=%d want >= %d", addrW, wantAddr)
	}
}

func TestPadRightAndTrunc(t *testing.T) {
	if got := padRight("ab", 4); got != "ab  " {
		t.Fatalf("padRight=%q", got)
	}
	got := trunc("abcdef", 4)
	if runewidth.StringWidth(got) > 4 {
		t.Fatalf("trunc too wide: %q width=%d", got, runewidth.StringWidth(got))
	}
}
