package bundle

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/zltl/sguala/internal/config"
	"github.com/zltl/sguala/internal/secret"
	"github.com/zltl/sguala/internal/sshconfig"
)

// ExportFromCLI builds a bundle from ~/.ssh/config (+ optional secrets/keys).
func ExportFromCLI(outPath string, cfg config.Config, opt ExportOptions) error {
	opt.Source = "cli"
	specs := make([]HostSpec, 0, len(cfg.Hosts))
	passwords := map[string]string{}
	keys := map[string][]byte{}

	for _, h := range cfg.Hosts {
		hostName, port := splitAddr(h.Addr)
		auth := "agent"
		if h.Identity != "" {
			auth = "key"
		}
		hasPW := false
		if opt.IncludeSecrets {
			if pw, _, err := secret.Get(h.Name); err == nil && pw != "" {
				passwords[h.Name] = pw
				hasPW = true
				auth = "password"
			}
		} else if secret.Has(h.Name) {
			hasPW = true
			if h.Identity == "" {
				auth = "password"
			}
		}
		spec := HostSpec{
			Name:         h.Name,
			Hostname:     hostName,
			Port:         port,
			User:         h.User,
			Auth:         auth,
			IdentityFile: h.Identity,
			ProxyJump:    h.ProxyJump,
			HasPassword:  hasPW,
			Group:        h.Group,
		}
		if opt.IncludeKeys && h.Identity != "" {
			path := expandHome(h.Identity)
			if data, err := os.ReadFile(path); err == nil && looksLikePrivateKey(data) {
				safe := sanitizeFileName(h.Name)
				spec.KeyRef = "secrets/keys/" + safe + ".pem"
				keys[safe] = data
			}
		}
		specs = append(specs, spec)
	}

	hf := GroupHosts(specs)
	m := NewManifest(opt)

	dir := outPath
	zipOut := IsZipPath(outPath)
	if zipOut {
		tmp, err := os.MkdirTemp("", "sguala-export-*")
		if err != nil {
			return err
		}
		defer os.RemoveAll(tmp)
		dir = filepath.Join(tmp, "sguala-bundle")
		if err := WriteBundleDir(dir, m, hf, passwords, keys, opt); err != nil {
			return err
		}
		return ZipDir(dir, outPath)
	}
	return WriteBundleDir(dir, m, hf, passwords, keys, opt)
}

