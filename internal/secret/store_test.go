package secret

import (
	"path/filepath"
	"testing"
)

func TestFingerprint(t *testing.T) {
	cases := []struct {
		user, addr, want string
	}{
		{"Deploy", "10.0.0.1:2222", "deploy@10.0.0.1:2222"},
		{"root", "example.com", "root@example.com:22"},
		{"u", "[::1]:22", "u@[::1]:22"},
		{"u", "[::1]", "u@[::1]:22"},
	}
	for _, c := range cases {
		if got := Fingerprint(c.user, c.addr); got != c.want {
			t.Fatalf("Fingerprint(%q,%q)=%q want %q", c.user, c.addr, got, c.want)
		}
	}
}

func TestFileStoreRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "host_passwords.json")
	restore := UseFileOnlyForTest(path)
	defer restore()

	if Has("web") {
		t.Fatal("expected empty")
	}
	b, err := Set("web", "s3cret")
	if err != nil || b != BackendFile {
		t.Fatalf("Set: backend=%s err=%v", b, err)
	}
	pw, b, err := Get("web")
	if err != nil || b != BackendFile || pw != "s3cret" {
		t.Fatalf("Get: pw=%q backend=%s err=%v", pw, b, err)
	}
	if !Has("web") {
		t.Fatal("Has")
	}
	if _, err := Set("web", ""); err != nil {
		t.Fatal(err)
	}
	pw, b, err = Get("web")
	if err != nil || pw != "" || b != BackendNone {
		t.Fatalf("after delete: pw=%q backend=%s err=%v", pw, b, err)
	}
}

func TestReconcileRenamesPassword(t *testing.T) {
	path := filepath.Join(t.TempDir(), "host_passwords.json")
	restore := UseFileOnlyForTest(path)
	defer restore()

	_, err := Set("web-old", "s3cret")
	if err != nil {
		t.Fatal(err)
	}
	renamed, err := Reconcile([]HostRef{
		{Name: "web-old", User: "deploy", Addr: "10.0.0.1:22"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(renamed) != 0 {
		t.Fatalf("unexpected rename %#v", renamed)
	}

	renamed, err = Reconcile([]HostRef{
		{Name: "web-new", User: "deploy", Addr: "10.0.0.1:22"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(renamed) != 1 || renamed[0].From != "web-old" || renamed[0].To != "web-new" {
		t.Fatalf("renamed=%#v", renamed)
	}
	if Has("web-old") {
		t.Fatal("old alias still has password")
	}
	pw, _, err := Get("web-new")
	if err != nil || pw != "s3cret" {
		t.Fatalf("pw=%q err=%v", pw, err)
	}
}

func TestReconcileSkipsAmbiguous(t *testing.T) {
	path := filepath.Join(t.TempDir(), "host_passwords.json")
	restore := UseFileOnlyForTest(path)
	defer restore()

	_, _ = Set("a", "pw")
	_, err := Reconcile([]HostRef{{Name: "a", User: "u", Addr: "1.1.1.1:22"}})
	if err != nil {
		t.Fatal(err)
	}

	renamed, err := Reconcile([]HostRef{
		{Name: "b", User: "u", Addr: "1.1.1.1:22"},
		{Name: "c", User: "u", Addr: "1.1.1.1:22"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(renamed) != 0 {
		t.Fatalf("expected no rename, got %#v", renamed)
	}
	if !Has("a") {
		t.Fatal("password should remain on a")
	}
}

func TestRename(t *testing.T) {
	path := filepath.Join(t.TempDir(), "host_passwords.json")
	restore := UseFileOnlyForTest(path)
	defer restore()

	_, _ = Set("old", "x")
	if err := Rename("old", "new"); err != nil {
		t.Fatal(err)
	}
	if Has("old") || !Has("new") {
		t.Fatal("rename failed")
	}
	pw, _, _ := Get("new")
	if pw != "x" {
		t.Fatalf("pw=%q", pw)
	}
}
