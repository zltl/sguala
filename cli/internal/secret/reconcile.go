package secret

import (
	"fmt"
	"strings"

	kr "github.com/zalando/go-keyring"
)

// HostRef identifies a concrete SSH Host for password rebinding.
type HostRef struct {
	Name string
	User string
	Addr string // host:port (port required; default 22 applied by Fingerprint)
}

// RenameResult describes one migrated password alias.
type RenameResult struct {
	From string
	To   string
}

// Fingerprint builds user@addr:port for matching hosts across Host alias renames.
// Addr may be "host" or "host:port"; missing port becomes :22. IPv6 in [brackets]:port is kept.
func Fingerprint(user, addr string) string {
	user = strings.ToLower(strings.TrimSpace(user))
	addr = strings.ToLower(strings.TrimSpace(addr))
	addr = ensureHostPort(addr)
	if user == "" && (addr == "" || addr == ":22") {
		return ""
	}
	return user + "@" + addr
}

func ensureHostPort(addr string) string {
	if addr == "" {
		return ""
	}
	// [ipv6]:port or [ipv6]
	if addr[0] == '[' {
		if strings.Contains(addr, "]:") {
			return addr
		}
		return addr + ":22"
	}
	// host:port — last colon (avoid mangling bare IPv6 without brackets)
	if i := strings.LastIndexByte(addr, ':'); i >= 0 {
		port := addr[i+1:]
		if port != "" && !strings.Contains(port, ":") {
			return addr
		}
	}
	return addr + ":22"
}

// Rename moves a stored password from oldAlias to newAlias (keyring + file).
// No-op if aliases match after normalize. Fails if newAlias already has a password
// (unless it is the same value).
func Rename(oldAlias, newAlias string) error {
	mu.Lock()
	defer mu.Unlock()
	oldAlias = normalizeAlias(oldAlias)
	newAlias = normalizeAlias(newAlias)
	if oldAlias == "" || newAlias == "" {
		return fmt.Errorf("empty host alias")
	}
	if oldAlias == newAlias {
		return nil
	}

	pw, _, err := getLocked(oldAlias)
	if err != nil {
		return err
	}
	if pw == "" {
		return fmt.Errorf("no password stored for %q", oldAlias)
	}
	existing, _, err := getLocked(newAlias)
	if err != nil {
		return err
	}
	if existing != "" && existing != pw {
		return fmt.Errorf("password already stored for %q", newAlias)
	}

	if _, err := setLocked(newAlias, pw); err != nil {
		return err
	}
	if _, err := deleteLocked(oldAlias); err != nil {
		return err
	}
	// Move binding entry if present.
	if s, ferr := readFile(); ferr == nil {
		changed := false
		if s.Bindings == nil {
			s.Bindings = map[string]string{}
		}
		if fp, ok := s.Bindings[oldAlias]; ok {
			s.Bindings[newAlias] = fp
			delete(s.Bindings, oldAlias)
			changed = true
		}
		if changed {
			_ = writeFile(s)
		}
	}
	return nil
}

