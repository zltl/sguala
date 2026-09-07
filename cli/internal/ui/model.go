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
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/mattn/go-runewidth"
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
	Search  key.Binding
	Sort    key.Binding
	SSH     key.Binding
	Edit    key.Binding
	Help    key.Binding
	Quit    key.Binding
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Enter, k.Search, k.SSH, k.Help, k.Quit}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Enter, k.Back},
		{k.Refresh, k.Search, k.Sort, k.SSH},
		{k.Edit, k.Help, k.Quit},
	}
}

var keys = keyMap{
	Up:      key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("k/↑", "up")),
	Down:    key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("j/↓", "down")),
	Enter:   key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "detail")),
	Back:    key.NewBinding(key.WithKeys("esc", "h"), key.WithHelp("esc", "back")),
	Refresh: key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "refresh")),
	Search:  key.NewBinding(key.WithKeys("/"), key.WithHelp("/", "search")),
	Sort:    key.NewBinding(key.WithKeys("s"), key.WithHelp("s", "sort")),
	SSH:     key.NewBinding(key.WithKeys("o"), key.WithHelp("o", "open ssh")),
	Edit:    key.NewBinding(key.WithKeys("e"), key.WithHelp("e", "edit ssh config")),
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
	engine       *engine.Engine
	settingsPath string
	help         help.Model
	keys         keyMap
	search       textinput.Model

	width  int
	height int

	cursor    int
	mode      viewMode
	showHelp  bool
	sort      sortMode
	searching bool
	query     string

	rows []metric.Snapshot // filtered+sorted view
	err  string
}

