package ui

import (
	"context"
	"fmt"
	"os"
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
	"github.com/zltl/sguala/cli/internal/remote"
	"github.com/zltl/sguala/cli/internal/secret"
	"github.com/zltl/sguala/cli/internal/sshconfig"
	"github.com/zltl/sguala/cli/internal/xfer"
)

type tickMsg time.Time
type refreshDoneMsg struct{}
type snapMsg metric.Snapshot

type keyMap struct {
	Up       key.Binding
	Down     key.Binding
	Enter    key.Binding
	Back     key.Binding
	Refresh  key.Binding
	Search   key.Binding
	Sort     key.Binding
	SSH      key.Binding
	Transfer key.Binding
	Passwd   key.Binding
	Edit     key.Binding
	Help     key.Binding
	Quit     key.Binding
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Enter, k.Search, k.SSH, k.Transfer, k.Passwd, k.Help, k.Quit}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Enter, k.Back},
		{k.Refresh, k.Search, k.Sort, k.SSH, k.Transfer, k.Passwd},
		{k.Edit, k.Help, k.Quit},
	}
}

var keys = keyMap{
	Up:       key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("k/↑", "up")),
	Down:     key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("j/↓", "down")),
	Enter:    key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "detail")),
	Back:     key.NewBinding(key.WithKeys("esc", "h"), key.WithHelp("esc", "back")),
	Refresh:  key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "refresh")),
	Search:   key.NewBinding(key.WithKeys("/"), key.WithHelp("/", "search")),
	Sort:     key.NewBinding(key.WithKeys("s"), key.WithHelp("s", "sort")),
	SSH:      key.NewBinding(key.WithKeys("o"), key.WithHelp("o", "open ssh")),
	Transfer: key.NewBinding(key.WithKeys("t"), key.WithHelp("t", "transfer")),
	Passwd:   key.NewBinding(key.WithKeys("p"), key.WithHelp("p", "set password")),
	Edit:     key.NewBinding(key.WithKeys("e"), key.WithHelp("e", "edit ssh config")),
	Help:     key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
	Quit:     key.NewBinding(key.WithKeys("q", "ctrl+c"), key.WithHelp("q", "quit")),
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
	viewTransfer
	viewPasswd
)

type xferStep int

const (
	xferMenu xferStep = iota
	xferGetRemote
	xferGetLocal
	xferPutLocal
	xferPutRemote
)

var xferMenuItems = []string{"get (download)", "put (upload)", "sftp (interactive)"}

type Model struct {
	engine       *engine.Engine
	settingsPath string
	help         help.Model
	keys         keyMap
	search       textinput.Model
	xferInput    textinput.Model

	width  int
	height int

	cursor    int
	mode      viewMode
	showHelp  bool
	sort      sortMode
	searching bool
	query     string

	xferHost   string
	xferStep   xferStep
	xferCursor int
	xferRemote string
	xferLocals []string

	passwdHost string
	passwdMsg  string

	rows []metric.Snapshot // filtered+sorted view
	err  string
}

func New(eng *engine.Engine, settingsPath string) Model {
	h := help.New()
	h.ShowAll = false
	ti := textinput.New()
	ti.Placeholder = "search host / user / addr / group…"
	ti.CharLimit = 64
	ti.Width = 40
	ti.Prompt = "/ "
	xi := textinput.New()
	xi.CharLimit = 512
	xi.Width = 60
	xi.Prompt = "> "
	return Model{
		engine:       eng,
		settingsPath: settingsPath,
		help:         h,
		keys:         keys,
		search:       ti,
		xferInput:    xi,
	}
}

