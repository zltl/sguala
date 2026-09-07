package sshconfig

import "testing"

func TestParseContent(t *testing.T) {
	content := `
Host *
  User root
  IdentityFile ~/.ssh/id_ed25519

Host bastion
  HostName 10.0.0.1
  User jump

Host web-01 *.internal
  HostName 10.0.0.2
  Port 2222
  User deploy
  ProxyJump bastion
  IdentityFile ~/.ssh/web

Host ignored
  # no hostname override
`
	hosts := ParseContentForTest(content)
	by := map[string]Host{}
	for _, h := range hosts {
		by[h.Name] = h
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
	bastion := by["bastion"]
	if bastion.User != "jump" || bastion.HostName != "10.0.0.1" {
		t.Fatalf("bastion=%+v", bastion)
	}
	// Host * User applies when not overridden
	ign := by["ignored"]
	if ign.User != "root" {
		t.Fatalf("ignored user=%s", ign.User)
	}
}