// Reconcile rebinds passwords when Host aliases were renamed in ~/.ssh/config.
// Matching uses user@addr:port fingerprints recorded on the previous successful load.
// Safe to call on every host reload.
func Reconcile(current []HostRef) ([]RenameResult, error) {
	mu.Lock()
	defer mu.Unlock()

	s, err := readFile()
	if err != nil {
		return nil, err
	}
	if s.Bindings == nil {
		s.Bindings = map[string]string{}
	}
	prevBindings := s.Bindings

	currentNames := make(map[string]HostRef, len(current))
	fpToNew := map[string][]string{} // fingerprint → current aliases
	for _, h := range current {
		name := normalizeAlias(h.Name)
		if name == "" {
			continue
		}
		currentNames[name] = h
		fp := Fingerprint(h.User, h.Addr)
		if fp != "" {
			fpToNew[fp] = append(fpToNew[fp], name)
		}
	}

	var results []RenameResult
	// Candidate orphans: aliases that had a binding previously but are gone now,
	// or aliases that still have a password but no longer appear in SSH config.
	orphans := map[string]string{} // alias → fingerprint
	for alias, fp := range prevBindings {
		alias = normalizeAlias(alias)
		if alias == "" {
			continue
		}
		if _, ok := currentNames[alias]; ok {
			continue
		}
		orphans[alias] = fp
	}
	// Also consider password keys in the file that vanished from config.
	for alias := range s.Hosts {
		alias = normalizeAlias(alias)
		if alias == "" {
			continue
		}
		if _, ok := currentNames[alias]; ok {
			continue
		}
		if _, seen := orphans[alias]; !seen {
			orphans[alias] = prevBindings[alias]
		}
	}

	for oldAlias, fp := range orphans {
		pw, _, err := getLocked(oldAlias)
		if err != nil || pw == "" {
			continue
		}
		if fp == "" {
			continue
		}
		candidates := fpToNew[fp]
		// Prefer targets that do not already have a password.
		var free []string
		for _, cand := range candidates {
			existing, _, _ := getLocked(cand)
			if existing == "" {
				free = append(free, cand)
			}
		}
		if len(free) != 1 {
			continue
		}
		newAlias := free[0]
		if err := renameLocked(oldAlias, newAlias, pw); err != nil {
			continue
		}
		results = append(results, RenameResult{From: oldAlias, To: newAlias})
		// Update fp map so a second orphan cannot claim the same target.
		fpToNew[fp] = nil
	}

	// Refresh bindings from current hosts (after renames).
	next := make(map[string]string, len(currentNames))
	for name, h := range currentNames {
		fp := Fingerprint(h.User, h.Addr)
		if fp != "" {
			next[name] = fp
		}
	}
	// Keep bindings for orphan aliases that still have passwords (unmatched).
	for alias := range orphans {
		if _, ok := currentNames[alias]; ok {
			continue
		}
		pw, _, _ := getLocked(alias)
		if pw == "" {
			continue
		}
		if fp := prevBindings[alias]; fp != "" {
			next[alias] = fp
		}
	}
	s, err = readFile()
	if err != nil {
		return results, err
	}
	s.Bindings = next
	if err := writeFile(s); err != nil {
		return results, err
	}
	return results, nil
}

// Bind records user@addr:port for an alias (called when setting a password with host known).
func Bind(alias, user, addr string) error {
	mu.Lock()
	defer mu.Unlock()
	alias = normalizeAlias(alias)
	if alias == "" {
		return fmt.Errorf("empty host alias")
	}
	fp := Fingerprint(user, addr)
	if fp == "" {
		return nil
	}
	s, err := readFile()
	if err != nil {
		return err
	}
	if s.Bindings == nil {
		s.Bindings = map[string]string{}
	}
	s.Bindings[alias] = fp
	return writeFile(s)
}

func getLocked(alias string) (password string, backend Backend, err error) {
	alias = normalizeAlias(alias)
	if alias == "" {
		return "", BackendNone, fmt.Errorf("empty host alias")
	}
	if keyringOK() {
		pw, kerr := kr.Get(keyringService, keyringAccount(alias))
		if kerr == nil && pw != "" {
			return pw, BackendKeyring, nil
		}
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

func setLocked(alias, password string) (Backend, error) {
	alias = normalizeAlias(alias)
	if alias == "" {
		return BackendNone, fmt.Errorf("empty host alias")
	}
	if password == "" {
		return deleteLocked(alias)
	}
	if keyringOK() {
		if kerr := kr.Set(keyringService, keyringAccount(alias), password); kerr == nil {
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

// renameLocked assumes mu held; pw already read from oldAlias.
func renameLocked(oldAlias, newAlias, pw string) error {
	if _, err := setLocked(newAlias, pw); err != nil {
		return err
	}
	_, err := deleteLocked(oldAlias)
	return err
}
