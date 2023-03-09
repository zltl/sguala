// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

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
        console.log(`received ${channel} event`, event, args)
        func(channel, ...args)
      });
    },
  },

  conf: {
    get: () => {
      return ipcRenderer.invoke('conf-get');
    },

    validateGroupDuplicated: (gname: string) => {
      return ipcRenderer.invoke('conf-validate-group-duplicated', gname);
    },

    addGroup: async (gname: string) => {
      return ipcRenderer.invoke('conf-add-group', gname);
    },

    moveGroup: async (item: string, target: string) => {
      return ipcRenderer.invoke('conf-move-group', item, target);
    }
  },

  remote: {
    getServerStat: async (server: any): Promise<any> => {
      return await ipcRenderer.invoke('remote-server-stat', server);
    }
  }

});
