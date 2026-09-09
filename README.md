# sguala

Agentless Linux server monitor — **Go CLI / TUI** (primary) and optional Electron desktop. No agent on the host: connect over SSH, scrape CPU / memory / disk / load.

## Demo

ASCII video (overview → metrics tick → search → detail → transfer):

![sguala TUI demo](./doc/tui.svg)

Replay locally:

```bash
./scripts/play-tui-demo.sh          # frame-by-frame in your terminal
asciinema play doc/tui.cast         # if you have asciinema
make demo                           # regenerate doc/tui.{cast,svg}
```

Cast: [`doc/tui.cast`](./doc/tui.cast)

## Install / build (CLI)

```bash
make build
./bin/sguala init
./bin/sguala
```

Or install to `~/.local/bin`:

```bash
make install
```

**Releases:** multi-platform `sguala` binaries on [GitHub Releases](https://github.com/zltl/sguala/releases) (`linux` / `darwin` / `windows`, `amd64` / `arm64`).

Hosts come from **`~/.ssh/config`**. Full reference: **[doc/cli.md](./doc/cli.md)**.

### Highlights

- Live metrics table; `/` search; groups from `# section` comments in SSH config
- `o` open interactive SSH (pure Go); `e` edit config at the selected Host; `t` transfer; `p` password store
- `sguala get|put|sftp` via pure-Go SFTP (ProxyJump / Identity / stored password)
- Terminal title set on connect (`ssh web-01`, …)

### Password storage

| Backend | When |
|---------|------|
| OS keyring | macOS / Windows / Linux Secret Service (CLI preferred) |
| `~/.config/sguala/host_passwords.json` (mode `0600`) | Fallback when keyring is missing (headless Linux, etc.) |

```bash
sguala passwd <Host-alias>
```

### Backup / migrate (bundle)

```bash
sguala export ./backup.sguala.zip
sguala export ./full.sguala.zip --keys --secrets   # sensitive
sguala import ./backup.sguala.zip
```

## Desktop (optional)

Electron UI under [`desktop/`](./desktop/) — server groups, live cards, remote shell, and SFTP. Independent of the CLI runtime; hosts live in app JSON (`sguala_2.json`), not `~/.ssh/config`. Shares the passwords file and `sguala-bundle` format with the CLI.

```bash
cd desktop
npm install
npm start          # development
npm run make       # package / installers (electron-forge)
```

Desktop Settings: **Export / Import Bundle** (same format as CLI). Legacy GUI screenshot: [`doc/over.png`](./doc/over.png).

## CI / release

- Push / PR → GitHub Actions runs CLI tests and build
- Tag `v*` → builds multi-platform CLI binaries and publishes a GitHub Release

```bash
git tag v2.1.0
git push origin v2.1.0
```

## License

GPL-3.0
