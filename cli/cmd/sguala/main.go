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
	"github.com/zltl/sguala/cli/internal/ui"
)

var (
	version = "0.1.0"
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

	root.AddCommand(checkCmd, versionCmd, initCmd)
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