// ImportToCLI merges bundle hosts into ~/.ssh/config and optional secrets/keys.
func ImportToCLI(bundlePath string, cfg config.Config, opt ImportOptions) (ImportResult, error) {
	var res ImportResult
	root, cleanup, err := OpenRoot(bundlePath)
	if err != nil {
		return res, err
	}
	defer cleanup()

	man, err := LoadManifest(root)
	if err != nil {
		return res, fmt.Errorf("manifest: %w", err)
	}
	if man.Format != FormatName {
		return res, fmt.Errorf("unsupported format %q", man.Format)
	}
	hf, err := LoadHosts(root)
	if err != nil {
		return res, fmt.Errorf("hosts.json: %w", err)
	}

	sshPath, err := cfg.ResolvedSSHConfig()
	if err != nil {
		return res, err
	}
	existing, _ := sshconfig.LoadHosts(sshPath)
	existSet := map[string]struct{}{}
	for _, h := range existing {
		existSet[h.Name] = struct{}{}
	}

	keys, _ := LoadKeys(root)
	passwords, _ := LoadPasswords(root)
	keyDir := filepath.Join(mustHome(), ".ssh", "sguala-keys")

	var appendBlocks strings.Builder
	appendBlocks.WriteString("\n# --- sguala import ---\n")

	for _, h := range FlattenHosts(hf) {
		_, exists := existSet[h.Name]
		if exists && !opt.Overwrite {
			res.Skipped++
			continue
		}
		idFile := h.IdentityFile
		if opt.IncludeKeys {
			safe := sanitizeFileName(h.Name)
			if data, ok := keys[safe]; ok {
				if err := os.MkdirAll(keyDir, 0o700); err != nil {
					return res, err
				}
				dest := filepath.Join(keyDir, safe)
				if err := os.WriteFile(dest, data, 0o600); err != nil {
					return res, err
				}
				idFile = dest
				res.Keys++
			} else if h.KeyRef != "" {
				// try basename from key_ref
				base := sanitizeFileName(strings.TrimSuffix(filepath.Base(h.KeyRef), filepath.Ext(h.KeyRef)))
				if data, ok := keys[base]; ok {
					if err := os.MkdirAll(keyDir, 0o700); err != nil {
						return res, err
					}
					dest := filepath.Join(keyDir, base)
					if err := os.WriteFile(dest, data, 0o600); err != nil {
						return res, err
					}
					idFile = dest
					res.Keys++
				}
			}
		}
		if opt.IncludeSecrets {
			if pw, ok := passwords[h.Name]; ok && pw != "" {
				if _, err := secret.Set(h.Name, pw); err != nil {
					res.Warnings = append(res.Warnings, fmt.Sprintf("%s password: %v", h.Name, err))
				} else {
					res.Secrets++
				}
			}
		}

		block := formatHostBlock(h, idFile)
		if exists && opt.Overwrite {
			// append override block; OpenSSH first-match wins so warn
			res.Warnings = append(res.Warnings,
				fmt.Sprintf("%s already in config — appended new Host block (OpenSSH uses first match; edit manually if needed)", h.Name))
			res.Updated++
		} else {
			res.Added++
		}
		appendBlocks.WriteString(block)
		existSet[h.Name] = struct{}{}
	}

	if res.Added+res.Updated > 0 {
		if err := os.MkdirAll(filepath.Dir(sshPath), 0o700); err != nil {
			return res, err
		}
		f, err := os.OpenFile(sshPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
		if err != nil {
			return res, err
		}
		_, err = f.WriteString(appendBlocks.String())
		f.Close()
		if err != nil {
			return res, err
		}
	}
	return res, nil
}

func formatHostBlock(h HostSpec, identity string) string {
	var b strings.Builder
	if h.Group != "" && h.Group != "Default" {
		fmt.Fprintf(&b, "# %s\n", h.Group)
	}
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
	if identity != "" {
		fmt.Fprintf(&b, "  IdentityFile %s\n", identity)
	}
	if h.ProxyJump != "" {
		fmt.Fprintf(&b, "  ProxyJump %s\n", h.ProxyJump)
	}
	b.WriteByte('\n')
	return b.String()
}

func splitAddr(addr string) (host string, port int) {
	port = 22
	host = addr
	if i := strings.LastIndex(addr, ":"); i > 0 {
		h := addr[:i]
		p := addr[i+1:]
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			host = h
			port = n
		}
	}
	return host, port
}

func expandHome(p string) string {
	if strings.HasPrefix(p, "~/") {
		return filepath.Join(mustHome(), p[2:])
	}
	return p
}

func mustHome() string {
	h, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return h
}

func looksLikePrivateKey(data []byte) bool {
	s := string(data)
	return strings.Contains(s, "PRIVATE KEY")
}

// ExportSSHFragment writes only the OpenSSH fragment from current CLI hosts.
func ExportSSHFragment(outPath string, cfg config.Config) error {
	specs := make([]HostSpec, 0, len(cfg.Hosts))
	for _, h := range cfg.Hosts {
		hostName, port := splitAddr(h.Addr)
		specs = append(specs, HostSpec{
			Name:         h.Name,
			Hostname:     hostName,
			Port:         port,
			User:         h.User,
			IdentityFile: h.Identity,
			ProxyJump:    h.ProxyJump,
			Group:        h.Group,
		})
	}
	frag := RenderSSHFragment(GroupHosts(specs))
	dir := filepath.Dir(outPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}
	return os.WriteFile(outPath, []byte(frag), 0o600)
}

// ImportSSHFragment appends an OpenSSH fragment file into the user's ssh config.
func ImportSSHFragment(fragPath, sshConfigPath string) error {
	data, err := os.ReadFile(fragPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(sshConfigPath), 0o700); err != nil {
		return err
	}
	f, err := os.OpenFile(sshConfigPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := f.WriteString("\n# --- sguala import-ssh ---\n"); err != nil {
		return err
	}
	_, err = f.Write(data)
	return err
}
