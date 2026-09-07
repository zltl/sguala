package bundle

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const FormatName = "sguala-bundle"
const FormatVersion = 1

type Manifest struct {
	Format         string `json:"format"`
	Version        int    `json:"version"`
	CreatedAt      string `json:"created_at"`
	Source         string `json:"source"`
	IncludeSecrets bool   `json:"include_secrets"`
	IncludeKeys    bool   `json:"include_keys"`
	AppVersion     string `json:"app_version,omitempty"`
}

type HostsFile struct {
	Version int     `json:"version"`
	Groups  []Group `json:"groups"`
}

type Group struct {
	Name  string     `json:"name"`
	Hosts []HostSpec `json:"hosts"`
}

type HostSpec struct {
	Name         string `json:"name"`
	Hostname     string `json:"hostname"`
	Port         int    `json:"port"`
	User         string `json:"user"`
	Auth         string `json:"auth"` // key | password | agent
	IdentityFile string `json:"identity_file,omitempty"`
	KeyRef       string `json:"key_ref,omitempty"`
	ProxyJump    string `json:"proxy_jump,omitempty"`
	HasPassword  bool   `json:"has_password,omitempty"`
	Group        string `json:"-"` // filled when flattening
}

type PasswordsFile struct {
	Version int               `json:"version"`
	Hosts   map[string]string `json:"hosts"`
}

type ExportOptions struct {
	IncludeKeys    bool
	IncludeSecrets bool
	Source         string // desktop | cli
	AppVersion     string
}

type ImportOptions struct {
	Overwrite      bool
	IncludeKeys    bool // apply keys from bundle if present
	IncludeSecrets bool // apply passwords if present
}

type ImportResult struct {
	Added    int      `json:"added"`
	Skipped  int      `json:"skipped"`
	Updated  int      `json:"updated"`
	Keys     int      `json:"keys"`
	Secrets  int      `json:"secrets"`
	Warnings []string `json:"warnings,omitempty"`
}

func writeJSON(path string, v any, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, mode)
}

func readJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// IsZipPath reports whether path should be treated as a zip archive.
func IsZipPath(path string) bool {
	return strings.HasSuffix(strings.ToLower(path), ".zip") ||
		strings.HasSuffix(strings.ToLower(path), ".sguala.zip")
}

// OpenRoot returns a filesystem root for a bundle dir or extracted zip temp dir.
// Caller must call cleanup().
func OpenRoot(path string) (root string, cleanup func(), err error) {
	st, err := os.Stat(path)
	if err != nil {
		return "", nil, err
	}
	if st.IsDir() {
		return path, func() {}, nil
	}
	if !IsZipPath(path) {
		// single file that is not zip — treat parent if it's manifest? reject
		return "", nil, fmt.Errorf("bundle must be a directory or .zip file")
	}
	tmp, err := os.MkdirTemp("", "sguala-bundle-*")
	if err != nil {
		return "", nil, err
	}
	if err := unzipTo(path, tmp); err != nil {
		os.RemoveAll(tmp)
		return "", nil, err
	}
	// zip may contain a single top-level folder
	root = tmp
	entries, _ := os.ReadDir(tmp)
	if len(entries) == 1 && entries[0].IsDir() {
		root = filepath.Join(tmp, entries[0].Name())
	}
	return root, func() { os.RemoveAll(tmp) }, nil
}

