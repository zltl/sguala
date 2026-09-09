package sshx

import (
	"bytes"
	"fmt"
	"io"
	"time"

	"golang.org/x/crypto/ssh"
)

// RunScript pipes script on stdin to `bash -s` (falls back handled by caller command).
func RunScript(client *ssh.Client, script string, timeout time.Duration) (string, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	stdin, err := session.StdinPipe()
	if err != nil {
		return "", err
	}

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- session.Run("bash -s")
	}()

	go func() {
		_, _ = io.WriteString(stdin, script)
		_ = stdin.Close()
	}()

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case err := <-errCh:
		out := stdout.String()
		if err != nil {
			if stderr.Len() > 0 {
				return out, fmt.Errorf("%w: %s", err, stderr.String())
			}
			return out, err
		}
		return out, nil
	case <-timer.C:
		_ = session.Close()
		return stdout.String(), fmt.Errorf("command timeout after %s", timeout)
	}
}
