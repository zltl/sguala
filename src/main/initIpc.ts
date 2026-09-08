import { ipcMain, dialog, app, BrowserWindow } from "electron";
import conf, { Server, ServerGroup } from "./conf";
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { emptyServerStat, ServerStat, SshRemote } from "./sshRemote";
import { migratePasswordOutOfServer, deleteHostPassword, renameHostPassword } from "./hostSecrets";
import { exportBundleDialog, importBundleDialog } from "./sgualaBundle";
import { loadSshConfigHosts } from "./sshConfig";

const SSH_KEY_SKIP = new Set([
  'known_hosts',
  'known_hosts.old',
  'authorized_keys',
  'authorized_keys2',
  'config',
  'environment',
]);

function getSshDir(): string {
  return path.join(app.getPath('home'), '.ssh');
}

function isUnderSshDir(filePath: string): boolean {
  const sshDir = path.resolve(getSshDir());
  const resolved = path.resolve(filePath);
  return resolved === sshDir || resolved.startsWith(sshDir + path.sep);
}

/** Extract a Host-alias-like token from ProxyJump for hop wiring. */
function proxyJumpAlias(raw: string): string | null {
  let s = raw.trim().split(',')[0].trim();
  if (!s) {
    return null;
  }
  if (s.includes('@')) {
    s = s.slice(s.lastIndexOf('@') + 1);
  }
  if (s.startsWith('[')) {
    return null;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s.split(':')[0])) {
    return null;
  }
  const colon = s.lastIndexOf(':');
  if (colon > 0 && /^\d+$/.test(s.slice(colon + 1))) {
    s = s.slice(0, colon);
  }
  if (!s || s.includes('*') || s.includes('?')) {
    return null;
  }
  return s;
}

async function readPrivateKeyFile(filePath: string): Promise<{ type: string; path?: string; content?: string; message?: string; name?: string }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.includes('PRIVATE KEY') && !content.includes('OPENSSH PRIVATE KEY')) {
      return { type: 'error', message: 'Selected file does not look like an SSH private key' };
    }
    return {
      type: 'ok',
      path: filePath,
      name: path.basename(filePath),
      content,
    };
  } catch (e: any) {
    return { type: 'error', message: e?.message || 'Failed to read key file' };
  }
}

