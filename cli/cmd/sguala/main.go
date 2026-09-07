package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/engine"
	"github.com/zltl/sguala/cli/internal/secret"
	"github.com/zltl/sguala/cli/internal/ui"
	"github.com/zltl/sguala/cli/internal/xfer"
	"golang.org/x/term"
)

var (
	version = "0.2.0"
	cfgPath string
)

func main() {
	root := &cobra.Command{
		Use:   "sguala",
		Short: "Agentless SSH server monitor (TUI)",
		Long:  "sguala-cli monitors hosts defined in ~/.ssh/config. Optional settings YAML controls refresh/timeout/workers.",
		RunE:  runTUI,
	}
	root.PersistentFlags().StringVar(&cfgPath, "config", "", "settings file (default: $SGUALA_CONFIG or ~/.config/sguala/config.yaml)")

	checkCmd := &cobra.Command{
		Use:   "check",
		Short: "Collect metrics once and print JSON",
		RunE:  runCheck,
	}

	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "Print version",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("sguala-cli %s\n", version)
		},
	}

	initCmd := &cobra.Command{
		Use:   "init",
		Short: "Write settings YAML if missing (hosts stay in ~/.ssh/config)",
		RunE: func(cmd *cobra.Command, args []string) error {
			path, err := resolveSettingsPath()
			if err != nil {
				return err
			}
			if err := config.EnsureExample(path); err != nil {
				return err
			}
			sshPath, _ := config.DefaultSSHConfigPath()
			fmt.Println("wrote", path)
			fmt.Println("hosts are read from", sshPath)
			return nil
		},
	}

	getCmd := &cobra.Command{
		Use:   "get <alias> <remote> [local]",
		Short: "Download via system scp -r (OpenSSH config applies)",
		Args:  cobra.RangeArgs(2, 3),
		RunE: func(cmd *cobra.Command, args []string) error {
			local := "."
			if len(args) >= 3 {
				local = args[2]
			}
			extra, _ := cmd.Flags().GetStringArray("scp-arg")
			return xfer.Run("scp", xfer.SCPGetArgs(args[0], args[1], local, extra))
		},
	}
	getCmd.Flags().StringArray("scp-arg", nil, "extra arg passed to scp (repeatable)")

	putCmd := &cobra.Command{
		Use:   "put <alias> <local...> <remote>",
		Short: "Upload via system scp -r (OpenSSH config applies)",
		Args:  cobra.MinimumNArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			alias := args[0]
			remote := args[len(args)-1]
			locals := args[1 : len(args)-1]
			extra, _ := cmd.Flags().GetStringArray("scp-arg")
			scpArgs, err := xfer.SCPPutArgs(alias, locals, remote, extra)
			if err != nil {
				return err
			}
			return xfer.Run("scp", scpArgs)
		},
	}
	putCmd.Flags().StringArray("scp-arg", nil, "extra arg passed to scp (repeatable)")

	sftpCmd := &cobra.Command{
		Use:   "sftp <alias>",
		Short: "Interactive system sftp to Host alias",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return xfer.Run("sftp", xfer.SFTPArgs(args[0]))
		},
	}

	rsyncCmd := &cobra.Command{
		Use:   "rsync -- [rsync-args...]",
		Short: "Run system rsync with -e ssh (use alias:path like OpenSSH)",
		Args:  cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return fmt.Errorf("usage: sguala rsync -- -avz ./local alias:remote/")
			}
			return xfer.Run("rsync", xfer.RsyncArgs(args))
		},
	}

	passwdCmd := &cobra.Command{
		Use:   "passwd <alias>",
		Short: "Store SSH password for a Host alias (OS keyring, else chmod 0600 file)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			alias := args[0]
			del, _ := cmd.Flags().GetBool("delete")
			if del {
				b, err := secret.Delete(alias)
				if err != nil {
					return err
				}
				fmt.Printf("deleted password for %s (%s)\n", alias, b)
				return nil
			}
			fmt.Printf("Password for %s (empty cancels): ", alias)
			pwBytes, err := term.ReadPassword(int(os.Stdin.Fd()))
			fmt.Println()
			if err != nil {
				return err
			}
			pw := string(pwBytes)
			if pw == "" {
				fmt.Println("canceled")
				return nil
			}
			b, err := secret.Set(alias, pw)
			if err != nil {
				return err
			}
			kr, file := secret.Status()
			fmt.Printf("saved via %s\n", b)
			if b == secret.BackendFile {
				fmt.Printf("note: no usable OS keyring — wrote %s (mode 0600)\n", file)
			} else if kr {
				fmt.Printf("keyring ok; fallback file would be %s\n", file)
			}
			return nil
		},
	}
	passwdCmd.Flags().Bool("delete", false, "remove stored password")

	root.AddCommand(checkCmd, versionCmd, initCmd, getCmd, putCmd, sftpCmd, rsyncCmd, passwdCmd)
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

func resolveSettingsPath() (string, error) {
	if cfgPath != "" {
		return cfgPath, nil
	}
	return config.DefaultPath()
}

func loadRuntime() (config.Config, string, error) {
	path, err := resolveSettingsPath()
	if err != nil {
		return config.Config{}, "", err
	}
	// Ensure settings file exists for discoverability; hosts still come from SSH config.
	_ = config.EnsureExample(path)
	return config.LoadRuntime(path)
}

func runTUI(cmd *cobra.Command, args []string) error {
	cfg, path, err := loadRuntime()
	if err != nil {
		return err
	}
	eng := engine.New(cfg, nil)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	go eng.Loop(ctx)

	p := ui.Program(eng, path)
	_, err = p.Run()
	cancel()
	return err
}

func runCheck(cmd *cobra.Command, args []string) error {
	cfg, _, err := loadRuntime()
	if err != nil {
		return err
	}
	eng := engine.New(cfg, nil)
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout.Dur()*time.Duration(len(cfg.Hosts)+2)+time.Minute)
	defer cancel()
	eng.RunOnce(ctx)

	type out struct {
		FetchedAt time.Time   `json:"fetched_at"`
		Hosts     interface{} `json:"hosts"`
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(out{
		FetchedAt: time.Now().UTC(),
		Hosts:     eng.Snapshots(),
	})
}
