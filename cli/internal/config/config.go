package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	DefaultRefresh = 10 * time.Second
	DefaultTimeout = 5 * time.Second
	DefaultWorkers = 8
)

type Config struct {
	Refresh Duration `yaml:"refresh"`
	Timeout Duration `yaml:"timeout"`
	Workers int      `yaml:"workers"`
	Hosts   []Host   `yaml:"hosts"`
}

type Host struct {
	Name       string `yaml:"name"`
	Group      string `yaml:"group"`
	Addr       string `yaml:"addr"` // host:port or host
	User       string `yaml:"user"`
	Identity   string `yaml:"identity"`    // path to private key
	ProxyJump  string `yaml:"proxy_jump"`  // optional bastion name (matches another host.name) or user@host:port
	Password   string `yaml:"password"`    // discouraged; prefer agent/identity
	Tags       []string `yaml:"tags"`
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
		Hosts:   nil,
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

func Load(path string) (Config, error) {
	cfg := Default()
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return cfg, err
	}
	cfg.applyDefaults()
	if err := cfg.Validate(); err != nil {
		return cfg, err
	}
	return cfg, nil
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
	for i := range c.Hosts {
		h := &c.Hosts[i]
		if h.User == "" {
			h.User = "root"
		}
		if h.Group == "" {
			h.Group = "default"
		}
		if h.Addr != "" && !hasPort(h.Addr) {
			h.Addr = h.Addr + ":22"
		}
	}
}

func hasPort(addr string) bool {
	// crude but enough for host:port / [ipv6]:port
	if len(addr) == 0 {
		return false
	}
	if addr[0] == '[' {
		return len(addr) > 2 && addr[len(addr)-1] != ']'
	}
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return true
		}
		if addr[i] == ']' {
			return false
		}
	}
	return false
}

func (c Config) Validate() error {
	seen := map[string]struct{}{}
	for _, h := range c.Hosts {
		if h.Name == "" {
			return errors.New("host name is required")
		}
		if h.Addr == "" {
			return fmt.Errorf("host %q: addr is required", h.Name)
		}
		if _, ok := seen[h.Name]; ok {
			return fmt.Errorf("duplicate host name %q", h.Name)
		}
		seen[h.Name] = struct{}{}
	}
	return nil
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
	example := `# sguala-cli config
refresh: 10s
timeout: 5s
workers: 8

hosts:
  # - name: web-01
  #   group: prod
  #   addr: 10.0.0.1:22
  #   user: deploy
  #   identity: ~/.ssh/id_ed25519
  #   proxy_jump: bastion   # optional: another host.name or user@host:port
`
	return os.WriteFile(path, []byte(example), 0o600)
}

func Write(path string, cfg Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
