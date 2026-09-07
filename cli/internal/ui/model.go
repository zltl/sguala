package ui

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/engine"
	"github.com/zltl/sguala/cli/internal/metric"
)

type tickMsg time.Time
type refreshDoneMsg struct{}
type snapMsg metric.Snapshot

type keyMap struct {
	Up      key.Binding
	Down    key.Binding
	Enter   key.Binding
	Back    key.Binding
	Refresh key.Binding
	Filter  key.Binding
	Sort    key.Binding
	SSH     key.Binding
	Edit    key.Binding
	Help    key.Binding
	Quit    key.Binding
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Enter, k.SSH, k.Filter, k.Help, k.Quit}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Enter, k.Back},
		{k.Refresh, k.Filter, k.Sort, k.SSH},
		{k.Edit, k.Help, k.Quit},
	}
}

var keys = keyMap{
	Up:      key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("k/↑", "up")),
	Down:    key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("j/↓", "down")),
	Enter:   key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "detail")),
	Back:    key.NewBinding(key.WithKeys("esc", "h"), key.WithHelp("esc", "back")),
	Refresh: key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "refresh")),
	Filter:  key.NewBinding(key.WithKeys("f"), key.WithHelp("f", "alerts only")),
	Sort:    key.NewBinding(key.WithKeys("s"), key.WithHelp("s", "sort")),
	SSH:     key.NewBinding(key.WithKeys("o"), key.WithHelp("o", "open ssh")),
	Edit:    key.NewBinding(key.WithKeys("e"), key.WithHelp("e", "edit config")),
	Help:    key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
	Quit:    key.NewBinding(key.WithKeys("q", "ctrl+c"), key.WithHelp("q", "quit")),
}

type sortMode int

const (
	sortConfig sortMode = iota
	sortCPU
	sortMem
	sortDisk
	sortLatency
)

func (s sortMode) String() string {
	switch s {
	case sortCPU:
		return "cpu"
	case sortMem:
		return "mem"
	case sortDisk:
		return "disk"
	case sortLatency:
		return "lat"
	default:
		return "config"
	}
}

type viewMode int

const (
	viewOverview viewMode = iota
	viewDetail
)

type Model struct {
	engine     *engine.Engine
	configPath string
	help       help.Model
	keys       keyMap

	width  int
	height int

	cursor   int
	mode     viewMode
	showHelp bool
	alertsOnly bool
	sort     sortMode

	rows []metric.Snapshot // filtered+sorted view
	err  string
}

func New(eng *engine.Engine, configPath string) Model {
	h := help.New()
	h.ShowAll = false
	return Model{
		engine:     eng,
		configPath: configPath,
		help:       h,
		keys:       keys,
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(tick(), m.doRefresh())
}

func tick() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

func (m Model) doRefresh() tea.Cmd {
	eng := m.engine
	return func() tea.Msg {
		eng.RunOnce(context.Background())
		return refreshDoneMsg{}
	}
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.help.Width = msg.Width
		m.rebuildRows()
		return m, nil

	case tickMsg:
		m.rebuildRows()
		return m, tick()

	case snapMsg:
		m.rebuildRows()
		return m, nil

	case refreshDoneMsg:
		m.rebuildRows()
		return m, nil

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.Quit):
			return m, tea.Quit
		case key.Matches(msg, m.keys.Help):
			m.showHelp = !m.showHelp
			m.help.ShowAll = m.showHelp
			return m, nil
		case key.Matches(msg, m.keys.Refresh):
			return m, m.doRefresh()
		case key.Matches(msg, m.keys.Filter):
			m.alertsOnly = !m.alertsOnly
			m.cursor = 0
			m.rebuildRows()
			return m, nil
		case key.Matches(msg, m.keys.Sort):
			m.sort = (m.sort + 1) % 5
			m.rebuildRows()
			return m, nil
		case key.Matches(msg, m.keys.Edit):
			return m, m.openEditor()
		case key.Matches(msg, m.keys.Back):
			if m.mode == viewDetail {
				m.mode = viewOverview
			}
			return m, nil
		case key.Matches(msg, m.keys.Enter):
			if m.mode == viewOverview && len(m.rows) > 0 {
				m.mode = viewDetail
			}
			return m, nil
		case key.Matches(msg, m.keys.Up):
			if m.cursor > 0 {
				m.cursor--
			}
			return m, nil
		case key.Matches(msg, m.keys.Down):
			if m.cursor < len(m.rows)-1 {
				m.cursor++
			}
			return m, nil
		case key.Matches(msg, m.keys.SSH):
			if len(m.rows) == 0 {
				return m, nil
			}
			return m, m.openSSH(m.rows[m.cursor].Host)
		}
	}
	return m, nil
}

