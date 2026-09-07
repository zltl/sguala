package ui

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

const defaultTermTitle = "sguala"

// setTerminalTitle uses OSC 0 (icon + window title). Harmless on terminals that ignore it.
func setTerminalTitle(title string) {
	title = sanitizeTermTitle(title)
	if title == "" {
		title = defaultTermTitle
	}
	// BEL-terminated OSC is widely supported (xterm, tmux, Windows Terminal, etc.).
	_, _ = fmt.Fprintf(os.Stdout, "\033]0;%s\007", title)
}

func sanitizeTermTitle(title string) string {
	title = strings.Map(func(r rune) rune {
		switch r {
		case '\x1b', '\a', '\n', '\r', '\x00':
			return -1
		default:
			return r
		}
	}, title)
	title = strings.TrimSpace(title)
	if len(title) > 120 {
		title = title[:120]
	}
	return title
}

// titledCmd runs an *exec.Cmd after setting the terminal title (post TUI release).
type titledCmd struct {
	cmd   *exec.Cmd
	title string
}

func (t *titledCmd) Run() error {
	setTerminalTitle(t.title)
	err := t.cmd.Run()
	setTerminalTitle(defaultTermTitle)
	return err
}

func (t *titledCmd) SetStdin(r io.Reader) {
	if t.cmd.Stdin == nil {
		t.cmd.Stdin = r
	}
}

func (t *titledCmd) SetStdout(w io.Writer) {
	if t.cmd.Stdout == nil {
		t.cmd.Stdout = w
	}
}

func (t *titledCmd) SetStderr(w io.Writer) {
	if t.cmd.Stderr == nil {
		t.cmd.Stderr = w
	}
}

func execWithTitle(title string, c *exec.Cmd, fn tea.ExecCallback) tea.Cmd {
	return tea.Exec(&titledCmd{cmd: c, title: title}, fn)
}