func (m Model) Init() tea.Cmd {
	setTerminalTitle(defaultTermTitle)
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
		if m.mode == viewTransfer {
			return m.updateTransfer(msg)
		}
		if m.mode == viewPasswd {
			return m.updatePasswd(msg)
		}

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
		case key.Matches(msg, m.keys.Transfer):
			if len(m.rows) == 0 {
				return m, nil
			}
			m.beginTransfer(m.rows[m.cursor].Host)
			return m, textinput.Blink
		case key.Matches(msg, m.keys.Passwd):
			if len(m.rows) == 0 {
				return m, nil
			}
			m.beginPasswd(m.rows[m.cursor].Host)
			return m, textinput.Blink
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

func (m *Model) beginTransfer(host string) {
	m.mode = viewTransfer
	m.xferHost = host
	m.xferStep = xferMenu
	m.xferCursor = 0
	m.xferRemote = ""
	m.xferLocals = nil
	m.err = ""
	m.xferInput.EchoMode = textinput.EchoNormal
	m.xferInput.Blur()
	m.xferInput.SetValue("")
}

func (m *Model) endTransfer() {
	m.mode = viewOverview
	m.xferStep = xferMenu
	m.xferHost = ""
	m.xferRemote = ""
	m.xferLocals = nil
	m.xferInput.Blur()
	m.xferInput.SetValue("")
	m.err = ""
}

func (m Model) updateTransfer(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch m.xferStep {
	case xferMenu:
		switch {
		case key.Matches(msg, m.keys.Back), msg.String() == "q":
			m.endTransfer()
			return m, nil
		case key.Matches(msg, m.keys.Up):
			if m.xferCursor > 0 {
				m.xferCursor--
			}
			return m, nil
		case key.Matches(msg, m.keys.Down):
			if m.xferCursor < len(xferMenuItems)-1 {
				m.xferCursor++
			}
			return m, nil
		case key.Matches(msg, m.keys.Enter):
			switch m.xferCursor {
			case 0: // get
				m.xferStep = xferGetRemote
				m.xferInput.Placeholder = "remote path (e.g. /var/log/app.log)"
				m.xferInput.SetValue("")
				m.xferInput.Focus()
				return m, textinput.Blink
			case 1: // put
				m.xferStep = xferPutLocal
				m.xferInput.Placeholder = "local path(s), space-separated"
				m.xferInput.SetValue("")
				m.xferInput.Focus()
				return m, textinput.Blink
			case 2: // sftp
				host := m.xferHost
				m.endTransfer()
				return m, m.runRemote(m.titleForHost("sftp", host), func(cfg config.Config) error {
					client, cleanup, err := remote.DialByName(cfg, host)
					if err != nil {
						return err
					}
					defer cleanup()
					return remote.InteractiveSFTP(client)
				})
			}
		}
		return m, nil
	default:
		switch msg.String() {
		case "esc":
			m.xferStep = xferMenu
			m.xferInput.Blur()
			m.xferInput.SetValue("")
			m.err = ""
			return m, nil
		case "enter":
			return m.submitXferPrompt()
		}
		var cmd tea.Cmd
		m.xferInput, cmd = m.xferInput.Update(msg)
		return m, cmd
	}
}

func (m Model) submitXferPrompt() (tea.Model, tea.Cmd) {
	val := strings.TrimSpace(m.xferInput.Value())
	switch m.xferStep {
	case xferGetRemote:
		if val == "" {
			m.err = "remote path required"
			return m, nil
		}
		m.xferRemote = val
		m.err = ""
		m.xferStep = xferGetLocal
		m.xferInput.Placeholder = "local path [.]"
		m.xferInput.SetValue(".")
		m.xferInput.Focus()
		return m, textinput.Blink
	case xferGetLocal:
		if val == "" {
			val = "."
		}
		host, remotePath, local := m.xferHost, m.xferRemote, val
		m.endTransfer()
		return m, m.runRemote(m.titleForHost("get", host), func(cfg config.Config) error {
			client, cleanup, err := remote.DialByName(cfg, host)
			if err != nil {
				return err
			}
			defer cleanup()
			return remote.Get(client, remotePath, local)
		})
	case xferPutLocal:
		locals := xfer.SplitLocalPaths(val)
		if len(locals) == 0 {
			m.err = "local path required"
			return m, nil
		}
		m.xferLocals = locals
		m.err = ""
		m.xferStep = xferPutRemote
		m.xferInput.Placeholder = "remote directory [.]"
		m.xferInput.SetValue(".")
		m.xferInput.Focus()
		return m, textinput.Blink
	case xferPutRemote:
		if val == "" {
			val = "."
		}
		host, locals, remoteDir := m.xferHost, m.xferLocals, val
		m.endTransfer()
		return m, m.runRemote(m.titleForHost("put", host), func(cfg config.Config) error {
			client, cleanup, err := remote.DialByName(cfg, host)
			if err != nil {
				return err
			}
			defer cleanup()
			return remote.Put(client, locals, remoteDir)
		})
	default:
		return m, nil
	}
}

func (m Model) runRemote(title string, fn func(config.Config) error) tea.Cmd {
	cfg := m.engine.Config()
	return runWithTitle(title, func() error {
		return fn(cfg)
	}, func(err error) tea.Msg {
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
		}
		return refreshDoneMsg{}
	})
}

