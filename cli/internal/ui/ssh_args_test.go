package ui

import (
	"reflect"
	"testing"

	"github.com/zltl/sguala/cli/internal/config"
)

func TestBuildSSHArgs_customPort(t *testing.T) {
	cfg := config.Config{}
	h := config.Host{
		Name: "box",
		User: "root",
		Addr: "10.18.50.20:3333",
	}
	got := buildSSHArgs(cfg, h)
	want := []string{"-p", "3333", "root@10.18.50.20"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
}

func TestBuildSSHArgs_defaultPort(t *testing.T) {
	cfg := config.Config{}
	h := config.Host{
		Name: "box",
		User: "deploy",
		Addr: "example.com:22",
	}
	got := buildSSHArgs(cfg, h)
	want := []string{"deploy@example.com"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
}

func TestBuildSSHArgs_identityAndJump(t *testing.T) {
	cfg := config.Config{
		Hosts: []config.Host{
			{Name: "bastion", User: "jump", Addr: "1.2.3.4:2222"},
		},
	}
	h := config.Host{
		Name:      "box",
		User:      "root",
		Addr:      "10.0.0.5:3333",
		Identity:  "/tmp/id",
		ProxyJump: "bastion",
	}
	got := buildSSHArgs(cfg, h)
	want := []string{"-i", "/tmp/id", "-J", "jump@1.2.3.4:2222", "-p", "3333", "root@10.0.0.5"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v want %#v", got, want)
	}
}

func TestSplitHostPort(t *testing.T) {
	host, port := splitHostPort("10.18.50.20:3333")
	if host != "10.18.50.20" || port != "3333" {
		t.Fatalf("got %s %s", host, port)
	}
	host, port = splitHostPort("[2001:db8::1]:2222")
	if host != "2001:db8::1" || port != "2222" {
		t.Fatalf("got %s %s", host, port)
	}
}
