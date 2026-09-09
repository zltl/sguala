## sguala

Agentless Linux monitor — **CLI / TUI** (primary) + optional desktop.

### CLI
- Hosts from `~/.ssh/config` with `#` comment groups
- Pure-Go interactive SSH and SFTP (`get` / `put` / `sftp`, TUI `t`)
- Password store: OS keyring or `~/.config/sguala/host_passwords.json`
- Jump to Host in `$EDITOR` (`e`); terminal titles on connect
- Bundle: `sguala export|import` (+ optional `--keys` / `--secrets`)

### Desktop (optional)
- Electron UI under `desktop/`
- SFTP mkdir / rename / delete / directory upload
- Passwords stored in shared file (not server JSON)
- Compatible Export / Import Bundle

### Assets
CLI binaries below (`linux` / `darwin` / `windows` × `amd64` / `arm64`). See [CHANGELOG](https://github.com/zltl/sguala/blob/main/CHANGELOG.md).

Docs: [README](https://github.com/zltl/sguala#readme) · [CLI reference](https://github.com/zltl/sguala/blob/main/doc/cli.md)
