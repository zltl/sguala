import { Config, ipcMain } from "electron";
import conf, { Server, ServerGroup } from "./conf";
import { v4 as uuidv4 } from 'uuid';
import { emptyServerStat, ServerStat, SshRemote } from "./sshRemote";

export function initIpc() {
  ipcMain.handle('conf-get', (event) => {
    return conf.get();
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

  ipcMain.handle('conf-add-server', async (event, gname: string, s: Server) => {
    const c = conf.get();
    const g = c.groups.find(g => g.name === gname);
    if (!g) {
      return;
    }
    if (!s.uuid || s.uuid === '') {
      s.uuid = uuidv4();
    }
    g.servers.push(s);
    await conf.store(c);
    return s;
  });


  ipcMain.handle('remote-server-stat', async (event, server: any): Promise<ServerStat> => {
    console.log(`remote-server-stat: `, JSON.stringify(server));
    const remote = SshRemote.client({
      ...server,
      windowId: event.sender.id,
    });

    const stat = await remote.getStat();
    console.log(`remote-server-stat response: `, JSON.stringify(stat));
    return stat;
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


}