func unzipTo(zipPath, dest string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, f := range r.File {
		name := filepath.Clean(f.Name)
		if strings.HasPrefix(name, "..") {
			continue
		}
		target := filepath.Join(dest, name)
		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(target, 0o700)
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		mode := f.Mode()
		if mode == 0 {
			mode = 0o600
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(out, rc)
		out.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

// ZipDir packs srcDir into zipPath.
func ZipDir(srcDir, zipPath string) error {
	if err := os.MkdirAll(filepath.Dir(zipPath), 0o755); err != nil {
		return err
	}
	f, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer f.Close()
	w := zip.NewWriter(f)
	defer w.Close()
	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		rel = filepath.ToSlash(rel)
		if info.IsDir() {
			_, err := w.Create(rel + "/")
			return err
		}
		hdr, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		hdr.Name = rel
		hdr.Method = zip.Deflate
		fw, err := w.CreateHeader(hdr)
		if err != nil {
			return err
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(fw, in)
		in.Close()
		return copyErr
	})
}

func NewManifest(opt ExportOptions) Manifest {
	return Manifest{
		Format:         FormatName,
		Version:        FormatVersion,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		Source:         opt.Source,
		IncludeSecrets: opt.IncludeSecrets,
		IncludeKeys:    opt.IncludeKeys,
		AppVersion:     opt.AppVersion,
	}
}

func LoadManifest(root string) (Manifest, error) {
	var m Manifest
	err := readJSON(filepath.Join(root, "manifest.json"), &m)
	return m, err
}

func LoadHosts(root string) (HostsFile, error) {
	var h HostsFile
	err := readJSON(filepath.Join(root, "hosts.json"), &h)
	return h, err
}

func FlattenHosts(hf HostsFile) []HostSpec {
	var out []HostSpec
	for _, g := range hf.Groups {
		gname := g.Name
		for _, h := range g.Hosts {
			h.Group = gname
			out = append(out, h)
		}
	}
	return out
}

func GroupHosts(specs []HostSpec) HostsFile {
	order := []string{}
	by := map[string][]HostSpec{}
	for _, h := range specs {
		g := h.Group
		if g == "" {
			g = "Default"
		}
		if _, ok := by[g]; !ok {
			order = append(order, g)
		}
		h.Group = ""
		by[g] = append(by[g], h)
	}
	hf := HostsFile{Version: 1}
	for _, g := range order {
		hf.Groups = append(hf.Groups, Group{Name: g, Hosts: by[g]})
	}
	return hf
}

// RenderSSHFragment builds an OpenSSH config snippet from hosts (no passwords).
func RenderSSHFragment(hf HostsFile) string {
	var b strings.Builder
	b.WriteString("# Generated by sguala-bundle — do not store passwords here\n")
	for _, g := range hf.Groups {
		if g.Name != "" && g.Name != "Default" {
			fmt.Fprintf(&b, "\n# %s\n", g.Name)
		}
		for _, h := range g.Hosts {
			fmt.Fprintf(&b, "Host %s\n", h.Name)
			if h.Hostname != "" && h.Hostname != h.Name {
				fmt.Fprintf(&b, "  HostName %s\n", h.Hostname)
			}
			if h.User != "" {
				fmt.Fprintf(&b, "  User %s\n", h.User)
			}
			if h.Port > 0 && h.Port != 22 {
				fmt.Fprintf(&b, "  Port %d\n", h.Port)
			}
			id := h.IdentityFile
			if id == "" && h.KeyRef != "" {
				id = h.KeyRef
			}
			if id != "" {
				fmt.Fprintf(&b, "  IdentityFile %s\n", id)
			}
			if h.ProxyJump != "" {
				fmt.Fprintf(&b, "  ProxyJump %s\n", h.ProxyJump)
			}
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func WriteBundleDir(root string, m Manifest, hf HostsFile, passwords map[string]string, keys map[string][]byte, opt ExportOptions) error {
	if err := os.MkdirAll(root, 0o700); err != nil {
		return err
	}
	if err := writeJSON(filepath.Join(root, "manifest.json"), m, 0o600); err != nil {
		return err
	}
	if err := writeJSON(filepath.Join(root, "hosts.json"), hf, 0o600); err != nil {
		return err
	}
	sshDir := filepath.Join(root, "ssh")
	if err := os.MkdirAll(sshDir, 0o700); err != nil {
		return err
	}
	frag := RenderSSHFragment(hf)
	if err := os.WriteFile(filepath.Join(sshDir, "config.fragment"), []byte(frag), 0o600); err != nil {
		return err
	}
	readme := `sguala-bundle
=============
hosts.json          normalized hosts
ssh/config.fragment OpenSSH snippet (no passwords)
secrets/            only if exported with secrets/keys

Restore with: sguala import <this-path>
`
	if err := os.WriteFile(filepath.Join(root, "README.txt"), []byte(readme), 0o644); err != nil {
		return err
	}
	if opt.IncludeSecrets && len(passwords) > 0 {
		pf := PasswordsFile{Version: 1, Hosts: passwords}
		if err := writeJSON(filepath.Join(root, "secrets", "passwords.json"), pf, 0o600); err != nil {
			return err
		}
	}
	if opt.IncludeKeys && len(keys) > 0 {
		keyDir := filepath.Join(root, "secrets", "keys")
		if err := os.MkdirAll(keyDir, 0o700); err != nil {
			return err
		}
		names := make([]string, 0, len(keys))
		for n := range keys {
			names = append(names, n)
		}
		sort.Strings(names)
		for _, n := range names {
			safe := sanitizeFileName(n)
			if err := os.WriteFile(filepath.Join(keyDir, safe+".pem"), keys[n], 0o600); err != nil {
				return err
			}
		}
	}
	return nil
}

func sanitizeFileName(s string) string {
	s = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_', r == '.':
			return r
		default:
			return '_'
		}
	}, s)
	if s == "" {
		return "key"
	}
	return s
}

func LoadPasswords(root string) (map[string]string, error) {
	path := filepath.Join(root, "secrets", "passwords.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return map[string]string{}, nil
	}
	var pf PasswordsFile
	if err := readJSON(path, &pf); err != nil {
		return nil, err
	}
	if pf.Hosts == nil {
		return map[string]string{}, nil
	}
	return pf.Hosts, nil
}

func LoadKeys(root string) (map[string][]byte, error) {
	dir := filepath.Join(root, "secrets", "keys")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string][]byte{}, nil
		}
		return nil, err
	}
	out := map[string][]byte{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		data, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return nil, err
		}
		base := strings.TrimSuffix(name, filepath.Ext(name))
		out[base] = data
	}
	return out, nil
}
