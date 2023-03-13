import { Config, ipcMain } from "electron";
import conf, { Server, ServerGroup } from "./conf";
import { v4 as uuidv4 } from 'uuid';
import { emptyServerStat, ServerStat, SshRemote } from "./sshRemote";

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
    console.log('conf-add-server', JSON.stringify(s));
    const c = conf.get();
    // g is the target group
    const g = conf.getGroup(s.groupUuid);
    if (!g) {
      console.log('error not found group');
      return { type: 'error', message: 'Group not exists, add server failed' };
    }

    if (!s.uuid || s.uuid === '') {
      // new server
      s.uuid = uuidv4();
      const server = s as Server;
      g.servers.push(server);
      console.log('server add ok: ', JSON.stringify(server));
    } else {
      // update server: delete first, then add
      // note that the server uuid is not changed, so we can find it by uuid
      // server may be moved to another group, so we need to delete it from the old group
      for (const g of c.groups) {
        const index = g.servers.findIndex(gs => gs.uuid === s.uuid);
        if (index >= 0) {
          g.servers.splice(index, 1);
          break;
        }
      }
      const server = s as Server;
      g.servers.push(server);
      console.log('server update ok: ', JSON.stringify(server));
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

    await SshRemote.deleteServerClient({ ...server, windowId: 0 });
    await conf.store(conf.get());
    await conf.load();
    return { type: 'ok' };
  });

  ipcMain.handle('remote-server-stat', async (event, serverUuid: any): Promise<ServerStat> => {
    console.log("remote-server-stat: ", serverUuid);
    const server = conf.getServer(serverUuid);
    if (!server) {
      return emptyServerStat();
    }

    const remote = SshRemote.client({
      ...server,
      windowId: 0,
    });

    const stat = await remote.getStat();
    console.log(`remote-server-stat response: `, JSON.stringify(stat));
    return stat;
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

}
