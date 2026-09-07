package ui

import (
	"testing"

	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/metric"
)

func TestHostMatches(t *testing.T) {
	cfg := config.Config{
		Hosts: []config.Host{
			{Name: "web-01", Group: "prod", Addr: "10.0.0.1:22", User: "deploy", Tags: []string{"edge"}},
		},
	}
	s := metric.Snapshot{Host: "web-01", Group: "prod"}

	cases := []struct {
		q    string
		want bool
	}{
		{"", true},
		{"web", true},
		{"PROD", true},
		{"10.0.0", true},
		{"deploy", true},
		{"edge", true},
		{"db", false},
	}
	for _, c := range cases {
		if got := hostMatches(cfg, s, c.q); got != c.want {
			t.Fatalf("q=%q got %v want %v", c.q, got, c.want)
		}
	}
}
