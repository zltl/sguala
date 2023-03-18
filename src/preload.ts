// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, shell } from 'electron';

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
})

contextBridge.exposeInMainWorld('main', {
  // Expose the `ipcRenderer` API to the renderer process.
  ipc: {
    send: (channel: string, data: any) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel: string, func: any) => {
      console.log(`registering ${channel} listener`);
      ipcRenderer.on(channel, (event: any, ...args: any) => {
        // console.log(`received ${channel} event`, event, args)
        func(channel, ...args)
      });
    },
    clear: (chan: string) => ipcRenderer.removeAllListeners(chan),
  },

  conf: {
    get: async () => {
      return await ipcRenderer.invoke('conf-get');
    },

    getServer: async (uuid: string) => {
      return await ipcRenderer.invoke('conf-get-server', uuid);
    },

    validateGroupDuplicated: async (gname: string) => {
      return await ipcRenderer.invoke('conf-validate-group-duplicated', gname);
    },

    addGroup: async (gname: string) => {
      return await ipcRenderer.invoke('conf-add-group', gname);
    },

    updateGroup: async (uuid: string, gname: string) => {
      console.log('update group', uuid, gname);
      return await ipcRenderer.invoke('conf-update-group', uuid, gname);
    },

    addServer: async (s: any): Promise<any> => {
      console.log("addServer: ", JSON.stringify(s));
      return await ipcRenderer.invoke('conf-add-server', s);
    },

    removeGroup: async (uuid: string) => {
      return await ipcRenderer.invoke('conf-remove-group', uuid);
    },

    openGroupTab: async (uuid: string, opening: boolean) => {
      return await ipcRenderer.invoke('conf-open-group-tab', uuid, opening);
    },

    removeServer: async (groupUuid: string, serverUuid: string) => {
      return await ipcRenderer.invoke('conf-remove-server', groupUuid, serverUuid);
    },

    moveGroup: async (item: string, target: string) => {
      return await ipcRenderer.invoke('conf-move-group', item, target);
    },

    moveServer: async (groupUuid: string, serverUuid: string, targetGroupUuid: string, targetServerUuid: string) => {
      return await ipcRenderer.invoke('conf-move-server', groupUuid, serverUuid, targetGroupUuid, targetServerUuid);
    },

    updateInterval: async (interval: number) => {
      return await ipcRenderer.invoke('update-fetch-interval', interval);
    }
  },

  remote: {
    getServerStat: async (serverUuid: any): Promise<any> => {
      return await ipcRenderer.invoke('remote-server-stat', serverUuid);
    },

    // connect/shell
    shell: async (serverUuid: string, cnt: number): Promise<any> => {
      return await ipcRenderer.invoke('remote-shell', serverUuid, cnt);
    },

    shellWindow: async (serverUuid: string): Promise<any> => {
      return await ipcRenderer.invoke('shell-window', serverUuid);
    },

    sftpWindow: async (serverUuid: string): Promise<any> => {
      return await ipcRenderer.invoke('sftp-window', serverUuid);
    },

    // connect/sftp
    sftp: async (serverUuid: string, cnt: number): Promise<any> => {
      return await ipcRenderer.invoke('remote-sftp', serverUuid, cnt);
    }
  },

  shell: {
    openExternal: (url: string) => {
      shell.openExternal(url);
    },
  },

});
