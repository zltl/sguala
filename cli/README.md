# sguala-cli

sguala-cli is an **agentless** Linux host monitor with a terminal UI. It reads hosts from your **`~/.ssh/config`**, SSHes into them, scrapes CPU / memory / disk / load, and shows a live table.

It is a thin wrap around OpenSSH **config** — hosts still come from `~/.ssh/config`; press `e` in the TUI to edit that file. Interactive shell and file transfer use **pure Go** (`golang.org/x/crypto/ssh` + SFTP): IdentityFile, ssh-agent, ProxyJump, and stored passwords — no system `ssh`/`scp`/`sftp` binary required.

## Requirements

- Go 1.22+
- Keys / `ssh-agent` as configured in `~/.ssh/config` (or stored password via `passwd`)

**Not supported** (same as metrics dial): `ProxyCommand`, SOCKS, and other OpenSSH features beyond HostName / User / Port / IdentityFile / ProxyJump.

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

`o` opens an interactive shell over the same pure-Go dial path as metrics (alias lookup → Identity / agent / password → ProxyJump).

## File transfer

Transfers use in-process SFTP (recursive get/put):

```bash
# download remote → local (default local=.)
sguala get web-01 /var/log/app.log
sguala get web-01 /etc/nginx ./nginx-backup

# upload local → remote directory
sguala put web-01 ./deploy.tar.gz /tmp
sguala put web-01 ./a ./b /var/www/

# interactive sftp
sguala sftp web-01
```

In the TUI, select a host and press `t` for get / put / sftp.

## Import / export (bundle)

Cross-app backup format (`sguala-bundle`): `hosts.json` + optional keys/passwords + OpenSSH fragment.

```bash
# hosts only (safe to share / commit metadata)
sguala export ./backup.sguala.zip

# include IdentityFile private keys and stored passwords
sguala export ./full.sguala.zip --keys --secrets

# restore into ~/.ssh/config (+ keys under ~/.ssh/sguala-keys, passwords via secret store)
sguala import ./backup.sguala.zip
sguala import ./full.sguala.zip --overwrite

# OpenSSH fragment only
sguala export-ssh ./hosts.conf
sguala import-ssh ./hosts.conf
```

Desktop Settings has the same **Export / Import Bundle** (compatible with this format). Legacy JSON export remains available.

Default export **excludes** keys and passwords. Do not upload `--secrets` archives.

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

List metrics, interactive `o`, and `get`/`put`/`sftp` all use the stored password when key auth fails (same dial stack).

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
| `sguala get` | SFTP download (recursive) |
| `sguala put` | SFTP upload (recursive) |
| `sguala sftp` | Interactive SFTP shell |
| `sguala passwd` | Store / delete Host password (keyring or file) |
| `sguala export` | Export sguala-bundle (dir or `.zip`) |
| `sguala import` | Import bundle into `~/.ssh/config` |
| `sguala export-ssh` | Write OpenSSH config fragment |
| `sguala import-ssh` | Append OpenSSH fragment to config |
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
| `o` | Open interactive SSH (pure Go) to selected Host alias |
| `t` | Transfer (get / put / sftp) via pure-Go SFTP |
| `p` | Set / clear stored password for selected Host |
| `e` | Edit selected Host in `$EDITOR` (jumps to that entry; Include files supported), then reload |
| `?` | Help |
| `q` | Quit |

Terminal emulators that support OSC titles show `ssh <alias>` / `get <alias>` / `sftp <alias>` while a session is open, then restore `sguala`.

## Relation to the Electron app

| | Desktop (`src/`) | CLI (`cli/`) |
|--|------------------|--------------|
| UI | Electron + React | Bubble Tea TUI |
| Hosts | App JSON (`sguala_2.json`) | `~/.ssh/config` |
| Transfer | In-app SFTP (`ssh2`) | Pure Go SFTP |
| Build | `npm start` / forge | `make -C cli build` |

## Develop

```bash
make test
make run
```