func (m *Model) beginPasswd(host string) {
	m.mode = viewPasswd
	m.passwdHost = host
	m.passwdMsg = ""
	m.err = ""
	m.xferInput.EchoMode = textinput.EchoPassword
	m.xferInput.EchoCharacter = '•'
	m.xferInput.Placeholder = "password (empty = delete stored)"
	m.xferInput.SetValue("")
	m.xferInput.Focus()
	if secret.Has(host) {
		m.passwdMsg = "stored password present — enter new value or leave empty to delete"
	} else {
		kr, file := secret.Status()
		if kr {
			m.passwdMsg = "will prefer OS keyring; fallback file: " + file
		} else {
			m.passwdMsg = "no OS keyring — storing in " + file + " (mode 0600)"
		}
	}
}

func (m *Model) endPasswd() {
	m.mode = viewOverview
	m.passwdHost = ""
	m.passwdMsg = ""
	m.xferInput.EchoMode = textinput.EchoNormal
	m.xferInput.Blur()
	m.xferInput.SetValue("")
	m.err = ""
}

func (m Model) updatePasswd(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.endPasswd()
		return m, nil
	case "enter":
		pw := m.xferInput.Value() // do not TrimSpace — passwords may have spaces (rare)
		host := m.passwdHost
		var backend secret.Backend
		var err error
		if pw == "" {
			backend, err = secret.Delete(host)
		} else {
			backend, err = secret.Set(host, pw)
		}
		m.endPasswd()
		if err != nil {
			m.err = err.Error()
			return m, nil
		}
		if pw == "" {
			m.err = fmt.Sprintf("password cleared (%s)", backend)
		} else {
			m.err = fmt.Sprintf("password saved via %s", backend)
		}
		return m, m.doRefresh()
	}
	var cmd tea.Cmd
	m.xferInput, cmd = m.xferInput.Update(msg)
	return m, cmd
}

