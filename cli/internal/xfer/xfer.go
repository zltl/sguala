package xfer

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// RemoteSpec builds OpenSSH scp/sftp remote path "alias:path".
func RemoteSpec(alias, remotePath string) string {
	alias = strings.TrimSpace(alias)
	remotePath = strings.TrimSpace(remotePath)
	if remotePath == "" {
		remotePath = "."
	}
	return alias + ":" + remotePath
}

// SCPGetArgs builds: scp -r [-- extra...] alias:remote local
func SCPGetArgs(alias, remote, local string, extra []string) []string {
	if strings.TrimSpace(local) == "" {
		local = "."
	}
	args := []string{"-r"}
	args = append(args, extra...)
	args = append(args, RemoteSpec(alias, remote), local)
	return args
}

// SCPPutArgs builds: scp -r [-- extra...] local... alias:remote
func SCPPutArgs(alias string, locals []string, remote string, extra []string) ([]string, error) {
	if len(locals) == 0 {
		return nil, fmt.Errorf("at least one local path is required")
	}
	for _, p := range locals {
		if strings.TrimSpace(p) == "" {
			return nil, fmt.Errorf("empty local path")
		}
	}
	if strings.TrimSpace(remote) == "" {
		remote = "."
	}
	args := []string{"-r"}
	args = append(args, extra...)
	args = append(args, locals...)
	args = append(args, RemoteSpec(alias, remote))
	return args, nil
}

// SFTPArgs builds: sftp alias
func SFTPArgs(alias string) []string {
	return []string{strings.TrimSpace(alias)}
}

// RsyncArgs prepends -e ssh unless the user already set -e.
func RsyncArgs(userArgs []string) []string {
	hasE := false
	for _, a := range userArgs {
		if a == "-e" || strings.HasPrefix(a, "--rsh") || strings.HasPrefix(a, "-e") {
			hasE = true
			break
		}
	}
	out := make([]string, 0, len(userArgs)+2)
	if !hasE {
		out = append(out, "-e", "ssh")
	}
	out = append(out, userArgs...)
	return out
}

// RequireTool returns an error if name is not on PATH.
func RequireTool(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return fmt.Errorf("%s not found on PATH (install OpenSSH client / rsync)", name)
	}
	return nil
}

// Run attaches stdio and runs name with args; returns the process exit error.
func Run(name string, args []string) error {
	if err := RequireTool(name); err != nil {
		return err
	}
	title := name
	if len(args) > 0 {
		title = name + " " + args[0]
		// scp: prefer alias from remoteSpec (last arg often alias:path for put)
		for i := len(args) - 1; i >= 0; i-- {
			if a, _, ok := splitRemoteSpec(args[i]); ok {
				title = name + " " + a
				break
			}
		}
	}
	setCLITitle(title)
	defer setCLITitle("sguala")
	cmd := exec.Command(name, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func splitRemoteSpec(s string) (alias, path string, ok bool) {
	// alias:path — skip URLs and Windows drive letters
	i := strings.IndexByte(s, ':')
	if i <= 0 {
		return "", "", false
	}
	alias = s[:i]
	if strings.Contains(alias, "/") || strings.Contains(alias, `\`) {
		return "", "", false
	}
	return alias, s[i+1:], true
}

func setCLITitle(title string) {
	title = strings.Map(func(r rune) rune {
		switch r {
		case '\x1b', '\a', '\n', '\r', '\x00':
			return -1
		default:
			return r
		}
	}, title)
	title = strings.TrimSpace(title)
	if title == "" {
		return
	}
	if len(title) > 120 {
		title = title[:120]
	}
	_, _ = fmt.Fprintf(os.Stdout, "\033]0;%s\007", title)
}

// SplitLocalPaths splits a user-entered path list on whitespace.
// Paths with spaces are not supported in the TUI prompt (use CLI quoting instead).
func SplitLocalPaths(s string) []string {
	fields := strings.Fields(strings.TrimSpace(s))
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if f != "" {
			out = append(out, f)
		}
	}
	return out
}
