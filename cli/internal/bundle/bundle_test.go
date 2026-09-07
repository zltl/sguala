package bundle

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWriteAndLoadBundleDir(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "bundle")
	hf := HostsFile{
		Version: 1,
		Groups: []Group{{
			Name: "prod",
			Hosts: []HostSpec{{
				Name:     "web",
				Hostname: "10.0.0.1",
				Port:     22,
				User:     "deploy",
				Auth:     "key",
			}},
		}},
	}
	opt := ExportOptions{Source: "test", IncludeSecrets: true, IncludeKeys: true}
	m := NewManifest(opt)
	pw := map[string]string{"web": "s3cret"}
	keys := map[string][]byte{"web": []byte("-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----\n")}
	if err := WriteBundleDir(root, m, hf, pw, keys, opt); err != nil {
		t.Fatal(err)
	}
	man, err := LoadManifest(root)
	if err != nil || man.Format != FormatName {
		t.Fatalf("manifest %+v %v", man, err)
	}
	got, err := LoadHosts(root)
	if err != nil || len(got.Groups) != 1 || got.Groups[0].Hosts[0].Name != "web" {
		t.Fatalf("hosts %+v %v", got, err)
	}
	pws, err := LoadPasswords(root)
	if err != nil || pws["web"] != "s3cret" {
		t.Fatalf("pw %+v %v", pws, err)
	}
	ks, err := LoadKeys(root)
	if err != nil || len(ks["web"]) == 0 {
		t.Fatalf("keys %+v %v", ks, err)
	}
	frag, err := os.ReadFile(filepath.Join(root, "ssh", "config.fragment"))
	if err != nil || !strings.Contains(string(frag), "Host web") || !strings.Contains(string(frag), "HostName 10.0.0.1") {
		t.Fatalf("fragment %s", frag)
	}
}

func TestZipRoundTrip(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "bundle")
	hf := GroupHosts([]HostSpec{{Name: "a", Hostname: "a", Port: 22, User: "root", Group: "g"}})
	opt := ExportOptions{Source: "test"}
	if err := WriteBundleDir(root, NewManifest(opt), hf, nil, nil, opt); err != nil {
		t.Fatal(err)
	}
	zipPath := filepath.Join(dir, "out.sguala.zip")
	if err := ZipDir(root, zipPath); err != nil {
		t.Fatal(err)
	}
	opened, cleanup, err := OpenRoot(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	got, err := LoadHosts(opened)
	if err != nil || len(FlattenHosts(got)) != 1 {
		t.Fatalf("%+v %v", got, err)
	}
}
