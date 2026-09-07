package secret

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/zalando/go-keyring"
)

const (
	keyringService = "sguala"
	fileName       = "host_passwords.json"
	fileVersion    = 1
)

// Backend identifies where a secret was read from / written to.
type Backend string

const (
	BackendKeyring Backend = "keyring"
	BackendFile    Backend = "file"
	BackendNone    Backend = "none"
)

var (
	mu sync.Mutex
	// filePathOverride is used by tests.
	filePathOverride string
	// keyringDisabled forces file-only (tests / SGUALA_SECRET_FILE_ONLY=1).
	keyringDisabled bool
)

func init() {
	if os.Getenv("SGUALA_SECRET_FILE_ONLY") == "1" {
		keyringDisabled = true
	}
	if p := os.Getenv("SGUALA_PASSWORDS_FILE"); p != "" {
		filePathOverride = p
	}
}

// FilePath returns the fallback passwords file path.
func FilePath() (string, error) {
	if filePathOverride != "" {
		return filePathOverride, nil
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "sguala", fileName), nil
}

func keyringAccount(alias string) string {
	return "host:" + alias
}

type fileStore struct {
	Version int               `json:"version"`
	Hosts   map[string]string `json:"hosts"`
}

func readFile() (fileStore, error) {
	path, err := FilePath()
	if err != nil {
		return fileStore{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fileStore{Version: fileVersion, Hosts: map[string]string{}}, nil
		}
		return fileStore{}, err
	}
	var s fileStore
	if err := json.Unmarshal(data, &s); err != nil {
		return fileStore{}, err
	}
	if s.Hosts == nil {
		s.Hosts = map[string]string{}
	}
	if s.Version == 0 {
		s.Version = fileVersion
	}
	return s, nil
}

func writeFile(s fileStore) error {
	path, err := FilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	s.Version = fileVersion
	if s.Hosts == nil {
		s.Hosts = map[string]string{}
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func keyringOK() bool {
	return !keyringDisabled
}

// Get returns the password for a Host alias.
// Order: OS keyring (when available) → chmod 0600 fallback file.
func Get(alias string) (password string, backend Backend, err error) {
	mu.Lock()
	defer mu.Unlock()
	alias = normalizeAlias(alias)
	if alias == "" {
		return "", BackendNone, fmt.Errorf("empty host alias")
	}
	if keyringOK() {
		pw, kerr := keyring.Get(keyringService, keyringAccount(alias))
		if kerr == nil && pw != "" {
			return pw, BackendKeyring, nil
		}
		// ErrNotFound or unsupported backend → try file
	}
	s, ferr := readFile()
	if ferr != nil {
		return "", BackendNone, ferr
	}
	if pw, ok := s.Hosts[alias]; ok && pw != "" {
		return pw, BackendFile, nil
	}
	return "", BackendNone, nil
}

// Set stores a password. Prefers OS keyring; if that fails, uses the fallback file.
// When keyring succeeds, any file copy for this alias is removed (avoid plaintext leftover).
func Set(alias, password string) (backend Backend, err error) {
	mu.Lock()
	defer mu.Unlock()
	alias = normalizeAlias(alias)
	if alias == "" {
		return BackendNone, fmt.Errorf("empty host alias")
	}
	if password == "" {
		return deleteLocked(alias)
	}
	if keyringOK() {
		if kerr := keyring.Set(keyringService, keyringAccount(alias), password); kerr == nil {
			// Drop plaintext file copy if present.
			if s, ferr := readFile(); ferr == nil {
				if _, ok := s.Hosts[alias]; ok {
					delete(s.Hosts, alias)
					_ = writeFile(s)
				}
			}
			return BackendKeyring, nil
		}
	}
	s, ferr := readFile()
	if ferr != nil {
		return BackendNone, ferr
	}
	s.Hosts[alias] = password
	if err := writeFile(s); err != nil {
		return BackendNone, err
	}
	return BackendFile, nil
}

// Delete removes a stored password from keyring and file.
func Delete(alias string) (backend Backend, err error) {
	mu.Lock()
	defer mu.Unlock()
	return deleteLocked(alias)
}

func deleteLocked(alias string) (Backend, error) {
	alias = normalizeAlias(alias)
	if alias == "" {
		return BackendNone, fmt.Errorf("empty host alias")
	}
	var last Backend = BackendNone
	var errs []error
	if keyringOK() {
		if kerr := keyring.Delete(keyringService, keyringAccount(alias)); kerr == nil {
			last = BackendKeyring
		} else if !errors.Is(kerr, keyring.ErrNotFound) {
			// Backend missing is fine; keep going to file.
			errs = append(errs, kerr)
		}
	}
	s, ferr := readFile()
	if ferr != nil {
		errs = append(errs, ferr)
		if last == BackendNone && len(errs) > 0 {
			return BackendNone, errors.Join(errs...)
		}
		return last, nil
	}
	if _, ok := s.Hosts[alias]; ok {
		delete(s.Hosts, alias)
		if err := writeFile(s); err != nil {
			return last, err
		}
		last = BackendFile
	}
	return last, nil
}

// Has reports whether a non-empty password is stored.
func Has(alias string) bool {
	pw, _, err := Get(alias)
	return err == nil && pw != ""
}

func normalizeAlias(alias string) string {
	return strings.TrimSpace(alias)
}

// UseFileOnlyForTest disables keyring and points at a temp file. Returns cleanup.
func UseFileOnlyForTest(path string) (restore func()) {
	mu.Lock()
	oldPath := filePathOverride
	oldKR := keyringDisabled
	filePathOverride = path
	keyringDisabled = true
	mu.Unlock()
	return func() {
		mu.Lock()
		filePathOverride = oldPath
		keyringDisabled = oldKR
		mu.Unlock()
	}
}

// Status describes availability of backends (for docs / UI).
func Status() (keyringAvail bool, file string) {
	file, _ = FilePath()
	if !keyringOK() {
		return false, file
	}
	// Probe with a no-op get of a missing key: unsupported backends error distinctly.
	_, err := keyring.Get(keyringService, "host:__sguala_probe__")
	if err == nil || errors.Is(err, keyring.ErrNotFound) {
		return true, file
	}
	// Some backends return other errors when the service is missing.
	return false, file
}
