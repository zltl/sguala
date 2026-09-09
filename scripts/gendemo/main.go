// Command gendemo renders sample TUI frames for README assets.
//
//	go run ./scripts/gendemo
package main

import (
	"encoding/json"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/muesli/termenv"
	"github.com/zltl/sguala/internal/config"
	"github.com/zltl/sguala/internal/engine"
	"github.com/zltl/sguala/internal/metric"
	"github.com/zltl/sguala/internal/ui"
)

const (
	termW = 100
	termH = 22
)

var ansiRE = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

func main() {
	// Force colors even when stdout is not a TTY (CI / redirected generators).
	lipgloss.SetColorProfile(termenv.ANSI256)

	root, err := repoRoot()
	if err != nil {
		fail(err)
	}
	doc := filepath.Join(root, "doc")
	if err := os.MkdirAll(doc, 0o755); err != nil {
		fail(err)
	}

	frames := buildFrames()
	plain := make([]string, len(frames))
	for i, f := range frames {
		plain[i] = stripANSI(f)
	}

	still := plain[0]
	if err := os.WriteFile(filepath.Join(doc, "tui.txt"), []byte(still+"\n"), 0o644); err != nil {
		fail(err)
	}

	if err := writeCast(filepath.Join(doc, "tui.cast"), frames); err != nil {
		fail(err)
	}
	if err := writeSVG(filepath.Join(doc, "tui.svg"), plain); err != nil {
		fail(err)
	}
	if err := writePlayScript(filepath.Join(root, "scripts", "play-tui-demo.sh"), plain); err != nil {
		fail(err)
	}

	fmt.Printf("wrote doc/tui.txt doc/tui.cast doc/tui.svg scripts/play-tui-demo.sh (%d frames)\n", len(frames))
}

func repoRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := wd
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod not found from %s", wd)
		}
		dir = parent
	}
}

func fail(err error) {
	fmt.Fprintf(os.Stderr, "gendemo: %v\n", err)
	os.Exit(1)
}

func stripANSI(s string) string {
	return ansiRE.ReplaceAllString(s, "")
}

func sampleConfig() config.Config {
	cfg := config.Default()
	cfg.Hosts = []config.Host{
		{Name: "web-01", Group: "production", Addr: "10.0.0.11:22", User: "deploy"},
		{Name: "web-02", Group: "production", Addr: "10.0.0.12:22", User: "deploy"},
		{Name: "db-01", Group: "production", Addr: "10.0.0.21:22", User: "ops"},
		{Name: "bastion", Group: "edge", Addr: "bastion.example:22", User: "jump"},
		{Name: "ci-runner", Group: "edge", Addr: "ci.example:22", User: "ci"},
		{Name: "old-box", Group: "lab", Addr: "192.168.9.9:22", User: "lab"},
	}
	return cfg
}

func baseSnaps() []metric.Snapshot {
	now := time.Now()
	return []metric.Snapshot{
		online("web-01", "production", 12.4, 43.2, 61.0, 0.42, 48*time.Millisecond, now),
		online("web-02", "production", 8.1, 38.0, 55.5, 0.31, 52*time.Millisecond, now),
		online("db-01", "production", 64.7, 78.5, 82.0, 2.10, 61*time.Millisecond, now),
		online("bastion", "edge", 3.2, 22.0, 41.0, 0.05, 28*time.Millisecond, now),
		online("ci-runner", "edge", 41.0, 55.0, 70.0, 1.20, 90*time.Millisecond, now),
		{
			Host: "old-box", Group: "lab", Online: false, Error: "dial tcp: i/o timeout", FetchedAt: now,
		},
	}
}

func online(host, group string, cpu, memPct, diskPct, load1 float64, lat time.Duration, at time.Time) metric.Snapshot {
	memTotal := uint64(16 << 30)
	memUsed := uint64(float64(memTotal) * memPct / 100)
	diskTotal := uint64(100 << 30)
	diskUsed := uint64(float64(diskTotal) * diskPct / 100)
	return metric.Snapshot{
		Host:      host,
		Group:     group,
		Online:    true,
		CPU:       cpu,
		MemTotal:  memTotal,
		MemAvail:  memTotal - memUsed,
		Disks:     []metric.Disk{{Name: "/", Total: diskTotal, Avail: diskTotal - diskUsed}},
		Load1:     load1,
		Load5:     load1 * 0.9,
		Load15:    load1 * 0.8,
		Latency:   lat,
		FetchedAt: at,
	}
}

func newModel(cfg config.Config, snaps []metric.Snapshot) ui.Model {
	eng := engine.New(cfg, nil)
	for _, s := range snaps {
		eng.PutSnapshot(s)
	}
	m := ui.New(eng, "")
	tm, _ := m.Update(tea.WindowSizeMsg{Width: termW, Height: termH})
	return tm.(ui.Model)
}

func buildFrames() []string {
	cfg := sampleConfig()
	snaps := baseSnaps()
	var out []string

	// Frame 0: overview, cursor on first host
	m := newModel(cfg, snaps)
	out = append(out, m.View())

	// Frame 1: move cursor down a few rows via key msgs
	for i := 0; i < 2; i++ {
		tm, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = tm.(ui.Model)
	}
	out = append(out, m.View())

	// Frame 2: metrics tick (CPU/mem drift)
	snaps2 := baseSnaps()
	snaps2[0].CPU = 18.9
	snaps2[2].CPU = 71.2
	snaps2[2].Load1 = 2.45
	m = newModel(cfg, snaps2)
	for i := 0; i < 2; i++ {
		tm, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
		m = tm.(ui.Model)
	}
	out = append(out, m.View())

	// Frame 3: search filter
	m = newModel(cfg, snaps)
	tm, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'/'}})
	m = tm.(ui.Model)
	for _, r := range "web" {
		tm, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{r}})
		m = tm.(ui.Model)
	}
	out = append(out, m.View())

	// Frame 4: detail view
	m = newModel(cfg, snaps)
	tm, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m = tm.(ui.Model)
	out = append(out, m.View())

	// Frame 5: transfer menu
	m = newModel(cfg, snaps)
	tm, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'t'}})
	m = tm.(ui.Model)
	out = append(out, m.View())

	return out
}

