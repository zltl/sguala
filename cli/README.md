# sguala-cli

sguala-cli is an **agentless** Linux host monitor with a terminal UI. It reads hosts from your **`~/.ssh/config`**, SSHes into them, scrapes CPU / memory / disk / load, and shows a live table.

It is a thin wrap around OpenSSH config — add or change hosts with `ssh` the way you already do; press `e` in the TUI to edit that file. File transfer uses system `scp` / `sftp` / `rsync` so ProxyJump and the rest of OpenSSH apply.

## Requirements

- Go 1.22+
- OpenSSH client (`ssh`, `scp`, `sftp`) on PATH
- Optional: `rsync` for `sguala rsync`
- Keys / `ssh-agent` as configured in `~/.ssh/config`

## Quick start

```bash
cd cli
make tidy
make build
# ensure ~/.ssh/config has Host entries, then:
./bin/sguala
```

Optional settings (refresh interval, etc.):

```bash
./bin/sguala init          # writes ~/.config/sguala/config.yaml if missing
./bin/sguala --config /path/to/settings.yaml
```

## Hosts: `~/.ssh/config`

Concrete `Host` aliases are monitored (wildcards like `Host *` are skipped). Supported fields:

- `HostName`, `User`, `Port`, `IdentityFile`, `ProxyJump`
- `Include` files
- **Groups**: an unindented `# comment` before Host blocks becomes a section header in the TUI (config sort). Examples:

```sshconfig
# production
Host web-01
  HostName 10.0.0.1

# === staging ===
Host web-stg
  HostName 10.0.0.2
```

Indented comments inside a Host block are ignored for grouping. Disabled-looking lines like `# Host old` are not groups.

`o` runs `ssh <alias>` so OpenSSH applies the rest of your config.

## File transfer

All transfers shell out to OpenSSH / rsync (same config as interactive `ssh`):

```bash
# download remote → local (default local=.)
sguala get web-01 /var/log/app.log
sguala get web-01 /etc/nginx ./nginx-backup

# upload local → remote directory
sguala put web-01 ./deploy.tar.gz /tmp
sguala put web-01 ./a ./b /var/www/

# interactive sftp
sguala sftp web-01

# rsync (injects -e ssh unless you pass -e yourself)
sguala rsync -- -avz ./dist/ web-01:/var/www/app/
```

In the TUI, select a host and press `t` for get / put / sftp.

## Password auth

OpenSSH config cannot store passwords. For password-only hosts:

1. Prefer switching to a key / `ssh-agent` when possible.
2. Store a password keyed by Host alias:
   - **OS keyring** when available (macOS Keychain, Windows Credential Manager, Linux Secret Service)
   - otherwise **`~/.config/sguala/host_passwords.json`** (mode `0600`) — used on headless Linux and anywhere the keyring is missing
3. Set via TUI `p`, or:

```bash
sguala passwd web-01
sguala passwd --delete web-01
```

List metrics (`sshx`) and jump hosts read this store automatically. Interactive `o` / `scp` / `sftp` still use system OpenSSH (TTY prompt); they do not inject the stored password.

Force file-only backend: `SGUALA_SECRET_FILE_ONLY=1`. Override file path: `SGUALA_PASSWORDS_FILE=/path/to.json`.

The desktop app uses the same passwords file (by server name) and no longer keeps new passwords in `sguala_2.json`.

## Settings YAML (optional)

Default path: `$SGUALA_CONFIG` or `~/.config/sguala/config.yaml`

```yaml
refresh: 10s
timeout: 5s
workers: 8
# ssh_config: ~/.ssh/config   # override path if needed
```

Legacy `hosts:` lists in this file are ignored.

## Commands

| Command | Description |
|---------|-------------|
| `sguala` | Open TUI (default) |
| `sguala check` | One-shot JSON metrics |
| `sguala get` | `scp -r` download |
| `sguala put` | `scp -r` upload |
| `sguala sftp` | Interactive `sftp` |
| `sguala rsync` | `rsync -e ssh …` |
| `sguala passwd` | Store / delete Host password (keyring or file) |
| `sguala init` | Write settings YAML if missing |
| `sguala version` | Print version |

## TUI keys

| Key | Action |
|-----|--------|
| `j` / `k` | Move |
| `Enter` | Host detail |
| `Esc` | Back / clear search |
| `r` | Refresh now |
| `/` | Search hosts (name / group / user / addr) |
| `s` | Cycle sort (config/cpu/mem/disk/lat) |
| `o` | Open system `ssh` to selected Host alias |
| `t` | Transfer (get / put / sftp) via system tools |
| `p` | Set / clear stored password for selected Host |
| `e` | Edit selected Host in `$EDITOR` (jumps to that entry; Include files supported), then reload |
| `?` | Help |
| `q` | Quit |

Terminal emulators that support OSC titles show `ssh <alias>` / `scp <alias>` / `sftp <alias>` while a session is open, then restore `sguala`.

## Relation to the Electron app

| | Desktop (`src/`) | CLI (`cli/`) |
|--|------------------|--------------|
| UI | Electron + React | Bubble Tea TUI |
| Hosts | App JSON (`sguala_2.json`) | `~/.ssh/config` |
| Transfer | In-app SFTP (`ssh2`) | System `scp`/`sftp`/`rsync` |
| Build | `npm start` / forge | `make -C cli build` |

## Develop

```bash
make test
make run
```
