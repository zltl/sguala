# sguala-cli

sguala-cli is an **agentless** Linux host monitor with a terminal UI. It reads hosts from your **`~/.ssh/config`**, SSHes into them, scrapes CPU / memory / disk / load, and shows a live table.

It is a thin wrap around OpenSSH config — add or change hosts with `ssh` the way you already do; press `e` in the TUI to edit that file.

## Requirements

- Go 1.22+
- OpenSSH client (`ssh`) on PATH (key `o` opens a session via system `ssh`)
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
| `e` | Edit `~/.ssh/config` in `$EDITOR`, then reload |
| `?` | Help |
| `q` | Quit |

## Relation to the Electron app

| | Desktop (`src/`) | CLI (`cli/`) |
|--|------------------|--------------|
| UI | Electron + React | Bubble Tea TUI |
| Hosts | App JSON (`sguala_2.json`) | `~/.ssh/config` |
| Build | `npm start` / forge | `make -C cli build` |

## Develop

```bash
make test
make run
```