func writeCast(path string, frames []string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	header := map[string]any{
		"version":   2,
		"width":     termW,
		"height":    termH,
		"timestamp": time.Now().Unix(),
		"env":       map[string]string{"TERM": "xterm-256color", "SHELL": "/bin/sh"},
		"title":     "sguala",
	}
	hb, _ := json.Marshal(header)
	if _, err := fmt.Fprintln(f, string(hb)); err != nil {
		return err
	}

	t := 0.0
	clear := "\u001b[2J\u001b[H"
	for i, frame := range frames {
		payload, _ := json.Marshal([]any{round1(t), "o", clear + frame})
		if _, err := fmt.Fprintln(f, string(payload)); err != nil {
			return err
		}
		if i < len(frames)-1 {
			t += 1.2
		}
	}
	return nil
}

func round1(v float64) float64 {
	return float64(int(v*10+0.5)) / 10
}

func writeSVG(path string, frames []string) error {
	const fontSize = 13
	const lineH = 16
	const pad = 16
	width := termW*8 + pad*2
	height := termH*lineH + pad*2

	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`+"\n", width, height, width, height)
	b.WriteString(`  <rect width="100%" height="100%" rx="8" fill="#0d1117"/>` + "\n")
	b.WriteString(`  <style>
    .frame { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; fill: #c9d1d9; white-space: pre; }
    .frame { opacity: 0; animation: cycle 7.2s infinite; }
`)
	n := len(frames)
	step := 100.0 / float64(n)
	show := step * 0.85
	for i := 0; i < n; i++ {
		start := float64(i) * step
		mid := start + show
		end := float64(i+1) * step
		fmt.Fprintf(&b, "    .f%d { animation-delay: -%.2fs; }\n", i, float64(n)*1.2-float64(i)*1.2)
		_ = mid
		_ = end
		_ = start
	}
	b.WriteString(`    @keyframes cycle {
      0%, 14% { opacity: 1; }
      16%, 100% { opacity: 0; }
    }
  </style>` + "\n")

	// Simpler approach: each frame visible for ~1/n of the cycle with delay
	b.Reset()
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">`+"\n", width, height, width, height)
	b.WriteString(`  <rect width="100%" height="100%" rx="8" fill="#0d1117"/>` + "\n")
	dur := float64(n) * 1.2
	fmt.Fprintf(&b, `  <style>
    .frame {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: %dpx;
      fill: #c9d1d9;
      white-space: pre;
      opacity: 0;
      animation: blink %.1fs infinite;
    }
`, fontSize, dur)
	for i := 0; i < n; i++ {
		fmt.Fprintf(&b, "    .f%d { animation-delay: %.1fs; }\n", i, float64(i)*1.2)
	}
	pctOn := 100.0 / float64(n) * 0.9
	fmt.Fprintf(&b, `    @keyframes blink {
      0%%, %.2f%% { opacity: 1; }
      %.2f%%, 100%% { opacity: 0; }
    }
  </style>`+"\n", pctOn, pctOn+0.01)

	for i, frame := range frames {
		fmt.Fprintf(&b, `  <text class="frame f%d" x="%d" y="%d">`+"\n", i, pad, pad+fontSize)
		lines := strings.Split(strings.TrimRight(frame, "\n"), "\n")
		for li, line := range lines {
			if li == 0 {
				fmt.Fprintf(&b, "%s", xmlTspan(line, 0))
			} else {
				fmt.Fprintf(&b, "\n    %s", xmlTspan(line, lineH))
			}
		}
		b.WriteString("\n  </text>\n")
	}
	b.WriteString("</svg>\n")
	return os.WriteFile(path, []byte(b.String()), 0o644)
}

func xmlTspan(line string, dy int) string {
	esc := html.EscapeString(line)
	if dy == 0 {
		return esc
	}
	return fmt.Sprintf(`<tspan x="%d" dy="%d">%s</tspan>`, 16, dy, esc)
}

func writePlayScript(path string, frames []string) error {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString("# Replay ASCII TUI demo frames in the terminal.\n")
	b.WriteString("set -euo pipefail\n")
	b.WriteString("clear_screen() { printf '\\033[2J\\033[H'; }\n")
	b.WriteString("frames=(\n")
	for _, f := range frames {
		b.WriteString("$'")
		escaped := strings.ReplaceAll(f, `\`, `\\`)
		escaped = strings.ReplaceAll(escaped, "'", `\'`)
		escaped = strings.ReplaceAll(escaped, "\n", `\n`)
		b.WriteString(escaped)
		b.WriteString("'\n")
	}
	b.WriteString(")\n")
	b.WriteString("for f in \"${frames[@]}\"; do\n")
	b.WriteString("  clear_screen\n")
	b.WriteString("  printf '%s\\n' \"$f\"\n")
	b.WriteString("  sleep 1.2\n")
	b.WriteString("done\n")
	b.WriteString("printf '\\n(demo done — run: asciinema play doc/tui.cast)\\n'\n")
	return os.WriteFile(path, []byte(b.String()), 0o755)
}
