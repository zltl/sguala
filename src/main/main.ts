import { app, BrowserWindow, Menu, MenuItemConstructorOptions, ipcMain } from 'electron';
import { LinuxStat, SshFetchStats } from './ssh';
import {
  loadConfig,
  Config,
  delAlertConfig,
  getAlertConfig,
  putAlertConfig,
  putServerConfig,
  delServerConfig,
  getServerConfig
} from './conf';
import { AlertConfig } from './alertConfig';
import { exportConfigToClipbard, mergeConfigFromClipbard } from './clipb';
import { ServerLogins } from './serverlogins';

// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

declare const SHELL_WINDOW_WEBPACK_ENTRY: string;
declare const SHELL_WINDOW_PRELOAD_WEBPACK_ENTRY: string;


const registerAllhandle = () => {
  const ss = new SshFetchStats();

  ipcMain.handle('getAllConfig', async (): Promise<Config> => {
    const text = await loadConfig();
    // console.log("getAllConfig", JSON.stringify(text));
    return text;
  });

  ipcMain.handle('putServerConfig', async (event: any, arg: any) => {
    console.log("putServerConfig...", arg);
    await putServerConfig(arg);
  });

  ipcMain.handle('delServerConfig', async (event: any, uuid: string) => {
    console.log("delServerConfig...", uuid);
    await delServerConfig(uuid);
    // also delete alert configs
    await delAlertConfig(uuid);
  });

  ipcMain.handle('getServerConfig', async (event: any, uuid: string) => {
    console.log("getServerConfig...", uuid);
    return await getServerConfig(uuid);
  });



  ipcMain.handle('delAlertConfig', async (event: any, uuid: string) => {
    console.log("delAlertConfig...", uuid);
    await delAlertConfig(uuid);
  });
  ipcMain.handle('getAlertConfig', async (event: any, uuid: string): Promise<AlertConfig> => {
    console.log("getAlertConfig...", uuid);
    return await getAlertConfig(uuid);
  });
  ipcMain.handle('putAlertConfig', async (event: any, arg: AlertConfig) => {
    console.log("putAlertConfig...", arg);
    await putAlertConfig(arg);
  });

  ipcMain.handle('exportClipboard', async (event: any) => {
    console.log("exportClipboard...");
    await exportConfigToClipbard();
  });
  ipcMain.handle('importClipboard', async (event: any) => {
    console.log("exportClipboard...");
    await mergeConfigFromClipbard();
  });

  ipcMain.handle('getStat', async (event: any, uuid: string) => {
    // console.log('getStat', uuid);
    return ss.getStat(uuid);
  });

  ipcMain.handle('sshConnect', (event: any, arg: any) => {
    ss.registerServer(arg);
  });

  ipcMain.handle('sshClose', (event: any, uuid: string) => {
    ss.closeServer(uuid);
  });

  ipcMain.handle('shellWindow', (event: any, uuid: string) => {
    console.log('create new window');
    createShellWindow(uuid);
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}


registerAllhandle();


const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true, // must be set to true when contextBridge is enabled
      nodeIntegrationInWorker: true, // must be set to true when contextBridge is enabled
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};


const createShellWindow = async (uuid: string) => {

  const login = await getServerConfig(uuid);
  if (!login) {
    console.log('cannot find login info of', uuid);
    return;
  }

  console.log('SHELL_WINDOW_WEBPACK_ENTRY', SHELL_WINDOW_WEBPACK_ENTRY);

  // Create the browser window.
  const shellWindow = new BrowserWindow({
    height: 600,
    width: 800,
    autoHideMenuBar: true,
    webPreferences: {
      additionalArguments: ['uuid=' + uuid], // window.process.argv
      contextIsolation: true, // must be set to true when contextBridge is enabled
      nodeIntegrationInWorker: true, // must be set to true when contextBridge is enabled
      preload: SHELL_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  // and load the index.html of the app.
  shellWindow.loadURL(SHELL_WINDOW_WEBPACK_ENTRY + '?uuid=' + uuid);

  // Open the DevTools.
  shellWindow.webContents.openDevTools();
};

// TODO: Uncaught TypeError: Cannot read properties of undefined (reading 'getCurrentWindow')
app.disableHardwareAcceleration()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.on('ready', createWindow);
const createMyWindow = () => {
  createShellWindow('d5105475-269c-4b5f-92ca-6c0ed54014e5');
}
app.on('ready', createMyWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitaly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    // createWindow();
    createShellWindow('d5105475-269c-4b5f-92ca-6c0ed54014e5');
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
