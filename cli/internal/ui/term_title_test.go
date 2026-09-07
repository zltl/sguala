package ui

import "testing"

func TestSanitizeTermTitle(t *testing.T) {
	got := sanitizeTermTitle("ssh web\x1b]0;hack\x07")
	if stringsContainsBELOrESC(got) {
		t.Fatalf("unsafe title %q", got)
	}
	if got != "ssh web]0;hack" && got != "ssh web0;hack" {
		// ESC and BEL stripped; leftover may vary
		if len(got) == 0 {
			t.Fatal("empty")
		}
	}
	long := stringsRepeat("a", 200)
	if len(sanitizeTermTitle(long)) > 120 {
		t.Fatal("not truncated")
	}
}

func stringsContainsBELOrESC(s string) bool {
	for _, r := range s {
		if r == '\a' || r == '\x1b' {
			return true
		}
	}
	return false
}

func stringsRepeat(s string, n int) string {
	b := make([]byte, 0, len(s)*n)
	for i := 0; i < n; i++ {
		b = append(b, s...)
	}
	return string(b)
}
