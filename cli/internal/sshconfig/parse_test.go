package sshconfig

import "testing"

func TestParseContent(t *testing.T) {
	content := `
Host *
  User root
  IdentityFile ~/.ssh/id_ed25519

# bastion tier
Host bastion
  HostName 10.0.0.1
  User jump

# === web ===
Host web-01 *.internal
  HostName 10.0.0.2
  Port 2222
  User deploy
  ProxyJump bastion
  IdentityFile ~/.ssh/web

Host ignored
  # no hostname override — indented, not a group
`
	hosts := ParseContentForTest(content)
	by := map[string]Host{}
	var order []string
	for _, h := range hosts {
		by[h.Name] = h
		order = append(order, h.Name)
	}
	if _, ok := by["*.internal"]; ok {
		t.Fatal("wildcard should be skipped")
	}
	web := by["web-01"]
	if web.HostName != "10.0.0.2" || web.Port != 2222 || web.User != "deploy" {
		t.Fatalf("web=%+v", web)
	}
	if web.ProxyJump != "bastion" {
		t.Fatalf("proxy=%s", web.ProxyJump)
	}
	if web.IdentityFile != "~/.ssh/web" {
		t.Fatalf("identity=%s", web.IdentityFile)
	}
	if web.Group != "web" {
		t.Fatalf("web group=%q", web.Group)
	}
	bastion := by["bastion"]
	if bastion.User != "jump" || bastion.HostName != "10.0.0.1" {
		t.Fatalf("bastion=%+v", bastion)
	}
	if bastion.Group != "bastion tier" {
		t.Fatalf("bastion group=%q", bastion.Group)
	}
	// Host * User applies when not overridden
	ign := by["ignored"]
	if ign.User != "root" {
		t.Fatalf("ignored user=%s", ign.User)
	}
	// Still under previous section; indented comment must not change group.
	if ign.Group != "web" {
		t.Fatalf("ignored group=%q", ign.Group)
	}
	wantOrder := []string{"bastion", "web-01", "ignored"}
	if len(order) != len(wantOrder) {
		t.Fatalf("order=%v want %v", order, wantOrder)
	}
	for i := range wantOrder {
		if order[i] != wantOrder[i] {
			t.Fatalf("order=%v want %v", order, wantOrder)
		}
	}
}

func TestParseGroupComment(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"# prod", "prod"},
		{"# === Staging ===", "Staging"},
		{"# [db]", "db"},
		{"# --- edge ---", "edge"},
		{"#", ""},
		{"# ===", ""},
		{"# Host disabled", ""},
		{"# Include foo", ""},
	}
	for _, c := range cases {
		if got := parseGroupComment(c.in); got != c.want {
			t.Fatalf("%q → %q want %q", c.in, got, c.want)
		}
	}
}
