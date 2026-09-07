package sshconfig

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindHostLocation(t *testing.T) {
	dir := t.TempDir()
	main := filepath.Join(dir, "config")
	inc := filepath.Join(dir, "extra")
	if err := os.WriteFile(inc, []byte("Host from-inc\n  HostName 1.2.3.4\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	content := `# production
Host web-01
  HostName 10.0.0.1

Include ` + inc + `

Host db
  HostName 10.0.0.2
`
	if err := os.WriteFile(main, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	loc, ok := FindHostLocation(main, "web-01")
	if !ok || loc.Line != 2 {
		t.Fatalf("web-01: ok=%v loc=%+v", ok, loc)
	}
	if loc.Path != main {
		// abs path
		if abs, _ := filepath.Abs(main); loc.Path != abs {
			t.Fatalf("path=%q", loc.Path)
		}
	}

	loc, ok = FindHostLocation(main, "from-inc")
	if !ok || loc.Line != 1 {
		t.Fatalf("from-inc: ok=%v loc=%+v", ok, loc)
	}
	absInc, _ := filepath.Abs(inc)
	if loc.Path != absInc {
		t.Fatalf("inc path=%q want %q", loc.Path, absInc)
	}

	loc, ok = FindHostLocation(main, "db")
	if !ok || loc.Line != 7 {
		t.Fatalf("db: ok=%v loc=%+v want line 7", ok, loc)
	}

	if _, ok := FindHostLocation(main, "missing"); ok {
		t.Fatal("expected miss")
	}
}

func TestEditorCommand(t *testing.T) {
	c := EditorCommand("vim", "/tmp/config", 12)
	if c.Path != "vim" && filepath.Base(c.Path) != "vim" {
		// Command may resolve path; check Args
	}
	got := c.Args
	// Args[0] is the binary name as invoked
	if len(got) < 3 || got[len(got)-2] != "+12" || got[len(got)-1] != "/tmp/config" {
		t.Fatalf("vim args=%v", got)
	}

	c = EditorCommand("code --wait", "/tmp/config", 3)
	if len(c.Args) < 4 {
		t.Fatalf("code args=%v", c.Args)
	}
	foundG := false
	for i, a := range c.Args {
		if a == "-g" && i+1 < len(c.Args) && c.Args[i+1] == "/tmp/config:3" {
			foundG = true
		}
	}
	if !foundG {
		t.Fatalf("code args=%v", c.Args)
	}

	c = EditorCommand("vi", "/tmp/config", 0)
	if len(c.Args) < 2 || c.Args[len(c.Args)-1] != "/tmp/config" {
		t.Fatalf("no-line args=%v", c.Args)
	}
}
