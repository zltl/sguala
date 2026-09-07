package sshconfig

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Location is a 1-based line in an SSH config file (possibly an Include).
type Location struct {
	Path string
	Line int
}

// FindHostLocation finds the first Host line that defines alias (OpenSSH first-match).
// Searches the main config and Include files in OpenSSH encounter order.
func FindHostLocation(configPath, alias string) (Location, bool) {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return Location{}, false
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return Location{}, false
	}
	if configPath == "" {
		configPath = filepath.Join(home, ".ssh", "config")
	}
	return findHostRecursive(configPath, home, alias, map[string]struct{}{}, 0)
}

func findHostRecursive(path, home, alias string, seen map[string]struct{}, depth int) (Location, bool) {
	if depth > 8 {
		return Location{}, false
	}
	resolved, err := filepath.Abs(path)
	if err != nil {
		return Location{}, false
	}
	if _, ok := seen[resolved]; ok {
		return Location{}, false
	}
	seen[resolved] = struct{}{}

	f, err := os.Open(resolved)
	if err != nil {
		return Location{}, false
	}
	defer f.Close()

	cwd := filepath.Dir(resolved)
	sc := bufio.NewScanner(f)
	lineNum := 0
	for sc.Scan() {
		lineNum++
		raw := sc.Text()
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" || isUnindentedComment(raw, trimmed) {
			continue
		}
		line := strings.TrimSpace(stripComment(trimmed))
		if line == "" {
			continue
		}
		toks := tokenize(line)
		if len(toks) == 0 {
			continue
		}
		key := strings.ToLower(toks[0])
		switch key {
		case "host":
			for _, p := range toks[1:] {
				if p == alias {
					return Location{Path: resolved, Line: lineNum}, true
				}
			}
		case "include":
			for _, pat := range toks[1:] {
				for _, inc := range expandInclude(pat, cwd, home) {
					if loc, ok := findHostRecursive(inc, home, alias, seen, depth+1); ok {
						return loc, true
					}
				}
			}
		}
	}
	return Location{}, false
}

// EditorCommand builds an editor invocation that opens file, optionally at line.
// Honors common $EDITOR forms: "vim", "nvim", "code --wait", "nano", etc.
func EditorCommand(editor, file string, line int) *exec.Cmd {
	editor = strings.TrimSpace(editor)
	if editor == "" {
		editor = "vi"
	}
	fields := strings.Fields(editor)
	bin := fields[0]
	rest := fields[1:]
	args := append([]string{}, rest...)
	base := strings.ToLower(filepath.Base(bin))
	// strip .exe for windows-ish names
	base = strings.TrimSuffix(base, ".exe")

	if line > 0 {
		switch {
		case isVSCode(base):
			args = append(args, "-g", fmt.Sprintf("%s:%d", file, line))
		case base == "subl" || base == "sublime_text":
			args = append(args, fmt.Sprintf("%s:%d", file, line))
		case base == "hx" || base == "helix":
			args = append(args, fmt.Sprintf("%s:%d", file, line))
		case base == "kate":
			args = append(args, fmt.Sprintf("--line=%d", line), file)
		case base == "emacs" || base == "emacsclient":
			args = append(args, fmt.Sprintf("+%d", line), file)
		default:
			// vi / vim / nvim / nano / micro / most $EDITOR defaults
			args = append(args, fmt.Sprintf("+%d", line), file)
		}
	} else {
		args = append(args, file)
	}
	return exec.Command(bin, args...)
}

func isVSCode(base string) bool {
	switch base {
	case "code", "code-insiders", "codium", "cursor", "code-oss":
		return true
	default:
		return false
	}
}
