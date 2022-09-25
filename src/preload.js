import { contextBridge, ipcRenderer } from 'electron';
import { loadConfig } from './main/conf';

contextBridge.exposeInMainWorld('myAPI', {
    desktop: true,
});

contextBridge.exposeInMainWorld('conf', {
    loadConfig: async () => loadConfig(),
    get: () => ipcRenderer.invoke('get_config'),
});


