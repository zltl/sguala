# sguala-cli

sguala-cli is an **agentless** Linux host monitor with a terminal UI. It SSHes into your servers, scrapes CPU / memory / disk / load in one round-trip, and shows a live table. It lives next to the Electron desktop app but is fully independent — different binary, config, and build.

## Requirements

- Go 1.22+
- OpenSSH client (`ssh`) on PATH if you use key `o` to open a session
- SSH key or `ssh-agent` (password auth is supported but discouraged)
- Auth for metrics collection matches OpenSSH: configured `identity`, then `~/.ssh/id_*`, then `SSH_AUTH_SOCK`

## Quick start

```bash
cd cli
make tidy
make build
./bin/sguala init          # writes ~/.config/sguala/config.yaml
# edit the config, then:
./bin/sguala
```

Config path override:

```bash
export SGUALA_CONFIG=/path/to/config.yaml
./bin/sguala --config /path/to/config.yaml
```

## Config example

```yaml
refresh: 10s
timeout: 5s
workers: 8

hosts:
  - name: web-01
    group: prod
    addr: 10.0.0.1:22
    user: deploy
    identity: ~/.ssh/id_ed25519
    # proxy_jump: bastion   # another hosts[].name or user@host:port
```

File mode should be `0600`. Prefer `identity` / `SSH_AUTH_SOCK` over `password`.

## Commands

| Command | Description |
|---------|-------------|
| `sguala` | Open TUI (default) |
| `sguala check` | One-shot JSON metrics |
| `sguala init` | Write example config if missing |
| `sguala version` | Print version |

## TUI keys

| Key | Action |
|-----|--------|
| `j` / `k` | Move |
| `Enter` | Host detail |
| `Esc` | Back |
| `r` | Refresh now |
| `/` | Search hosts (name / group / addr / user); Esc clears |
| `s` | Cycle sort (config/cpu/mem/disk/lat) |
| `o` | Open system `ssh` to selected host |
| `e` | Edit config in `$EDITOR` |
| `?` | Help |
| `q` | Quit |

## Relation to the Electron app

| | Desktop (`src/`) | CLI (`cli/`) |
|--|------------------|--------------|
| UI | Electron + React | Bubble Tea TUI |
| Config | `sguala_2.json` in Electron userData | `~/.config/sguala/config.yaml` |
| Build | `npm start` / forge | `make -C cli build` |

Building or running the CLI does **not** change the desktop app. Root `npm` scripts are unchanged except for an optional `cli:build` helper.

## Develop

```bash
make test
make run
```
