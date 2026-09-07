package sshx

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
)

func writeTempKey(t *testing.T, dir, name string) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatal(err)
	}
	block := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, pem.EncodeToMemory(block), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestAuthMethods_explicitIdentity(t *testing.T) {
	dir := t.TempDir()
	idPath := writeTempKey(t, dir, "id_custom")
	t.Setenv("SSH_AUTH_SOCK", "")

	methods, closer, err := authMethods(idPath, "")
	if closer != nil {
		defer closer.Close()
	}
	if err != nil {
		t.Fatal(err)
	}
	// Exactly one AuthMethod: publickey (must not split agent/file into two).
	if len(methods) != 1 {
		t.Fatalf("methods=%d want 1", len(methods))
	}
}

func TestAuthMethods_defaultIdentitiesWhenNoConfig(t *testing.T) {
	home := t.TempDir()
	sshDir := filepath.Join(home, ".ssh")
	if err := os.MkdirAll(sshDir, 0o700); err != nil {
		t.Fatal(err)
	}
	writeTempKey(t, sshDir, "id_ed25519")

	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home) // windows
	t.Setenv("SSH_AUTH_SOCK", "")

	methods, closer, err := authMethods("", "")
	if closer != nil {
		defer closer.Close()
	}
	if err != nil {
		t.Fatal(err)
	}
	if len(methods) != 1 {
		t.Fatalf("methods=%d want 1", len(methods))
	}
}

func TestAuthMethods_identityAndPasswordStillOnePublicKey(t *testing.T) {
	dir := t.TempDir()
	idPath := writeTempKey(t, dir, "id_custom")
	t.Setenv("SSH_AUTH_SOCK", "")

	methods, closer, err := authMethods(idPath, "secret")
	if closer != nil {
		defer closer.Close()
	}
	if err != nil {
		t.Fatal(err)
	}
	// publickey + password + keyboard-interactive
	if len(methods) != 3 {
		t.Fatalf("methods=%d want 3", len(methods))
	}
}

func TestAuthMethods_noMethodsError(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("SSH_AUTH_SOCK", "")

	_, closer, err := authMethods("", "")
	if closer != nil {
		_ = closer.Close()
	}
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestLoadSigner(t *testing.T) {
	dir := t.TempDir()
	path := writeTempKey(t, dir, "k")
	s, err := loadSigner(path)
	if err != nil {
		t.Fatal(err)
	}
	if s == nil {
		t.Fatal("nil signer")
	}
}
