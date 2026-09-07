package metric

import (
	_ "embed"
	"fmt"
	"strings"
	"time"

	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/secret"
	"github.com/zltl/sguala/cli/internal/sshx"
	"golang.org/x/crypto/ssh"
)

//go:embed remote_stat.sh
var remoteStatScript string

// Collect connects (optionally via jump), runs the embedded script, parses Snapshot.
func Collect(cfg config.Config, host config.Host, jumpClient *ssh.Client) Snapshot {
	start := time.Now()
	pw, _, _ := secret.Get(host.Name)
	client, err := sshx.Dial(sshx.DialOptions{
		Addr:     host.Addr,
		User:     host.User,
		Identity: host.Identity,
		Password: pw,
		Timeout:  cfg.Timeout.Dur(),
		Jump:     jumpClient,
	})
	if err != nil {
		return Offline(host.Name, host.Group, err)
	}
	defer client.Close()

	out, err := sshx.RunScript(client, remoteStatScript, cfg.Timeout.Dur()+3*time.Second)
	if err != nil {
		return Offline(host.Name, host.Group, fmt.Errorf("%w: %s", err, trimErr(out)))
	}
	snap, err := ParseRemoteStat(out)
	if err != nil {
		return Offline(host.Name, host.Group, fmt.Errorf("%w: %s", err, trimErr(out)))
	}
	snap.Host = host.Name
	snap.Group = host.Group
	snap.Latency = time.Since(start)
	snap.FetchedAt = time.Now()
	snap.Online = true
	return snap
}

func trimErr(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 200 {
		return s[:200] + "…"
	}
	return s
}
