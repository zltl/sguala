# sguala

Agentless Linux server monitor — **Electron desktop** and **Go TUI/CLI**. No agent on the host: connect over SSH, scrape CPU / memory / disk / load.

![screenshot](./doc/over.png)

## Downloads

See **[Releases](https://github.com/zltl/sguala/releases)** for:

- Desktop installers (when published)
- `sguala` CLI binaries (`linux` / `darwin` / `windows`, `amd64` / `arm64`)

## Desktop (Electron)

Cross-platform UI with server groups, live cards, remote shell, and SFTP.

```bash
npm install
npm start          # development
npm run make       # package / installers (electron-forge)
```

Config: app userData `sguala_2.json`. Password-auth hosts store secrets in the shared passwords file (see below), not in plaintext JSON going forward.

Features include quick-add (`user@host`), SSH config import, hop servers, and SFTP (upload files/dirs, mkdir / rename / delete).

## CLI / TUI

Independent Go client under [`cli/`](./cli/). Hosts come from **`~/.ssh/config`** (not the desktop JSON).

```bash
make -C cli build
./cli/bin/sguala init
./cli/bin/sguala
```

Highlights:

- Live metrics table; `/` search; groups from `# section` comments in SSH config
- `o` open system `ssh`; `e` edit config at the selected Host; `t` transfer; `p` password store
- `sguala get|put|sftp|rsync` via system OpenSSH / rsync (ProxyJump etc. work)
- Terminal title set on connect (`ssh web-01`, …)

Full reference: **[cli/README.md](./cli/README.md)**.

### Password storage (CLI + desktop)

| Backend | When |
|---------|------|
| OS keyring | macOS / Windows / Linux Secret Service (CLI preferred) |
| `~/.config/sguala/host_passwords.json` (mode `0600`) | Fallback when keyring is missing (headless Linux, etc.) |

```bash
sguala passwd <Host-alias>
```

## CI / release

- Push / PR → GitHub Actions runs CLI tests and build
- Tag `v*` → builds multi-platform CLI binaries and publishes a GitHub Release

```bash
git tag v2.1.0
git push origin v2.1.0
```

## License

GPL-3.0
