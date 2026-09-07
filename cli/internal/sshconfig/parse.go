package sshconfig

import (
	"bufio"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type Host struct {
	Name         string
	HostName     string
	User         string
	Port         int
	IdentityFile string
	ProxyJump    string
}

type hostBlock struct {
	patterns []string
	values   map[string]string
}

func expandHome(p, home string) string {
	if p == "" {
		return p
	}
	if p == "~" {
		return home
	}
	if strings.HasPrefix(p, "~/") {
		return filepath.Join(home, p[2:])
	}
	return p
}

func stripComment(line string) string {
	inQuote := false
	for i := 0; i < len(line); i++ {
		ch := line[i]
		if ch == '"' && (i == 0 || line[i-1] != '\\') {
			inQuote = !inQuote
			continue
		}
		if ch == '#' && !inQuote {
			return line[:i]
		}
	}
	return line
}

func tokenize(line string) []string {
	var tokens []string
	var cur strings.Builder
	inQuote := false
	flush := func() {
		if cur.Len() > 0 {
			tokens = append(tokens, cur.String())
			cur.Reset()
		}
	}
	for i := 0; i < len(line); i++ {
		ch := line[i]
		if ch == '"' && (i == 0 || line[i-1] != '\\') {
			inQuote = !inQuote
			continue
		}
		if !inQuote && (ch == ' ' || ch == '\t') {
			flush()
			continue
		}
		cur.WriteByte(ch)
	}
	flush()
	return tokens
}

func isWildcard(p string) bool {
	return strings.ContainsAny(p, "*?")
}

func parseContent(content string) (blocks []hostBlock, includes []string) {
	var current *hostBlock
	sc := bufio.NewScanner(strings.NewReader(content))
	for sc.Scan() {
		line := strings.TrimSpace(stripComment(sc.Text()))
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
			if current != nil {
				blocks = append(blocks, *current)
			}
			current = &hostBlock{patterns: append([]string{}, toks[1:]...), values: map[string]string{}}
		case "match":
			if current != nil {
				blocks = append(blocks, *current)
				current = nil
			}
		case "include":
			includes = append(includes, toks[1:]...)
		default:
			if current == nil || len(toks) < 2 {
				continue
			}
			val := strings.Join(toks[1:], " ")
			if key == "identityfile" {
				if current.values["identityfile"] == "" {
					current.values["identityfile"] = val
				}
				continue
			}
			current.values[key] = val
		}
	}
	if current != nil {
		blocks = append(blocks, *current)
	}
	return blocks, includes
}

func expandInclude(pattern, cwd, home string) []string {
	expanded := expandHome(pattern, home)
	abs := expanded
	if !filepath.IsAbs(abs) {
		abs = filepath.Join(cwd, expanded)
	}
	if !strings.ContainsAny(filepath.Base(abs), "*?") {
		return []string{abs}
	}
	dir := filepath.Dir(abs)
	base := filepath.Base(abs)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []string
	for _, e := range entries {
		ok, _ := filepath.Match(base, e.Name())
		if ok {
			out = append(out, filepath.Join(dir, e.Name()))
		}
	}
	sort.Strings(out)
	return out
}

func loadRecursive(path, home string, seen map[string]struct{}, depth int) []hostBlock {
	if depth > 8 {
		return nil
	}
	resolved, err := filepath.Abs(path)
	if err != nil {
		return nil
	}
	if _, ok := seen[resolved]; ok {
		return nil
	}
	seen[resolved] = struct{}{}
	data, err := os.ReadFile(resolved)
	if err != nil {
		return nil
	}
	blocks, includes := parseContent(string(data))
	cwd := filepath.Dir(resolved)
	out := append([]hostBlock{}, blocks...)
	for _, inc := range includes {
		for _, f := range expandInclude(inc, cwd, home) {
			out = append(out, loadRecursive(f, home, seen, depth+1)...)
		}
	}
	return out
}

func mergeDefaults(specific, defaults map[string]string) map[string]string {
	merged := map[string]string{}
	for k, v := range defaults {
		merged[k] = v
	}
	for k, v := range specific {
		merged[k] = v
	}
	if specific["identityfile"] != "" {
		merged["identityfile"] = specific["identityfile"]
	} else if defaults["identityfile"] != "" {
		merged["identityfile"] = defaults["identityfile"]
	}
	return merged
}

// LoadHosts reads ~/.ssh/config (and Includes) into concrete Host entries.
func LoadHosts(configPath string) ([]Host, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	if configPath == "" {
		configPath = filepath.Join(home, ".ssh", "config")
	}
	blocks := loadRecursive(configPath, home, map[string]struct{}{}, 0)
	star := map[string]string{}
	for _, b := range blocks {
		if len(b.patterns) == 1 && b.patterns[0] == "*" {
			for k, v := range b.values {
				star[k] = v
			}
		}
	}
	byName := map[string]Host{}
	for _, b := range blocks {
		vals := mergeDefaults(b.values, star)
		user := vals["user"]
		if user == "" {
			user = "root"
		}
		port := 22
		if vals["port"] != "" {
			if p, err := strconv.Atoi(vals["port"]); err == nil && p >= 1 && p <= 65535 {
				port = p
			}
		}
		var identity string
		if vals["identityfile"] != "" {
			identity = expandHome(vals["identityfile"], home)
		}
		for _, name := range b.patterns {
			if name == "" || isWildcard(name) {
				continue
			}
			hostName := vals["hostname"]
			if hostName == "" {
				hostName = name
			}
			byName[name] = Host{
				Name:         name,
				HostName:     hostName,
				User:         user,
				Port:         port,
				IdentityFile: identity,
				ProxyJump:    vals["proxyjump"],
			}
		}
	}
	out := make([]Host, 0, len(byName))
	for _, h := range byName {
		out = append(out, h)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// ParseContentForTest parses a config snippet without Includes.
func ParseContentForTest(content string) []Host {
	blocks, _ := parseContent(content)
	star := map[string]string{}
	for _, b := range blocks {
		if len(b.patterns) == 1 && b.patterns[0] == "*" {
			for k, v := range b.values {
				star[k] = v
			}
		}
	}
	var out []Host
	for _, b := range blocks {
		vals := mergeDefaults(b.values, star)
		user := vals["user"]
		if user == "" {
			user = "root"
		}
		port := 22
		if vals["port"] != "" {
			if p, err := strconv.Atoi(vals["port"]); err == nil {
				port = p
			}
		}
		for _, name := range b.patterns {
			if name == "" || isWildcard(name) {
				continue
			}
			hostName := vals["hostname"]
			if hostName == "" {
				hostName = name
			}
			out = append(out, Host{
				Name:         name,
				HostName:     hostName,
				User:         user,
				Port:         port,
				IdentityFile: vals["identityfile"],
				ProxyJump:    vals["proxyjump"],
			})
		}
	}
	return out
}
