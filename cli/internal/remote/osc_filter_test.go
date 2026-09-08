package remote

import (
	"bytes"
	"testing"
)

func TestOSCTitleFilterDropsTitles(t *testing.T) {
	var buf bytes.Buffer
	f := &oscTitleFilter{w: &buf}

	in := []byte("hello\x1b]0;remote-hostname\x07 world\x1b]2;also\x1b\\ keep\x1b]11;#fff\x07")
	n, err := f.Write(in)
	if err != nil {
		t.Fatal(err)
	}
	if n != len(in) {
		t.Fatalf("n=%d want %d", n, len(in))
	}
	got := buf.String()
	want := "hello world keep\x1b]11;#fff\x07"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestOSCTitleFilterSplitChunks(t *testing.T) {
	var buf bytes.Buffer
	f := &oscTitleFilter{w: &buf}
	chunks := [][]byte{
		[]byte("a\x1b"),
		[]byte("]0;host"),
		[]byte("name\x07b"),
	}
	for _, c := range chunks {
		if _, err := f.Write(c); err != nil {
			t.Fatal(err)
		}
	}
	if got := buf.String(); got != "ab" {
		t.Fatalf("got %q", got)
	}
}
