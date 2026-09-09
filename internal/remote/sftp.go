package remote

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// Get downloads remotePath to localPath (file or recursive directory).
func Get(client *ssh.Client, remotePath, localPath string) error {
	sc, err := sftp.NewClient(client)
	if err != nil {
		return err
	}
	defer sc.Close()
	return getWithClient(sc, remotePath, localPath)
}

// Put uploads local paths into remoteDir (recursive for directories).
func Put(client *ssh.Client, locals []string, remoteDir string) error {
	if len(locals) == 0 {
		return fmt.Errorf("no local paths")
	}
	sc, err := sftp.NewClient(client)
	if err != nil {
		return err
	}
	defer sc.Close()
	return putWithClient(sc, locals, remoteDir)
}

func getFile(sc *sftp.Client, remote, local string) error {
	if err := os.MkdirAll(filepath.Dir(local), 0o755); err != nil {
		return err
	}
	rf, err := sc.Open(remote)
	if err != nil {
		return err
	}
	defer rf.Close()
	lf, err := os.Create(local)
	if err != nil {
		return err
	}
	defer lf.Close()
	_, err = io.Copy(lf, rf)
	if err == nil {
		fmt.Fprintf(os.Stderr, "get %s -> %s\n", remote, local)
	}
	return err
}

func getDir(sc *sftp.Client, remote, local string) error {
	if err := os.MkdirAll(local, 0o755); err != nil {
		return err
	}
	entries, err := sc.ReadDir(remote)
	if err != nil {
		return err
	}
	for _, e := range entries {
		r := path.Join(remote, e.Name())
		l := filepath.Join(local, e.Name())
		if e.IsDir() {
			if err := getDir(sc, r, l); err != nil {
				return err
			}
		} else {
			if err := getFile(sc, r, l); err != nil {
				return err
			}
		}
	}
	return nil
}

func putFile(sc *sftp.Client, local, remote string) error {
	_ = sc.MkdirAll(path.Dir(remote))
	lf, err := os.Open(local)
	if err != nil {
		return err
	}
	defer lf.Close()
	rf, err := sc.Create(remote)
	if err != nil {
		return err
	}
	defer rf.Close()
	_, err = io.Copy(rf, lf)
	if err == nil {
		fmt.Fprintf(os.Stderr, "put %s -> %s\n", local, remote)
	}
	return err
}

func putDir(sc *sftp.Client, local, remote string) error {
	if err := sc.MkdirAll(remote); err != nil {
		return err
	}
	entries, err := os.ReadDir(local)
	if err != nil {
		return err
	}
	for _, e := range entries {
		l := filepath.Join(local, e.Name())
		r := path.Join(remote, e.Name())
		if e.IsDir() {
			if err := putDir(sc, l, r); err != nil {
				return err
			}
		} else {
			if err := putFile(sc, l, r); err != nil {
				return err
			}
		}
	}
	return nil
}

