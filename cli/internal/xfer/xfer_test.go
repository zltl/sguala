package xfer

import (
	"reflect"
	"testing"
)

func TestRemoteSpec(t *testing.T) {
	if got := RemoteSpec("web", "/tmp/a"); got != "web:/tmp/a" {
		t.Fatalf("got %q", got)
	}
	if got := RemoteSpec("web", ""); got != "web:." {
		t.Fatalf("got %q", got)
	}
}

func TestSCPGetArgs(t *testing.T) {
	got := SCPGetArgs("web", "/var/log/a.log", ".", nil)
	want := []string{"-r", "web:/var/log/a.log", "."}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
	got = SCPGetArgs("web", "x", "/tmp", []string{"-q"})
	want = []string{"-r", "-q", "web:x", "/tmp"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
}

func TestSCPPutArgs(t *testing.T) {
	got, err := SCPPutArgs("web", []string{"./a", "./b"}, "/tmp", nil)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"-r", "./a", "./b", "web:/tmp"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
	if _, err := SCPPutArgs("web", nil, ".", nil); err == nil {
		t.Fatal("expected error")
	}
}

func TestSFTPArgs(t *testing.T) {
	if got := SFTPArgs("web-01"); !reflect.DeepEqual(got, []string{"web-01"}) {
		t.Fatalf("got %#v", got)
	}
}

func TestRsyncArgs(t *testing.T) {
	got := RsyncArgs([]string{"-avz", "./d/", "web:d/"})
	want := []string{"-e", "ssh", "-avz", "./d/", "web:d/"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
	got = RsyncArgs([]string{"-e", "ssh -J jump", "-avz", "a", "b:c"})
	want = []string{"-e", "ssh -J jump", "-avz", "a", "b:c"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
}

func TestSplitLocalPaths(t *testing.T) {
	got := SplitLocalPaths("  a  b/c  ")
	want := []string{"a", "b/c"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v", got)
	}
}
