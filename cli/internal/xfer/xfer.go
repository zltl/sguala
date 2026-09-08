package xfer

import "strings"

// SplitLocalPaths splits a user-entered path list on whitespace.
// Paths with spaces are not supported in the TUI prompt (use CLI quoting instead).
func SplitLocalPaths(s string) []string {
	fields := strings.Fields(strings.TrimSpace(s))
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if f != "" {
			out = append(out, f)
		}
	}
	return out
}
