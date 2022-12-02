import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';

contextBridge.exposeInMainWorld('myAPI', {
    desktop: true,
});

contextBridge.exposeInMainWorld('config', {
    getAll: async () => await ipcRenderer.invoke('getAllConfig'),
    set: async (arg) => await ipcRenderer.invoke('putServerConfig', arg),
    del: async (uuid) => await ipcRenderer.invoke('delServerConfig', uuid),
    get: async (uuid) => await ipcRenderer.invoke('getServerConfig', uuid),

    getAlert: async (uuid) => await ipcRenderer.invoke('getAlertConfig', uuid),
    delAlert: async (uuid) => await ipcRenderer.invoke('delAlertConfig', uuid),
    pubAlert: async (arg) => await ipcRenderer.invoke('putAlertConfig', arg),

    getSmtpConfig: async (uuid) => await ipcRenderer.invoke('getSmtpConfig', uuid),
    putSmtpConfig: async (arg) => await ipcRenderer.invoke('putSmtpConfig', arg),


    exportClipboard: async () => await ipcRenderer.invoke('exportClipboard'),
    importClipboard: async () => await ipcRenderer.invoke('importClipboard'),

    configMoveFront: async (uuid) => await ipcRenderer.invoke('configMoveFront', uuid),
});

contextBridge.exposeInMainWorld('stat', {
    get: (uuid) => ipcRenderer.invoke('getStat', uuid),
    connect: (arg) => ipcRenderer.invoke('sshConnect', arg),
    close: (uuid) => ipcRenderer.invoke('sshClose', uuid),
});

contextBridge.exposeInMainWorld('fs', {
    getCurDir: async () => await ipcRenderer.invoke('getCurDir'),
    setCurDir: async (dir) => await ipcRenderer.invoke('setCurDir', dir),
    listDir: async (dir) => await ipcRenderer.invoke('listDir', dir),
    cd: (origin, dst) => {
        const newDir = path.join(origin, dst);
        return newDir;
    },
    sftpWindow: async (uuid) => await ipcRenderer.invoke('sftpWindow', uuid),
});

contextBridge.exposeInMainWorld('rterm', {
    shellWindow: (uuid) => ipcRenderer.invoke('shellWindow', uuid),
});


contextBridge.exposeInMainWorld('ipc', {
    'send': (chan, data) => ipcRenderer.send(chan, data),
    'on': (chan, fn) => ipcRenderer.on(chan, fn),
    'clear': (chan) => ipcRenderer.removeAllListeners(chan), 
});

