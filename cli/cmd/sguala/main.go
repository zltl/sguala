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
		Long:  "sguala-cli monitors Linux hosts over SSH without agents. Default command opens the TUI.",
		RunE:  runTUI,
	}
	root.PersistentFlags().StringVar(&cfgPath, "config", "", "config file (default: $SGUALA_CONFIG or ~/.config/sguala/config.yaml)")

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
		Short: "Write an example config if missing",
		RunE: func(cmd *cobra.Command, args []string) error {
			path, err := resolveConfigPath()
			if err != nil {
				return err
			}
			if err := config.EnsureExample(path); err != nil {
				return err
			}
			fmt.Println("wrote", path)
			return nil
		},
	}

	root.AddCommand(checkCmd, versionCmd, initCmd)
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

func resolveConfigPath() (string, error) {
	if cfgPath != "" {
		return cfgPath, nil
	}
	return config.DefaultPath()
}

func loadOrHint() (config.Config, string, error) {
	path, err := resolveConfigPath()
	if err != nil {
		return config.Config{}, "", err
	}
	cfg, err := config.Load(path)
	if err != nil {
		if os.IsNotExist(err) {
			_ = config.EnsureExample(path)
			return config.Default(), path, nil
		}
		return config.Config{}, path, err
	}
	return cfg, path, nil
}

func runTUI(cmd *cobra.Command, args []string) error {
	cfg, path, err := loadOrHint()
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
	cfg, _, err := loadOrHint()
	if err != nil {
		return err
	}
	eng := engine.New(cfg, nil)
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout.Dur()*time.Duration(len(cfg.Hosts)+2)+time.Minute)
	defer cancel()
	eng.RunOnce(ctx)

	type out struct {
		FetchedAt time.Time         `json:"fetched_at"`
		Hosts     interface{}       `json:"hosts"`
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(out{
		FetchedAt: time.Now().UTC(),
		Hosts:     eng.Snapshots(),
	})
}