func (m *Model) rebuildRows() {
	cfg := m.engine.Config()
	all := m.engine.Snapshots()
	rows := make([]metric.Snapshot, 0, len(all))
	for _, s := range all {
		if m.alertsOnly && !isAlert(cfg, s) {
			continue
		}
		rows = append(rows, s)
	}
	sortSnapshots(rows, m.sort)
	m.rows = rows
	if m.cursor >= len(m.rows) && len(m.rows) > 0 {
		m.cursor = len(m.rows) - 1
	}
	if len(m.rows) == 0 {
		m.cursor = 0
	}
}

func isAlert(cfg config.Config, s metric.Snapshot) bool {
	if !s.Online {
		return true
	}
	if s.CPU >= cfg.CPUAlert {
		return true
	}
	if s.MemUsedPercent() >= cfg.MemAlert {
		return true
	}
	if d, ok := s.WorstDisk(); ok && d.UsedPercent() >= cfg.DiskAlert {
		return true
	}
	return false
}

func sortSnapshots(rows []metric.Snapshot, mode sortMode) {
	switch mode {
	case sortCPU:
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].CPU > rows[j].CPU })
	case sortMem:
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].MemUsedPercent() > rows[j].MemUsedPercent() })
	case sortDisk:
		sort.SliceStable(rows, func(i, j int) bool {
			di, _ := rows[i].WorstDisk()
			dj, _ := rows[j].WorstDisk()
			return di.UsedPercent() > dj.UsedPercent()
		})
	case sortLatency:
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].Latency > rows[j].Latency })
	default:
		// config order already
	}
}

func (m Model) openSSH(hostName string) tea.Cmd {
	cfg := m.engine.Config()
	h, ok := cfg.HostByName(hostName)
	if !ok {
		return nil
	}
	args := buildSSHArgs(cfg, h)
	c := exec.Command("ssh", args...)
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	return tea.ExecProcess(c, func(err error) tea.Msg {
		if err != nil {
			return snapMsg{} // ignore; user returns to TUI
		}
		return refreshDoneMsg{}
	})
}

func buildSSHArgs(cfg config.Config, h config.Host) []string {
	var args []string
	if h.Identity != "" {
		args = append(args, "-i", sshExpand(h.Identity))
	}
	if h.ProxyJump != "" {
		if j, ok := cfg.HostByName(h.ProxyJump); ok {
			jump := fmt.Sprintf("%s@%s", j.User, stripDefaultPort(j.Addr))
			if j.Identity != "" {
				args = append(args, "-o", "ProxyCommand=ssh -i "+sshExpand(j.Identity)+" -W %h:%p "+jump)
			} else {
				args = append(args, "-J", jump)
			}
		} else {
			args = append(args, "-J", h.ProxyJump)
		}
	}
	target := h.User + "@" + stripDefaultPort(h.Addr)
	args = append(args, target)
	return args
}

func stripDefaultPort(addr string) string {
	if strings.HasSuffix(addr, ":22") {
		return strings.TrimSuffix(addr, ":22")
	}
	return addr
}

func sshExpand(p string) string {
	if strings.HasPrefix(p, "~/") {
		home, err := os.UserHomeDir()
		if err == nil {
			return home + p[1:]
		}
	}
	return p
}

func (m Model) openEditor() tea.Cmd {
	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = "vi"
	}
	c := exec.Command(editor, m.configPath)
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	path := m.configPath
	eng := m.engine
	return tea.ExecProcess(c, func(err error) tea.Msg {
		if cfg, e := config.Load(path); e == nil {
			eng.SetConfig(cfg)
		}
		return refreshDoneMsg{}
	})
}

var (
	titleStyle   = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("39"))
	headerStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("244")).Bold(true)
	selStyle     = lipgloss.NewStyle().Background(lipgloss.Color("236")).Bold(true)
	okStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
	warnStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("214"))
	errStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("196"))
	mutedStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("245"))
	helpStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
)

func (m Model) View() string {
	if m.width == 0 {
		return "loading…"
	}
	cfg := m.engine.Config()
	var b strings.Builder

	online := 0
	for _, s := range m.engine.Snapshots() {
		if s.Online {
			online++
		}
	}
	filter := "all"
	if m.alertsOnly {
		filter = "alerts"
	}
	fmt.Fprintf(&b, "%s  %d/%d online  refresh %s  sort:%s  filter:%s\n",
		titleStyle.Render("sguala"),
		online, len(cfg.Hosts),
		cfg.Refresh.Dur(),
		m.sort.String(),
		filter,
	)
	b.WriteString(mutedStyle.Render(strings.Repeat("─", max(10, m.width-1))))
	b.WriteByte('\n')

	if m.mode == viewDetail && len(m.rows) > 0 {
		b.WriteString(m.viewDetail(cfg, m.rows[m.cursor]))
	} else {
		b.WriteString(m.viewOverview(cfg))
	}

	b.WriteByte('\n')
	b.WriteString(helpStyle.Render(m.help.View(m.keys)))
	return b.String()
}