func hostMatches(cfg config.Config, s metric.Snapshot, q string) bool {
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return true
	}
	hay := strings.ToLower(s.Host + " " + hostGroup(cfg, s))
	if h, ok := cfg.HostByName(s.Host); ok {
		hay += " " + strings.ToLower(h.Addr+" "+h.User+" "+h.Name+" "+h.Group+" "+h.ProxyJump)
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

func (m Model) titleForHost(action, alias string) string {
	cfg := m.engine.Config()
	group := ""
	if h, ok := cfg.HostByName(alias); ok {
		group = h.Group
	}
	for _, s := range m.rows {
		if s.Host == alias && s.Group != "" {
			group = s.Group
			break
		}
	}
	return hostActionTitle(action, group, alias)
}

func (m Model) openSSH(hostName string) tea.Cmd {
	cfg := m.engine.Config()
	return runWithTitle(m.titleForHost("ssh", hostName), func() error {
		client, cleanup, err := remote.DialByName(cfg, hostName)
		if err != nil {
			return err
		}
		defer cleanup()
		return remote.Shell(client)
	}, func(err error) tea.Msg {
		if err != nil {
			fmt.Fprintf(os.Stderr, "ssh: %v\n", err)
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
	file := sshPath
	line := 0
	alias := ""
	if len(m.rows) > 0 {
		alias = m.rows[m.cursor].Host
		if loc, ok := sshconfig.FindHostLocation(sshPath, alias); ok {
			file = loc.Path
			line = loc.Line
		}
	}
	c := sshconfig.EditorCommand(editor, file, line)
	c.Stdin = os.Stdin
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	title := "edit ssh config"
	if alias != "" {
		title = m.titleForHost("edit", alias)
	}
	eng := m.engine
	return execWithTitle(title, c, func(err error) tea.Msg {
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
	if m.err != "" && m.mode != viewPasswd && m.mode != viewTransfer {
		fmt.Fprintf(&b, "\n%s", mutedStyle.Render(m.err))
	}
	b.WriteByte('\n')
	if m.searching {
		b.WriteString(m.search.View())
		b.WriteByte('\n')
	}
	b.WriteString(mutedStyle.Render(strings.Repeat("─", max(10, m.width-1))))
	b.WriteByte('\n')

	if m.mode == viewTransfer {
		b.WriteString(m.viewTransfer())
	} else if m.mode == viewPasswd {
		b.WriteString(m.viewPasswd())
	} else if m.mode == viewDetail && len(m.rows) > 0 {
		b.WriteString(m.viewDetail(m.rows[m.cursor]))
	} else {
		b.WriteString(m.viewOverview())
	}

	b.WriteByte('\n')
	if m.searching {
		b.WriteString(helpStyle.Render("enter confirm · esc clear"))
	} else if m.mode == viewTransfer || m.mode == viewPasswd {
		b.WriteString(helpStyle.Render("enter confirm · esc back"))
	} else {
		b.WriteString(helpStyle.Render(m.help.View(m.keys)))
	}
	return b.String()
}

func (m Model) viewPasswd() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s  host %s\n\n", titleStyle.Render("password"), m.passwdHost)
	if m.passwdMsg != "" {
		b.WriteString(mutedStyle.Render(m.passwdMsg))
		b.WriteByte('\n')
	}
	b.WriteString(m.xferInput.View())
	b.WriteByte('\n')
	return b.String()
}

func (m Model) viewTransfer() string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s  host %s\n\n", titleStyle.Render("transfer"), m.xferHost)
	if m.err != "" {
		b.WriteString(errStyle.Render(m.err))
		b.WriteByte('\n')
	}
	switch m.xferStep {
	case xferMenu:
		b.WriteString(mutedStyle.Render("choose action:"))
		b.WriteByte('\n')
		for i, item := range xferMenuItems {
			line := "  " + item
			if i == m.xferCursor {
				line = selStyle.Render("> " + item)
			}
			b.WriteString(line)
			b.WriteByte('\n')
		}
	case xferGetRemote:
		b.WriteString("Download (SFTP get)\n")
		b.WriteString(mutedStyle.Render("remote path:"))
		b.WriteByte('\n')
		b.WriteString(m.xferInput.View())
		b.WriteByte('\n')
	case xferGetLocal:
		fmt.Fprintf(&b, "Download remote %s\n", m.xferRemote)
		b.WriteString(mutedStyle.Render("local destination:"))
		b.WriteByte('\n')
		b.WriteString(m.xferInput.View())
		b.WriteByte('\n')
	case xferPutLocal:
		b.WriteString("Upload (SFTP put)\n")
		b.WriteString(mutedStyle.Render("local path(s):"))
		b.WriteByte('\n')
		b.WriteString(m.xferInput.View())
		b.WriteByte('\n')
	case xferPutRemote:
		fmt.Fprintf(&b, "Upload %s\n", strings.Join(m.xferLocals, " "))
		b.WriteString(mutedStyle.Render("remote directory:"))
		b.WriteByte('\n')
		b.WriteString(m.xferInput.View())
		b.WriteByte('\n')
	}
	return b.String()
}

func (m Model) viewOverview() string {
	var b strings.Builder
	cfg := m.engine.Config()
	groupW, hostW, addrW := m.overviewColWidths(cfg)

	header := padRight("GROUP", groupW) + " " + padRight("HOST", hostW) + " " + padRight("ADDR", addrW) +
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
		if m.sort == sortConfig {
			g := hostGroup(cfg, s)
			prev := ""
			if i > 0 {
				prev = hostGroup(cfg, m.rows[i-1])
			}
			if g != "" && g != prev {
				label := "── " + g + " "
				pad := max(0, m.width-1-runewidth.StringWidth(label))
				b.WriteString(mutedStyle.Render(label + strings.Repeat("─", pad)))
				b.WriteByte('\n')
			}
		}
		line := formatRow(cfg, s, groupW, hostW, addrW)
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

// overviewColWidths sizes GROUP/HOST/ADDR from terminal width and visible content.
// Metric columns stay fixed; leftover space goes to the three text columns.
func (m Model) overviewColWidths(cfg config.Config) (groupW, hostW, addrW int) {
	// " ST CPU...LAT" fixed tail: space+2+space+6+space+14+space+14+space+6+space+6
	const fixedTail = 1 + 2 + 1 + 6 + 1 + 14 + 1 + 14 + 1 + 6 + 1 + 6
	termW := m.width
	if termW <= 0 {
		termW = 80
	}
	avail := termW - 1 - fixedTail // gaps between GROUP/HOST/ADDR counted below
	if avail < 30 {
		avail = 30
	}

	maxGroup := runewidth.StringWidth("GROUP")
	maxHost := runewidth.StringWidth("HOST")
	maxAddr := runewidth.StringWidth("ADDR")
	for _, s := range m.rows {
		g := hostGroup(cfg, s)
		if g == "" {
			g = "—"
		}
		if w := runewidth.StringWidth(g); w > maxGroup {
			maxGroup = w
		}
		if w := runewidth.StringWidth(s.Host); w > maxHost {
			maxHost = w
		}
		addr := hostAddr(cfg, s)
		if w := runewidth.StringWidth(addr); w > maxAddr {
			maxAddr = w
		}
	}

	const gaps = 2 // spaces between the three text columns
	if maxGroup+gaps+maxHost+maxAddr <= avail {
		return maxGroup, maxHost, maxAddr
	}

	const minGroup, minHost, minAddr = 6, 8, 12
	groupW, hostW, addrW = maxGroup, maxHost, maxAddr
	budget := avail - gaps
	if groupW+hostW+addrW > budget {
		// Prefer ADDR, then HOST, then GROUP.
		groupW = budget * 1 / 5
		hostW = budget * 2 / 5
		addrW = budget - groupW - hostW
	}
	if groupW < minGroup {
		groupW = minGroup
	}
	if hostW < minHost {
		hostW = minHost
	}
	if addrW < minAddr {
		addrW = minAddr
	}
	if groupW+hostW+addrW > budget {
		overflow := groupW + hostW + addrW - budget
		cut := min(overflow, max(0, addrW-minAddr))
		addrW -= cut
		overflow -= cut
		cut = min(overflow, max(0, hostW-minHost))
		hostW -= cut
		overflow -= cut
		groupW = max(minGroup, groupW-overflow)
		hostW = max(minHost, hostW)
		addrW = max(minAddr, budget-groupW-hostW)
	}
	return groupW, hostW, addrW
}

func hostGroup(cfg config.Config, s metric.Snapshot) string {
	if s.Group != "" {
		return s.Group
	}
	if h, ok := cfg.HostByName(s.Host); ok {
		return h.Group
	}
	return ""
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

func formatRow(cfg config.Config, s metric.Snapshot, groupW, hostW, addrW int) string {
	st := "○"
	if s.Online {
		st = okStyle.Render("●")
	} else {
		st = errStyle.Render("○")
	}
	group := hostGroup(cfg, s)
	if group == "" {
		group = "—"
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
	return padRight(group, groupW) + " " + padRight(s.Host, hostW) + " " + padRight(addr, addrW) +
		fmt.Sprintf(" %-2s %6s %14s %14s %6s %6s", st, cpu, trunc(mem, 14), trunc(disk, 14), load, lat)
}

func (m Model) viewDetail(s metric.Snapshot) string {
	var b strings.Builder
	cfg := m.engine.Config()
	title := s.Host
	if g := hostGroup(cfg, s); g != "" {
		title = g + " · " + s.Host
	}
	if h, ok := cfg.HostByName(s.Host); ok {
		title = fmt.Sprintf("%s  %s@%s", title, h.User, h.Addr)
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