func New(eng *engine.Engine, settingsPath string) Model {
	h := help.New()
	h.ShowAll = false
	ti := textinput.New()
	ti.Placeholder = "search host / user / addr…"
	ti.CharLimit = 64
	ti.Width = 40
	ti.Prompt = "/ "
	return Model{
		engine:       eng,
		settingsPath: settingsPath,
		help:         h,
		keys:         keys,
		search:       ti,
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
		if m.searching {
			switch msg.String() {
			case "esc", "ctrl+c":
				m.searching = false
				m.search.Blur()
				m.search.SetValue("")
				m.query = ""
				m.cursor = 0
				m.rebuildRows()
				return m, nil
			case "enter":
				m.searching = false
				m.search.Blur()
				m.query = strings.TrimSpace(m.search.Value())
				m.cursor = 0
				m.rebuildRows()
				return m, nil
			}
			var cmd tea.Cmd
			m.search, cmd = m.search.Update(msg)
			m.query = m.search.Value()
			m.cursor = 0
			m.rebuildRows()
			return m, cmd
		}

		switch {
		case key.Matches(msg, m.keys.Quit):
			return m, tea.Quit
		case key.Matches(msg, m.keys.Help):
			m.showHelp = !m.showHelp
			m.help.ShowAll = m.showHelp
			return m, nil
		case key.Matches(msg, m.keys.Refresh):
			return m, m.doRefresh()
		case key.Matches(msg, m.keys.Search):
			if m.mode == viewDetail {
				m.mode = viewOverview
			}
			m.searching = true
			m.search.SetValue(m.query)
			m.search.Focus()
			return m, textinput.Blink
		case key.Matches(msg, m.keys.Sort):
			m.sort = (m.sort + 1) % 5
			m.rebuildRows()
			return m, nil
		case key.Matches(msg, m.keys.Edit):
			return m, m.openEditor()
		case key.Matches(msg, m.keys.Back):
			if m.query != "" {
				m.query = ""
				m.search.SetValue("")
				m.cursor = 0
				m.rebuildRows()
				return m, nil
			}
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

func hostMatches(cfg config.Config, s metric.Snapshot, q string) bool {
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return true
	}
	hay := strings.ToLower(s.Host + " " + s.Group)
	if h, ok := cfg.HostByName(s.Host); ok {
		hay += " " + strings.ToLower(h.Addr+" "+h.User+" "+h.Name+" "+h.ProxyJump)
	}
	return strings.Contains(hay, q)
}

func (m *Model) rebuildRows() {
	cfg := m.engine.Config()
	all := m.engine.Snapshots()
	rows := make([]metric.Snapshot, 0, len(all))
	for _, s := range all {
		if !hostMatches(cfg, s, m.query) {
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
	// Delegate to system ssh so ~/.ssh/config (ProxyJump, IdentityFile, etc.) applies.
	c := exec.Command("ssh", hostName)
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	return tea.ExecProcess(c, func(err error) tea.Msg {
		if err != nil {
			return snapMsg{}
		}
		return refreshDoneMsg{}
	})
}

func (m Model) openEditor() tea.Cmd {
	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = "vi"
	}
	cfg := m.engine.Config()
	sshPath, err := cfg.ResolvedSSHConfig()
	if err != nil {
		return nil
	}
	c := exec.Command(editor, sshPath)
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	eng := m.engine
	return tea.ExecProcess(c, func(err error) tea.Msg {
		next := eng.Config()
		if e := config.AttachSSHHosts(&next); e == nil {
			eng.SetConfig(next)
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
	fmt.Fprintf(&b, "%s  %d/%d online  refresh %s  sort:%s",
		titleStyle.Render("sguala"),
		online, len(cfg.Hosts),
		cfg.Refresh.Dur(),
		m.sort.String(),
	)
	if m.query != "" || m.searching {
		fmt.Fprintf(&b, "  %s", mutedStyle.Render(fmt.Sprintf("filter:%q %d hits", strings.TrimSpace(m.query), len(m.rows))))
	}
	b.WriteByte('\n')
	if m.searching {
		b.WriteString(m.search.View())
		b.WriteByte('\n')
	}
	b.WriteString(mutedStyle.Render(strings.Repeat("─", max(10, m.width-1))))
	b.WriteByte('\n')

	if m.mode == viewDetail && len(m.rows) > 0 {
		b.WriteString(m.viewDetail(m.rows[m.cursor]))
	} else {
		b.WriteString(m.viewOverview())
	}

	b.WriteByte('\n')
	if m.searching {
		b.WriteString(helpStyle.Render("enter confirm · esc clear"))
	} else {
		b.WriteString(helpStyle.Render(m.help.View(m.keys)))
	}
	return b.String()
}

func (m Model) viewOverview() string {
	var b strings.Builder
	cfg := m.engine.Config()
	hostW, addrW := m.overviewColWidths(cfg)

	header := padRight("HOST", hostW) + " " + padRight("ADDR", addrW) +
		fmt.Sprintf(" %-2s %6s %14s %14s %6s %6s", "ST", "CPU", "MEM", "DISK", "LOAD", "LAT")
	b.WriteString(headerStyle.Render(header))
	b.WriteByte('\n')

	if len(m.rows) == 0 {
		if strings.TrimSpace(m.query) != "" {
			b.WriteString(mutedStyle.Render("  (no matches)"))
		} else {
			b.WriteString(mutedStyle.Render("  (no hosts in ~/.ssh/config — press e to edit)"))
		}
		b.WriteByte('\n')
		return b.String()
	}

	for i, s := range m.rows {
		line := formatRow(cfg, s, hostW, addrW)
		if i == m.cursor {
			line = selStyle.Render(line)
		} else if !s.Online {
			line = errStyle.Render(line)
		} else if isHighUsage(s) {
			line = warnStyle.Render(line)
		}
		b.WriteString(line)
		b.WriteByte('\n')
	}
	return b.String()
}

// overviewColWidths sizes HOST/ADDR from terminal width and visible content.
// Metric columns stay fixed; leftover space goes to host/addr (prefer no truncation).
func (m Model) overviewColWidths(cfg config.Config) (hostW, addrW int) {
	// " ST CPU...LAT" fixed tail: space+2+space+6+space+14+space+14+space+6+space+6
	const fixedTail = 1 + 2 + 1 + 6 + 1 + 14 + 1 + 14 + 1 + 6 + 1 + 6
	termW := m.width
	if termW <= 0 {
		termW = 80
	}
	avail := termW - 1 - fixedTail // gap between HOST and ADDR is counted below
	if avail < 24 {
		avail = 24
	}

	maxHost := runewidth.StringWidth("HOST")
	maxAddr := runewidth.StringWidth("ADDR")
	for _, s := range m.rows {
		if w := runewidth.StringWidth(s.Host); w > maxHost {
			maxHost = w
		}
		addr := hostAddr(cfg, s)
		if w := runewidth.StringWidth(addr); w > maxAddr {
			maxAddr = w
		}
	}

	// One space between HOST and ADDR.
	gap := 1
	if maxHost+gap+maxAddr <= avail {
		return maxHost, maxAddr
	}

	// Shrink proportionally, keep readable floors.
	const minHost, minAddr = 10, 14
	hostW = maxHost
	addrW = maxAddr
	budget := avail - gap
	if hostW+addrW > budget {
		// Prefer giving ADDR more room (user@host:port is usually longer).
		hostW = budget * 2 / 5
		addrW = budget - hostW
	}
	if hostW < minHost {
		hostW = minHost
		addrW = budget - hostW
	}
	if addrW < minAddr {
		addrW = minAddr
		hostW = budget - addrW
	}
	if hostW < 6 {
		hostW = 6
		addrW = budget - hostW
	}
	if addrW < 8 {
		addrW = 8
		hostW = max(6, budget-addrW)
	}
	return hostW, addrW
}

func hostAddr(cfg config.Config, s metric.Snapshot) string {
	if h, ok := cfg.HostByName(s.Host); ok {
		return h.User + "@" + h.Addr
	}
	return "—"
}

func isHighUsage(s metric.Snapshot) bool {
	const warnAt = 90.0
	if s.CPU >= warnAt {
		return true
	}
	if s.MemUsedPercent() >= warnAt {
		return true
	}
	if d, ok := s.WorstDisk(); ok && d.UsedPercent() >= warnAt {
		return true
	}
	return false
}

func formatRow(cfg config.Config, s metric.Snapshot, hostW, addrW int) string {
	st := "○"
	if s.Online {
		st = okStyle.Render("●")
	} else {
		st = errStyle.Render("○")
	}
	addr := hostAddr(cfg, s)
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
	return padRight(s.Host, hostW) + " " + padRight(addr, addrW) +
		fmt.Sprintf(" %-2s %6s %14s %14s %6s %6s", st, cpu, trunc(mem, 14), trunc(disk, 14), load, lat)
}

func (m Model) viewDetail(s metric.Snapshot) string {
	var b strings.Builder
	cfg := m.engine.Config()
	title := s.Host
	if h, ok := cfg.HostByName(s.Host); ok {
		title = fmt.Sprintf("%s  %s@%s", s.Host, h.User, h.Addr)
		if h.ProxyJump != "" {
			title += "  via " + h.ProxyJump
		}
	}
	fmt.Fprintf(&b, "%s\n", titleStyle.Render(title))
	if !s.Online {
		fmt.Fprintf(&b, "%s %s\n", errStyle.Render("offline"), s.Error)
		return b.String()
	}
	fmt.Fprintf(&b, "CPU     %s\n", bar(s.CPU))
	fmt.Fprintf(&b, "Memory  %s  %s / %s\n",
		bar(s.MemUsedPercent()),
		metric.HumanBytes(s.MemUsed()), metric.HumanBytes(s.MemTotal))
	fmt.Fprintf(&b, "Load    %.2f %.2f %.2f\n", s.Load1, s.Load5, s.Load15)
	fmt.Fprintf(&b, "Uptime  %s\n", formatUptime(s.UptimeSec))
	fmt.Fprintf(&b, "Latency %s\n", s.Latency.Round(time.Millisecond))
	fmt.Fprintf(&b, "Fetched %s\n", s.FetchedAt.Format(time.RFC3339))
	b.WriteString("\nDisks\n")
	for _, d := range s.Disks {
		fmt.Fprintf(&b, "  %-20s %s  %s / %s\n",
			trunc(d.Name, 20),
			bar(d.UsedPercent()),
			metric.HumanBytes(d.Used()), metric.HumanBytes(d.Total))
	}
	return b.String()
}

func bar(pct float64) string {
	const warnAt = 90.0
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
	case pct >= warnAt:
		return errStyle.Render(label)
	case pct >= warnAt-10:
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
	if n <= 0 {
		return ""
	}
	if runewidth.StringWidth(s) <= n {
		return s
	}
	return runewidth.Truncate(s, n, "…")
}

func padRight(s string, n int) string {
	s = trunc(s, n)
	pad := n - runewidth.StringWidth(s)
	if pad <= 0 {
		return s
	}
	return s + strings.Repeat(" ", pad)
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
