import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('myAPI', {
    desktop: true,
});

contextBridge.exposeInMainWorld('config', {
    getAll: async () => await ipcRenderer.invoke('getAllConfig'),
    set: async (arg) => await ipcRenderer.invoke('putServerConfig', arg),
});

contextBridge.exposeInMainWorld('stat', {
    get: (uuid) => ipcRenderer.invoke('getStat', uuid),
    connect: (arg) => ipcRenderer.invoke('sshConnect', arg),
    close: (uuid) => ipcRenderer.invoke('sshClose', uuid),
});