func (m Model) viewOverview(cfg config.Config) string {
	var b strings.Builder
	header := fmt.Sprintf("%-10s %-14s %-2s %6s %14s %14s %6s %6s",
		"GROUP", "HOST", "ST", "CPU", "MEM", "DISK", "LOAD", "LAT")
	b.WriteString(headerStyle.Render(header))
	b.WriteByte('\n')

	if len(m.rows) == 0 {
		b.WriteString(mutedStyle.Render("  (no hosts — edit config with e)"))
		b.WriteByte('\n')
		return b.String()
	}

	for i, s := range m.rows {
		line := formatRow(cfg, s)
		if i == m.cursor {
			line = selStyle.Render(line)
		} else if isAlert(cfg, s) {
			line = warnStyle.Render(line)
		} else if !s.Online {
			line = errStyle.Render(line)
		}
		b.WriteString(line)
		b.WriteByte('\n')
	}
	return b.String()
}

func formatRow(cfg config.Config, s metric.Snapshot) string {
	st := "○"
	if s.Online {
		st = okStyle.Render("●")
	} else {
		st = errStyle.Render("○")
	}
	cpu := "—"
	mem := "—"
	disk := "—"
	load := "—"
	lat := "—"
	if s.Online {
		cpu = fmt.Sprintf("%5.1f%%", s.CPU)
		mem = fmt.Sprintf("%4.0f%% %s", s.MemUsedPercent(), metric.HumanBytes(s.MemTotal))
		if d, ok := s.WorstDisk(); ok {
			disk = fmt.Sprintf("%4.0f%% %s", d.UsedPercent(), shortName(d.Name))
		}
		load = fmt.Sprintf("%5.2f", s.Load1)
		lat = fmt.Sprintf("%4dms", s.Latency.Milliseconds())
	}
	return fmt.Sprintf("%-10s %-14s %-2s %6s %14s %14s %6s %6s",
		trunc(s.Group, 10), trunc(s.Host, 14), st, cpu, trunc(mem, 14), trunc(disk, 14), load, lat)
}

func (m Model) viewDetail(cfg config.Config, s metric.Snapshot) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s / %s\n", s.Group, titleStyle.Render(s.Host))
	if !s.Online {
		fmt.Fprintf(&b, "%s %s\n", errStyle.Render("offline"), s.Error)
		return b.String()
	}
	fmt.Fprintf(&b, "CPU     %s\n", bar(s.CPU, cfg.CPUAlert))
	fmt.Fprintf(&b, "Memory  %s  %s / %s\n",
		bar(s.MemUsedPercent(), cfg.MemAlert),
		metric.HumanBytes(s.MemUsed()), metric.HumanBytes(s.MemTotal))
	fmt.Fprintf(&b, "Load    %.2f %.2f %.2f\n", s.Load1, s.Load5, s.Load15)
	fmt.Fprintf(&b, "Uptime  %s\n", formatUptime(s.UptimeSec))
	fmt.Fprintf(&b, "Latency %s\n", s.Latency.Round(time.Millisecond))
	fmt.Fprintf(&b, "Fetched %s\n", s.FetchedAt.Format(time.RFC3339))
	b.WriteString("\nDisks\n")
	for _, d := range s.Disks {
		fmt.Fprintf(&b, "  %-20s %s  %s / %s\n",
			trunc(d.Name, 20),
			bar(d.UsedPercent(), cfg.DiskAlert),
			metric.HumanBytes(d.Used()), metric.HumanBytes(d.Total))
	}
	return b.String()
}

func bar(pct, alert float64) string {
	width := 20
	filled := int(pct / 100 * float64(width))
	if filled > width {
		filled = width
	}
	if filled < 0 {
		filled = 0
	}
	body := strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
	label := fmt.Sprintf("%5.1f%% %s", pct, body)
	switch {
	case pct >= alert:
		return errStyle.Render(label)
	case pct >= alert-10:
		return warnStyle.Render(label)
	default:
		return okStyle.Render(label)
	}
}

func formatUptime(sec float64) string {
	d := time.Duration(sec) * time.Second
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	mins := int(d.Minutes()) % 60
	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, mins)
	}
	return fmt.Sprintf("%dh %dm", hours, mins)
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	if n <= 1 {
		return s[:n]
	}
	return s[:n-1] + "…"
}

func shortName(s string) string {
	if i := strings.LastIndex(s, "/"); i >= 0 && i+1 < len(s) {
		return s[i+1:]
	}
	return s
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Program constructs the Bubble Tea program with optional snapshot callback wiring.
func Program(eng *engine.Engine, configPath string) *tea.Program {
	m := New(eng, configPath)
	p := tea.NewProgram(m, tea.WithAltScreen())
	eng.SetOnUpdate(func(s metric.Snapshot) {
		p.Send(snapMsg(s))
	})
	return p
}
