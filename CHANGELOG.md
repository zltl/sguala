# Changelog

## [2.1.1] - unreleased

### Repo layout
- CLI is first-class at repo root (`cmd/`, `internal/`, `make build`); Electron moved to `desktop/`
- Module path: `github.com/zltl/sguala`

### Demo assets
- ASCII still / asciinema cast / animated SVG from `make demo` (`doc/tui.txt`, `doc/tui.cast`, `doc/tui.svg`)

### Pure Go SSH / SFTP
- Interactive `o`, `get` / `put` / `sftp`, and TUI `t` no longer shell out to OpenSSH
- Same dial stack as metrics: IdentityFile, agent, stored password, ProxyJump
- Removed `sguala rsync` (required system `ssh`)

### Password rebind on Host rename
- Stored passwords follow `Host` alias renames (matched by `user@addr:port` from the previous load)
- Manual: `sguala passwd --rename <old> <new>`
- Desktop: renaming a server moves the shared password entry

### Import / export bundle
- CLI: `sguala export|import` (dir or `.zip`), `--keys` / `--secrets`; `export-ssh` / `import-ssh`
- Desktop Settings: Export / Import Bundle (compatible format); legacy JSON kept

## [2.1.0] - 2026-09-07

### CLI

- Hosts from `~/.ssh/config` (groups via unindented `#` section comments)
- Auto-accept unknown host keys for list metrics; dynamic GROUP/HOST/ADDR columns
- File transfer: `sguala get|put|sftp|rsync` and TUI `t` (system `scp`/`sftp`/`rsync`)
- Password store: OS keyring with `host_passwords.json` fallback; TUI `p` / `sguala passwd`
- `e` opens `$EDITOR` at the selected Host line (Include-aware)
- Terminal title set on ssh / scp / sftp / edit (`ssh web-01`, …)

### Desktop

- SFTP: directory upload, new folder, rename, delete
- Passwords moved out of `sguala_2.json` into shared `host_passwords.json`
- SSH config import, quick-add, host search (earlier in 2.x line)

### Infra

- GitHub Actions: CI on push/PR; release workflow on `v*` tags (CLI binaries)

## [2.0.5] - unpublished desktop bump

- Package version alignment

## [2.0.4] - 2023-03-30

- Previous public desktop release (Windows installer / zip)
