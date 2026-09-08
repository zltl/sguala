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
	"github.com/zltl/sguala/cli/internal/bundle"
	"github.com/zltl/sguala/cli/internal/config"
	"github.com/zltl/sguala/cli/internal/engine"
	"github.com/zltl/sguala/cli/internal/remote"
	"github.com/zltl/sguala/cli/internal/secret"
	"github.com/zltl/sguala/cli/internal/ui"
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
		Short: "Download via pure-Go SFTP (ProxyJump / Identity / stored password)",
		Args:  cobra.RangeArgs(2, 3),
		RunE: func(cmd *cobra.Command, args []string) error {
			local := "."
			if len(args) >= 3 {
				local = args[2]
			}
			cfg, _, err := loadRuntime()
			if err != nil {
				return err
			}
			client, cleanup, err := remote.DialByName(cfg, args[0])
			if err != nil {
				return err
			}
			defer cleanup()
			return remote.Get(client, args[1], local)
		},
	}

	putCmd := &cobra.Command{
		Use:   "put <alias> <local...> <remote>",
		Short: "Upload via pure-Go SFTP (ProxyJump / Identity / stored password)",
		Args:  cobra.MinimumNArgs(3),
		RunE: func(cmd *cobra.Command, args []string) error {
			alias := args[0]
			remoteDir := args[len(args)-1]
			locals := args[1 : len(args)-1]
			cfg, _, err := loadRuntime()
			if err != nil {
				return err
			}
			client, cleanup, err := remote.DialByName(cfg, alias)
			if err != nil {
				return err
			}
			defer cleanup()
			return remote.Put(client, locals, remoteDir)
		},
	}

	sftpCmd := &cobra.Command{
		Use:   "sftp <alias>",
		Short: "Interactive pure-Go SFTP to Host alias",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _, err := loadRuntime()
			if err != nil {
				return err
			}
			client, cleanup, err := remote.DialByName(cfg, args[0])
			if err != nil {
				return err
			}
			defer cleanup()
			return remote.InteractiveSFTP(client)
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

	exportCmd := &cobra.Command{
		Use:   "export <path>",
		Short: "Export hosts to a sguala-bundle directory or .zip",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _, err := loadRuntime()
			if err != nil {
				return err
			}
			keys, _ := cmd.Flags().GetBool("keys")
			secrets, _ := cmd.Flags().GetBool("secrets")
			opt := bundle.ExportOptions{
				IncludeKeys:    keys,
				IncludeSecrets: secrets,
				AppVersion:     version,
			}
			if err := bundle.ExportFromCLI(args[0], cfg, opt); err != nil {
				return err
			}
			fmt.Println("exported", args[0])
			if !keys && !secrets {
				fmt.Println("tip: add --keys / --secrets for private keys and passwords")
			}
			return nil
		},
	}
	exportCmd.Flags().Bool("keys", false, "include private keys from IdentityFile")
	exportCmd.Flags().Bool("secrets", false, "include stored passwords")

	importCmd := &cobra.Command{
		Use:   "import <path>",
		Short: "Import a sguala-bundle into ~/.ssh/config (and optional keys/passwords)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _, err := loadRuntime()
			if err != nil {
				return err
			}
			overwrite, _ := cmd.Flags().GetBool("overwrite")
			keys, _ := cmd.Flags().GetBool("keys")
			secrets, _ := cmd.Flags().GetBool("secrets")
			// default: apply keys/secrets when present in bundle
			if !cmd.Flags().Changed("keys") {
				keys = true
			}
			if !cmd.Flags().Changed("secrets") {
				secrets = true
			}
			res, err := bundle.ImportToCLI(args[0], cfg, bundle.ImportOptions{
				Overwrite:      overwrite,
				IncludeKeys:    keys,
				IncludeSecrets: secrets,
			})
			if err != nil {
				return err
			}
			fmt.Printf("added=%d updated=%d skipped=%d keys=%d secrets=%d\n",
				res.Added, res.Updated, res.Skipped, res.Keys, res.Secrets)
			for _, w := range res.Warnings {
				fmt.Println("warning:", w)
			}
			return nil
		},
	}
	importCmd.Flags().Bool("overwrite", false, "append Host blocks even if alias exists")
	importCmd.Flags().Bool("keys", true, "install keys from bundle when present")
	importCmd.Flags().Bool("secrets", true, "import passwords when present")

	exportSSHCmd := &cobra.Command{
		Use:   "export-ssh <path>",
		Short: "Write an OpenSSH config fragment from current hosts",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _, err := loadRuntime()
			if err != nil {
				return err
			}
			if err := bundle.ExportSSHFragment(args[0], cfg); err != nil {
				return err
			}
			fmt.Println("wrote", args[0])
			return nil
		},
	}

	importSSHCmd := &cobra.Command{
		Use:   "import-ssh <path>",
		Short: "Append an OpenSSH fragment into ~/.ssh/config",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, _, err := loadRuntime()
			if err != nil {
				return err
			}
			sshPath, err := cfg.ResolvedSSHConfig()
			if err != nil {
				return err
			}
			if err := bundle.ImportSSHFragment(args[0], sshPath); err != nil {
				return err
			}
			fmt.Println("appended into", sshPath)
			return nil
		},
	}

	root.AddCommand(checkCmd, versionCmd, initCmd, getCmd, putCmd, sftpCmd, passwdCmd,
		exportCmd, importCmd, exportSSHCmd, importSSHCmd)
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