export function initIpc() {
  ipcMain.handle('conf-get', (event) => {
    return conf.get();
  });

  ipcMain.handle('conf-get-server', (event, uuid: string) => {
    const r = conf.getServer(uuid);
    return r;
  });

  ipcMain.handle('conf-validate-group-duplicated', (event, gname: string) => {
    const c = conf.get();
    for (const g of c.groups) {
      if (g.name === gname) {
        return true;
      }
    }
    return false;
  });

  ipcMain.handle('conf-add-group', async (event, gname: string) => {
    const c = conf.get();
    const g = new ServerGroup();
    g.name = gname;
    c.groups.push(g);

    await conf.store(c);
    return g;
  });

  ipcMain.handle('conf-open-group-tab', async (event, uuid: string, opening: boolean) => {
    const g = conf.getGroup(uuid);
    if (!g) {
      console.log('error not found group');
      return { type: 'error', message: 'Group not exists, open tab failed' };
    }
    g.tabOpening = opening;
    await conf.store(conf.get());
    return { type: 'ok' };
  });

  ipcMain.handle('conf-add-server', async (event, s: any) => {
    console.log('conf-add-server', JSON.stringify({ ...s, password: s?.password ? '***' : '' }));
    const c = conf.get();
    // g is the target group
    const g = conf.getGroup(s.groupUuid);
    if (!g) {
      console.log('error not found group');
      return { type: 'error', message: 'Group not exists, add server failed' };
    }

    const migrated = await migratePasswordOutOfServer(s);
    s.password = migrated.password;

    if (!s.uuid || s.uuid === '') {
      // new server
      s.uuid = uuidv4();
      const server = s as Server;
      g.servers.push(server);
      console.log('server add ok: ', server.name);
    } else {
      // update server: delete first, then add
      // note that the server uuid is not changed, so we can find it by uuid
      // server may be moved to another group, so we need to delete it from the old group
      let oldName = '';
      for (const g of c.groups) {
        const index = g.servers.findIndex(gs => gs.uuid === s.uuid);
        if (index >= 0) {
          oldName = g.servers[index]?.name || '';
          g.servers.splice(index, 1);
          break;
        }
      }
      const server = s as Server;
      if (oldName && server.name && oldName !== server.name) {
        try {
          await renameHostPassword(oldName, server.name);
        } catch (e) {
          console.log('renameHostPassword failed', e);
        }
      }
      g.servers.push(server);
      console.log('server update ok: ', server.name);
    }
    await conf.store(c);
    await conf.load();
    return { type: 'ok' };
  });

  ipcMain.handle('conf-remove-group', async (event, uuid: string) => {
    const c = conf.get();
    const index = c.groups.findIndex(g => g.uuid === uuid);
    if (index < 0) {
      return { type: 'error', message: 'Group not exists, remove failed' };
    }

    const g = c.groups[index];
    c.groups.splice(index, 1);
    g.servers.forEach(s => {
      SshRemote.deleteServerClient({ ...s, windowId: 0 })
    });

    await conf.store(c);
    await conf.load();
    return { type: 'ok' };
  });

  ipcMain.handle('conf-update-group', async (event, uuid: string, name: string) => {
    console.log('conf-update-group', uuid, name);
    const g = conf.getGroup(uuid);
    if (!g) {
      console.log('error not found group');
      return { type: 'error', message: 'Group not exists, update failed' };
    }
    g.name = name;
    await conf.store(conf.get());
    await conf.load();
    return { type: 'ok' };
  });

  ipcMain.handle('conf-remove-server', async (event, guuid: string, suuid: string) => {
    console.log('conf-remove-server', guuid, suuid);
    const g = conf.getGroup(guuid);
    if (!g) {
      console.log('error not found group');
      return { type: 'error', message: 'Group not exists, remove server failed' };
    }
    const index = g.servers.findIndex(s => s.uuid === suuid);
    if (index < 0) {
      console.log('error not found server');
      return { type: 'error', message: 'Server not exists, remove failed' };
    }
    const server = g.servers[index];
    g.servers.splice(index, 1);

    if (server?.name) {
      try { await deleteHostPassword(server.name); } catch { /* ignore */ }
    }
    await SshRemote.deleteServerClient({ ...server, windowId: 0 });
    await conf.store(conf.get());
    await conf.load();
    return { type: 'ok' };
  });

  ipcMain.handle('remote-server-stat', async (event, serverUuid: any): Promise<ServerStat> => {
    const server = conf.getServer(serverUuid);
    if (!server) {
      return emptyServerStat();
    }

    const remote = SshRemote.client({
      ...server,
      windowId: 0,
    });

    const stat = await remote.getStat();
    return stat;
  });

  ipcMain.handle('remote-sftp', async (event, serverUuid: string, cnt: number) => {
    console.log("remote sftp", serverUuid, cnt);
    const sftp = SshRemote.getSftpClient(cnt, serverUuid);
    if (!sftp) {
      console.log('error not found sftp');
      return { type: 'error', message: 'Sftp not exists, open failed' };
    }
    await sftp.connect();
    await sftp.sftp();

    return { type: 'ok' };
  });

  ipcMain.handle('remote-shell', async (event, serverUuid: any, cnt: number) => {
    console.log("remote-shell: ", serverUuid, cnt);
    const shell = SshRemote.getShellClient(cnt, serverUuid);
    if (!shell) {
      console.log('error not found shell');
      return { type: 'error', message: 'Shell not exists, open failed' };
    }

    await shell.connect();
    await shell.shell();

    return { type: 'ok' };
  });

  ipcMain.handle('conf-move-group', async (event, item: string, target: string) => {
    console.log('conf-move-group', item, target);
    const c = conf.get();
    // move item to before target
    // if target is 'end', move item to the end

    const itemIndex = c.groups.findIndex(g => g.uuid === item);
    if (itemIndex < 0) {
      // item not found
      console.log('item not found');
      return;
    }
    const itemGroup = c.groups[itemIndex];
    c.groups.splice(itemIndex, 1);

    let targetIndex = -1;
    if (target === 'end') {
      targetIndex = c.groups.length;
    } else {
      targetIndex = c.groups.findIndex(g => g.uuid === target);
    }
    if (targetIndex < 0) {
      // target not found
      console.log('target not found');
      await conf.load();
      return;
    }

    c.groups.splice(targetIndex, 0, itemGroup);
    console.log('reorder');
    await conf.store(c);
    await conf.load();
  });

  ipcMain.handle('conf-move-server', async (event, groupUuid: string,
    serverUuid: string, targetGroupUuid: string, targetServerUuid: string) => {

    console.log('conf-move-server', groupUuid, serverUuid, targetGroupUuid, targetServerUuid);

    const c = conf.get();

    // find server groups and is index
    const sgroup = conf.getGroup(groupUuid);
    if (!sgroup) {
      console.log('source group not found');
      return;
    }
    // find server index on sgroup
    const sindex = sgroup.servers.findIndex(s => s.uuid === serverUuid);
    if (sindex < 0) {
      console.log('source server not found');
      return;
    }
    const s = sgroup.servers[sindex];

    // delete server from sgroup
    sgroup.servers.splice(sindex, 1);

    // find target group
    const tgroup = conf.getGroup(targetGroupUuid);
    if (!tgroup) {
      console.log('target group not found');
      await conf.load();
      return;
    }

    // find target server index
    let tindex = tgroup.servers.length;
    if (targetServerUuid != 'end') {
      tindex = tgroup.servers.findIndex(s => s.uuid === targetServerUuid);
      if (tindex < 0) {
        console.log('target server not found');
        await conf.load();
        return;
      }
    }

    // insert server to tgroup
    tgroup.servers.splice(tindex, 0, s);

    await conf.store(c);
    await conf.load();
  });

  ipcMain.handle('conf-export-bundle', async (event, opts?: { includeKeys?: boolean; includeSecrets?: boolean }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return exportBundleDialog(win, opts || {});
  });

  ipcMain.handle('conf-import-bundle', async (event, opts?: { overwrite?: boolean; includeKeys?: boolean; includeSecrets?: boolean }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return importBundleDialog(win, opts || {});
  });

  ipcMain.handle('conf-export-settings', async (event) => {
    // dialog show save file
    const result = await dialog.showSaveDialog({
      title: 'Export Settings',
      defaultPath: 'sguala.json',
      filters: [
        { name: 'JSON', extensions: ['json'] },
      ],
    });
    const filePath = result.filePath;
    if (!filePath) {
      console.log('cancel export');
      return;
    }
    console.log('export settings to', filePath);
    const c = conf.get();
    const data = JSON.stringify(c, null, 2);
    await fs.writeFile(filePath, data);
  });

  ipcMain.handle('conf-import-settings', async (event) => {
    // dialog show open file
    const result = await dialog.showOpenDialog({
      title: 'Import Settings',
      filters: [
        { name: 'JSON', extensions: ['json'] },
      ],
    });
    const filePath = result.filePaths[0];
    if (!filePath) {
      console.log('cancel import');
      return { type: 'cancel' };
    }
    console.log('import settings from', filePath);
    try {
      const data = await fs.readFile(filePath);
      const nc = JSON.parse(data.toString());
      if (!nc || !Array.isArray(nc.groups)) {
        return { type: 'error', message: 'Invalid settings file' };
      }
      const oc = conf.get();
      // merge
      for (const g of nc.groups) {
        const og = oc.groups.find(gg => gg.name == g.name);
        if (og) {
          // merge group, add server from g to og if not exists
          for (const s of g.servers || []) {
            const os = og.servers.find(ss => ss.name == s.name);
            if (!os) {
              og.servers.push(s);
            }
          }
        } else {
          // add group
          oc.groups.push(g);
        }
      }
      // save
      await conf.store(oc);
      await conf.load();
      return { type: 'ok' };
    } catch (e: any) {
      return { type: 'error', message: e?.message || 'Import failed' };
    }
  });

  ipcMain.handle('conf-list-ssh-config-hosts', async () => {
    try {
      const hosts = await loadSshConfigHosts();
      return { type: 'ok', hosts, path: path.join(app.getPath('home'), '.ssh', 'config') };
    } catch (e: any) {
      return { type: 'error', message: e?.message || 'Failed to read ~/.ssh/config' };
    }
  });

  ipcMain.handle('conf-import-ssh-config-hosts', async (_event, payload: {
    groupUuid?: string;
    names?: string[];
  }) => {
    try {
      const hosts = await loadSshConfigHosts();
      const selectedNames = payload?.names;
      const selected = selectedNames && selectedNames.length > 0
        ? hosts.filter((h) => selectedNames.includes(h.name))
        : hosts;
      if (selected.length === 0) {
        return { type: 'error', message: 'No hosts selected' };
      }

      const c = conf.get();
      let group = payload?.groupUuid ? conf.getGroup(payload.groupUuid) : undefined;
      if (!group) {
        group = c.groups.find((g) => g.name === 'Default') || c.groups[0];
      }
      if (!group) {
        return { type: 'error', message: 'Group not exists' };
      }

      // Existing name → uuid map across all groups (for hop wiring + skip)
      const nameToUuid = new Map<string, string>();
      for (const g of c.groups) {
        for (const s of g.servers || []) {
          nameToUuid.set(s.name, s.uuid);
        }
      }

      let added = 0;
      let skipped = 0;
      const imported: { name: string; uuid: string; proxyJump?: string }[] = [];

      for (const h of selected) {
        if (nameToUuid.has(h.name)) {
          skipped += 1;
          continue;
        }
        let privateKey: string | undefined;
        if (h.identityFile) {
          try {
            const keyContent = await fs.readFile(h.identityFile, 'utf-8');
            if (keyContent.includes('PRIVATE KEY') || keyContent.includes('OPENSSH PRIVATE KEY')) {
              privateKey = keyContent;
            }
          } catch {
            // leave empty; agent / later edit
          }
        }
        const server: any = {
          uuid: uuidv4(),
          name: h.name,
          host: h.hostName,
          port: h.port,
          username: h.user,
          usePassword: false,
          privateKey,
          updateTime: new Date().toISOString(),
          useHop: false,
        };
        group.servers.push(server);
        nameToUuid.set(h.name, server.uuid);
        imported.push({ name: h.name, uuid: server.uuid, proxyJump: h.proxyJump });
        added += 1;
      }

      // Wire ProxyJump → hop when jump target matches a known server name
      for (const item of imported) {
        if (!item.proxyJump) {
          continue;
        }
        const alias = proxyJumpAlias(item.proxyJump);
        if (!alias) {
          continue;
        }
        const hopUuid = nameToUuid.get(alias);
        if (!hopUuid || hopUuid === item.uuid) {
          continue;
        }
        for (const g of c.groups) {
          const server = g.servers.find((s) => s.uuid === item.uuid);
          if (server) {
            server.useHop = true;
            server.hopServerUuid = hopUuid;
            break;
          }
        }
      }

      await conf.store(c);
      await conf.load();
      return { type: 'ok', added, skipped, total: selected.length };
    } catch (e: any) {
      return { type: 'error', message: e?.message || 'Import failed' };
    }
  });

  ipcMain.handle('conf-list-ssh-keys', async () => {
    const sshDir = getSshDir();
    try {
      await fs.access(sshDir, fs.constants.R_OK);
    } catch {
      return { type: 'ok', keys: [] };
    }

    const entries = await fs.readdir(sshDir, { withFileTypes: true });
    const keys: { name: string; path: string }[] = [];
    for (const ent of entries) {
      if (!ent.isFile()) {
        continue;
      }
      const name = ent.name;
      if (name.endsWith('.pub') || name.startsWith('.')) {
        continue;
      }
      if (SSH_KEY_SKIP.has(name) || name.startsWith('known_hosts')) {
        continue;
      }
        const full = path.join(sshDir, name);
      try {
        const fh = await fs.open(full, 'r');
        try {
          const buf = Buffer.alloc(96);
          const { bytesRead } = await fh.read(buf, 0, 96, 0);
          const sample = buf.slice(0, bytesRead).toString('utf-8');
          if (sample.includes('PRIVATE KEY') || sample.includes('OPENSSH PRIVATE KEY')) {
            keys.push({ name, path: full });
          }
        } finally {
          await fh.close();
        }
      } catch {
        // skip unreadable
      }
    }
    keys.sort((a, b) => a.name.localeCompare(b.name));
    return { type: 'ok', keys };
  });

  ipcMain.handle('conf-read-ssh-key', async (_event, filePath?: string) => {
    if (filePath) {
      if (!isUnderSshDir(filePath)) {
        return { type: 'error', message: 'Key path must be under ~/.ssh' };
      }
      return await readPrivateKeyFile(filePath);
    }

    const result = await dialog.showOpenDialog({
      title: 'Select SSH Private Key',
      defaultPath: getSshDir(),
      properties: ['openFile'],
    });
    const picked = result.filePaths[0];
    if (!picked) {
      return { type: 'cancel' };
    }
    return await readPrivateKeyFile(picked);
  });
}