// InteractiveSFTP is a minimal line-oriented SFTP shell.
func InteractiveSFTP(client *ssh.Client) error {
	sc, err := sftp.NewClient(client)
	if err != nil {
		return err
	}
	defer sc.Close()

	cwd, err := sc.Getwd()
	if err != nil {
		cwd = "."
	}
	fmt.Fprintf(os.Stderr, "sftp (pure Go) — ls cd pwd get put mkdir rm exit\n")

	scanner := bufio.NewScanner(os.Stdin)
	for {
		fmt.Printf("sftp %s> ", cwd)
		if !scanner.Scan() {
			if err := scanner.Err(); err != nil {
				return err
			}
			return nil
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		cmd := fields[0]
		args := fields[1:]
		switch cmd {
		case "exit", "quit", "bye", "q":
			return nil
		case "pwd":
			fmt.Println(cwd)
		case "cd":
			target := cwd
			if len(args) > 0 {
				target = resolveRemote(cwd, args[0])
			} else if home, e := sc.Getwd(); e == nil {
				target = home
			}
			if st, e := sc.Stat(target); e != nil || !st.IsDir() {
				fmt.Fprintf(os.Stderr, "cd: not a directory: %s\n", target)
				continue
			}
			cwd = target
		case "ls", "ll":
			dir := cwd
			if len(args) > 0 {
				dir = resolveRemote(cwd, args[0])
			}
			entries, e := sc.ReadDir(dir)
			if e != nil {
				fmt.Fprintf(os.Stderr, "ls: %v\n", e)
				continue
			}
			for _, e := range entries {
				mark := ""
				if e.IsDir() {
					mark = "/"
				}
				fmt.Printf("%s%s\n", e.Name(), mark)
			}
		case "mkdir":
			if len(args) < 1 {
				fmt.Fprintln(os.Stderr, "usage: mkdir <path>")
				continue
			}
			if e := sc.MkdirAll(resolveRemote(cwd, args[0])); e != nil {
				fmt.Fprintf(os.Stderr, "mkdir: %v\n", e)
			}
		case "rm", "rmdir":
			if len(args) < 1 {
				fmt.Fprintln(os.Stderr, "usage: rm <path>")
				continue
			}
			p := resolveRemote(cwd, args[0])
			if e := sc.Remove(p); e != nil {
				if e2 := sc.RemoveAll(p); e2 != nil {
					fmt.Fprintf(os.Stderr, "rm: %v\n", e)
				}
			}
		case "get":
			if len(args) < 1 {
				fmt.Fprintln(os.Stderr, "usage: get <remote> [local]")
				continue
			}
			remote := resolveRemote(cwd, args[0])
			local := "."
			if len(args) >= 2 {
				local = args[1]
			}
			if e := getWithClient(sc, remote, local); e != nil {
				fmt.Fprintf(os.Stderr, "get: %v\n", e)
			}
		case "put":
			if len(args) < 1 {
				fmt.Fprintln(os.Stderr, "usage: put <local> [remote-dir]")
				continue
			}
			remote := cwd
			if len(args) >= 2 {
				remote = resolveRemote(cwd, args[1])
			}
			if e := putWithClient(sc, []string{args[0]}, remote); e != nil {
				fmt.Fprintf(os.Stderr, "put: %v\n", e)
			}
		case "help", "?":
			fmt.Println("ls | cd | pwd | get <remote> [local] | put <local> [remote] | mkdir | rm | exit")
		default:
			fmt.Fprintf(os.Stderr, "unknown command %q (help for list)\n", cmd)
		}
	}
}

func getWithClient(sc *sftp.Client, remotePath, localPath string) error {
	if strings.TrimSpace(localPath) == "" {
		localPath = "."
	}
	st, err := sc.Stat(remotePath)
	if err != nil {
		return err
	}
	if st.IsDir() {
		base := filepath.Base(filepath.Clean(remotePath))
		if base == "." || base == string(filepath.Separator) {
			base = "download"
		}
		dest := localPath
		if fi, e := os.Stat(localPath); e == nil && fi.IsDir() {
			dest = filepath.Join(localPath, base)
		}
		return getDir(sc, remotePath, dest)
	}
	dest := localPath
	if fi, e := os.Stat(localPath); e == nil && fi.IsDir() {
		dest = filepath.Join(localPath, filepath.Base(remotePath))
	}
	return getFile(sc, remotePath, dest)
}

func putWithClient(sc *sftp.Client, locals []string, remoteDir string) error {
	if strings.TrimSpace(remoteDir) == "" {
		remoteDir = "."
	}
	for _, local := range locals {
		st, err := os.Stat(local)
		if err != nil {
			return err
		}
		remote := path.Join(filepath.ToSlash(remoteDir), filepath.Base(local))
		if st.IsDir() {
			if err := putDir(sc, local, remote); err != nil {
				return err
			}
		} else if err := putFile(sc, local, remote); err != nil {
			return err
		}
	}
	return nil
}

func resolveRemote(cwd, p string) string {
	if p == "" {
		return cwd
	}
	if strings.HasPrefix(p, "/") {
		return path.Clean(p)
	}
	return path.Clean(path.Join(cwd, p))
}
