package secret

import (
	"path/filepath"
	"testing"
)

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
