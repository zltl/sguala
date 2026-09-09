# sguala

Agentless Linux server monitor — **Go CLI / TUI** (primary) and optional Electron desktop. No agent on the host: connect over SSH, scrape CPU / memory / disk / load.

## Demo

ASCII still (live table from `~/.ssh/config`):

```text
sguala  5/6 online  refresh 10s  sort:config
───────────────────────────────────────────────────────────────────────────────────────────────────
GROUP      HOST      ADDR                    ST    CPU            MEM           DISK   LOAD    LAT
── production ─────────────────────────────────────────────────────────────────────────────────────
production web-01    deploy@10.0.0.11:22     ●   12.4%      43% 16.0G          61% /   0.42   48ms
production web-02    deploy@10.0.0.12:22     ●    8.1%      38% 16.0G          56% /   0.31   52ms
production db-01     ops@10.0.0.21:22        ●   64.7%      78% 16.0G          82% /   2.10   61ms
── edge ───────────────────────────────────────────────────────────────────────────────────────────
edge       bastion   jump@bastion.example:22 ●    3.2%      22% 16.0G          41% /   0.05   28ms
edge       ci-runner ci@ci.example:22        ●   41.0%      55% 16.0G          70% /   1.20   90ms
── lab ────────────────────────────────────────────────────────────────────────────────────────────
lab        old-box   lab@192.168.9.9:22      ○       —              —              —      —      —

k/↑ up • j/↓ down • enter detail • / search • o open ssh • t transfer • p set password • ? help …
```

ASCII video (overview → metrics tick → search → detail → transfer):

![sguala TUI demo](./doc/tui.svg)

Replay locally:

```bash
./scripts/play-tui-demo.sh          # frame-by-frame in your terminal
asciinema play doc/tui.cast         # if you have asciinema
make demo                           # regenerate doc/tui.{txt,cast,svg}
```

Full still: [`doc/tui.txt`](./doc/tui.txt) · cast: [`doc/tui.cast`](./doc/tui.cast)

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
