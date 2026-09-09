package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/zltl/sguala/internal/secret"
	"github.com/zltl/sguala/internal/sshconfig"
	"gopkg.in/yaml.v3"
)

const (
	DefaultRefresh = 10 * time.Second
	DefaultTimeout = 5 * time.Second
	DefaultWorkers = 8
)

// Config holds app settings. Hosts always come from OpenSSH config (see AttachSSHHosts).
type Config struct {
	Refresh   Duration `yaml:"refresh"`
	Timeout   Duration `yaml:"timeout"`
	Workers   int      `yaml:"workers"`
	SSHConfig string   `yaml:"ssh_config,omitempty"` // optional path; default ~/.ssh/config

	// Hosts is filled from SSH config at runtime; never written to settings YAML.
	Hosts []Host `yaml:"-"`
}

// Host is a concrete OpenSSH Host entry adapted for dialing / display.
type Host struct {
	Name      string // Host alias (ssh target name)
	Group     string // from # section comments in ~/.ssh/config
	Addr      string // host:port
	User      string
	Identity  string // IdentityFile path
	ProxyJump string
}

// Duration wraps time.Duration for YAML strings like "10s".
type Duration time.Duration

func (d Duration) Dur() time.Duration { return time.Duration(d) }

func (d *Duration) UnmarshalYAML(value *yaml.Node) error {
	if value.Kind != yaml.ScalarNode {
		return fmt.Errorf("duration must be a string")
	}
	if value.Value == "" {
		*d = 0
		return nil
	}
	parsed, err := time.ParseDuration(value.Value)
	if err != nil {
		return err
	}
	*d = Duration(parsed)
	return nil
}

func (d Duration) MarshalYAML() (interface{}, error) {
	return time.Duration(d).String(), nil
}

func Default() Config {
	return Config{
		Refresh: Duration(DefaultRefresh),
		Timeout: Duration(DefaultTimeout),
		Workers: DefaultWorkers,
	}
}

func DefaultPath() (string, error) {
	if p := os.Getenv("SGUALA_CONFIG"); p != "" {
		return p, nil
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "sguala", "config.yaml"), nil
}

func DefaultSSHConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".ssh", "config"), nil
}

// ResolvedSSHConfig returns the OpenSSH config path to use.
func (c Config) ResolvedSSHConfig() (string, error) {
	if c.SSHConfig != "" {
		return expandHome(c.SSHConfig), nil
	}
	return DefaultSSHConfigPath()
}

func expandHome(p string) string {
	if p == "" || p[0] != '~' {
		return p
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return p
	}
	if p == "~" {
		return home
	}
	if len(p) >= 2 && (p[1] == '/' || p[1] == '\\') {
		return filepath.Join(home, p[2:])
	}
	return p
}

// LoadSettings reads refresh/timeout/workers (and optional ssh_config). Hosts are not loaded.
func LoadSettings(path string) (Config, error) {
	cfg := Default()
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}
	// Ignore legacy "hosts:" in YAML by decoding into a settings-only shape first.
	type settingsFile struct {
		Refresh   Duration `yaml:"refresh"`
		Timeout   Duration `yaml:"timeout"`
		Workers   int      `yaml:"workers"`
		SSHConfig string   `yaml:"ssh_config"`
	}
	var raw settingsFile
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return cfg, err
	}
	cfg.Refresh = raw.Refresh
	cfg.Timeout = raw.Timeout
	cfg.Workers = raw.Workers
	cfg.SSHConfig = raw.SSHConfig
	cfg.applyDefaults()
	return cfg, nil
}

// AttachSSHHosts loads concrete Host entries from OpenSSH config into cfg.Hosts.
func AttachSSHHosts(cfg *Config) error {
	path, err := cfg.ResolvedSSHConfig()
	if err != nil {
		return err
	}
	list, err := sshconfig.LoadHosts(path)
	if err != nil {
		return err
	}
	hosts := make([]Host, 0, len(list))
	for _, h := range list {
		port := h.Port
		if port <= 0 {
			port = 22
		}
		hosts = append(hosts, Host{
			Name:      h.Name,
			Group:     h.Group,
			Addr:      fmt.Sprintf("%s:%d", h.HostName, port),
			User:      h.User,
			Identity:  h.IdentityFile,
			ProxyJump: h.ProxyJump,
		})
	}
	cfg.Hosts = hosts
	return nil
}

// ReconcileSecrets rebinds stored passwords when Host aliases were renamed
// (matched by user@addr:port from the previous load).
func ReconcileSecrets(cfg Config) []secret.RenameResult {
	refs := make([]secret.HostRef, 0, len(cfg.Hosts))
	for _, h := range cfg.Hosts {
		refs = append(refs, secret.HostRef{Name: h.Name, User: h.User, Addr: h.Addr})
	}
	renamed, err := secret.Reconcile(refs)
	if err != nil {
		return nil
	}
	return renamed
}

// LoadRuntime loads settings YAML (optional) + hosts from ~/.ssh/config.
func LoadRuntime(settingsPath string) (Config, string, error) {
	cfg := Default()
	if settingsPath != "" {
		loaded, err := LoadSettings(settingsPath)
		if err != nil {
			if !os.IsNotExist(err) {
				return cfg, settingsPath, err
			}
		} else {
			cfg = loaded
		}
	}
	if err := AttachSSHHosts(&cfg); err != nil {
		return cfg, settingsPath, err
	}
	_ = ReconcileSecrets(cfg)
	return cfg, settingsPath, nil
}

func (c *Config) applyDefaults() {
	if c.Refresh.Dur() <= 0 {
		c.Refresh = Duration(DefaultRefresh)
	}
	if c.Timeout.Dur() <= 0 {
		c.Timeout = Duration(DefaultTimeout)
	}
	if c.Workers <= 0 {
		c.Workers = DefaultWorkers
	}
}

func (c Config) HostByName(name string) (Host, bool) {
	for _, h := range c.Hosts {
		if h.Name == name {
			return h, true
		}
	}
	return Host{}, false
}

func EnsureExample(path string) error {
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	example := `# sguala-cli settings (hosts come from ~/.ssh/config)
refresh: 10s
timeout: 5s
workers: 8
# ssh_config: ~/.ssh/config
`
	return os.WriteFile(path, []byte(example), 0o600)
}

func WriteSettings(path string, cfg Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	type settingsFile struct {
		Refresh   Duration `yaml:"refresh"`
		Timeout   Duration `yaml:"timeout"`
		Workers   int      `yaml:"workers"`
		SSHConfig string   `yaml:"ssh_config,omitempty"`
	}
	data, err := yaml.Marshal(settingsFile{
		Refresh:   cfg.Refresh,
		Timeout:   cfg.Timeout,
		Workers:   cfg.Workers,
		SSHConfig: cfg.SSHConfig,
	})
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
