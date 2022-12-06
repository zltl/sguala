import { app, BrowserWindow, ipcMain, autoUpdater, FeedURLOptions } from 'electron';
import { ShellSession, SshFetchStats } from './ssh';
import {
  loadConfig,
  Config,
  delAlertConfig,
  getAlertConfig,
  putAlertConfig,
  putServerConfig,
  delServerConfig,
  getServerConfig,
  getSmtpConfig,
  putSmtpConfig,
  moveFront,
  mergeConfigOpen,
  exportConfigOpen,
} from './conf';
import { AlertConfig } from './alertConfig';
import {
  exportConfigToClipbard, mergeConfigFromClipbard
} from './clipb';
import { ServerLogins } from './serverlogins';
import { SmtpConfig } from './smtpConfig';
import { kvsGetCurDir, kvsGetCurGroup, kvsSetCurDir, kvsSetCurGroup } from './kvStore';

import path from 'path';
import fs from 'fs';
import { FileDesc, humanFileSize } from './FileDesc';

/*
const server = 'https://update.electronjs.org'
const feed = `${server}/zltl/sguala/${process.platform}-${process.arch}/${app.getVersion()}`
autoUpdater.setFeedURL({ url: feed });
setInterval(() => {
  autoUpdater.checkForUpdates()
}, 10 * 60 * 1000)
*/


// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

declare const SHELL_WINDOW_WEBPACK_ENTRY: string;
declare const SHELL_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

declare const SFTP_WINDOW_WEBPACK_ENTRY: string;
declare const SFTP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

process.on('uncaughtException', function (error) {
  // Handle the error
  console.log("E", error);
});


const ss = new SshFetchStats();


const registerAllhandle = () => {

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

  ipcMain.handle('configMoveFront', async (event: any, uuid: string) => {
    console.log('move front', uuid);
    await moveFront(uuid);
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

  ipcMain.handle('getSmtpConfig', async (event: any): Promise<SmtpConfig> => {
    console.log("getSmtpConfig...");
    return await getSmtpConfig();
  });
  ipcMain.handle('putSmtpConfig', async (event: any, arg: SmtpConfig) => {
    console.log("putSmtpConfig...", arg);
    await putSmtpConfig(arg);
  });

  ipcMain.handle('exportClipboard', async (event: any) => {
    console.log("exportClipboard...");
    await exportConfigToClipbard();
  });
  ipcMain.handle('importClipboard', async (event: any) => {
    console.log("exportClipboard...");
    await mergeConfigFromClipbard();
  });
  ipcMain.handle('importFile', async (event: any) => {
    console.log("importFile...");
    await mergeConfigOpen();
  });
  ipcMain.handle('exportFile', async (event: any) => {
    console.log("exportFile...");
    await exportConfigOpen();
  });

  ipcMain.handle('sshClose', (event: any, uuid: string) => {
    ss.closeServer(uuid);
  });

  ipcMain.handle('shellWindow', (event: any, uuid: string) => {
    console.log('create new window');
    createShellWindow(uuid);
  });

  ipcMain.handle('sftpWindow', (event: any, uuid: string) => {
    console.log('create new sftp window');
    createSftpWindow(uuid);
  });

  ipcMain.handle('getCurDir', async (event: any) => {
    return await kvsGetCurDir();
  });
  ipcMain.handle('setCurDir', async (event: any, dir: string) => {
    console.log('setCUrDir', dir);
    return await kvsSetCurDir(dir);
  });

  ipcMain.handle('getCurGroup', async (event: any): Promise<any> => {
    return await kvsGetCurGroup();
  });
  ipcMain.handle('setCurGroup', async (event: any, g: any) => {
    console.log('setCurGroup', g);
    return await kvsSetCurGroup(g);
  });

  ipcMain.handle('listDir', async (event: any, dir: string): Promise<FileDesc[]> => {
    dir = await fs.promises.realpath(dir);
    console.log('listDir', dir);

    const res = [];

    const prefDir = path.join(dir, '..');
    if (prefDir) {
      const finfo = new FileDesc();
      finfo.isDir = true;
      finfo.fullPath = prefDir;
      finfo.name = "..";
      finfo.size = 0;
      finfo.sizeStr = "0";
      finfo.mtime = "-";
      res.push(finfo);
    }
    const flist = await fs.promises.readdir(dir);
    for (let i = 0; i < flist.length; i++) {
      const finfo = new FileDesc();
      const fname = flist[i];
      const realFname = path.join(dir, fname);
      const stat = await fs.promises.stat(realFname);

      finfo.isDir = stat.isDirectory();
      finfo.fullPath = realFname;
      finfo.name = fname;
      finfo.size = stat.size;
      finfo.sizeStr = humanFileSize(stat.size);
      finfo.mtime = stat.mtime.toLocaleString();
      res.push(finfo);
    }

    return res;
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
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true, // must be set to true when contextBridge is enabled
      nodeIntegrationInWorker: true, // must be set to true when contextBridge is enabled
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  ipcMain.handle('sshConnect', async (event: any, arg: any): Promise<any> => {
    ss.registerServer(arg, mainWindow);
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

let shellCnt = 0;

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
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      additionalArguments: ['uuid=' + uuid, `shellCnt=${shellCnt}`], // window.process.argv
      contextIsolation: true, // must be set to true when contextBridge is enabled
      nodeIntegrationInWorker: true, // must be set to true when contextBridge is enabled
      preload: SHELL_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  // and load the index.html of the app.
  shellWindow.loadURL(SHELL_WINDOW_WEBPACK_ENTRY + `?uuid=${uuid}&shellCnt=${shellCnt}`);

  // Open the DevTools.
  // shellWindow.webContents.openDevTools();

  let s: ShellSession;
  const scnt = shellCnt;
  shellWindow.on('ready-to-show', () => {
    s = ss.startShell(shellWindow, login, scnt);
  });

  shellWindow.on('close', () => {
    s.conn.end();
  });

  shellCnt++;
};

const createSftpWindow = async (uuid: string) => {

  const login = await getServerConfig(uuid);
  if (!login) {
    console.log('cannot find login info of', uuid);
    return;
  }

  // Create the browser window.
  const sftpWindow = new BrowserWindow({
    height: 600,
    width: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      additionalArguments: ['uuid=' + uuid, `shellCnt=${shellCnt}`], // window.process.argv
      contextIsolation: true, // must be set to true when contextBridge is enabled
      nodeIntegrationInWorker: true, // must be set to true when contextBridge is enabled
      preload: SFTP_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  // and load the index.html of the app.
  sftpWindow.loadURL(SFTP_WINDOW_WEBPACK_ENTRY + `?uuid=${uuid}&shellCnt=${shellCnt}`);

  // Open the DevTools.
  // sftpWindow.webContents.openDevTools();

  let s: ShellSession;
  const scnt = shellCnt;

  sftpWindow.on('ready-to-show', () => {
    s = ss.startSftp(sftpWindow, login, scnt);
  });

  sftpWindow.on('close', () => {
    s.conn.end();
  });
  shellCnt++;
};


// TODO: Uncaught TypeError: Cannot read properties of undefined (reading 'getCurrentWindow')
app.disableHardwareAcceleration()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);
/*
const createMyWindow = () => {
  createSftpWindow('99294c0c-e8fa-474a-8e53-1242f7ce6bd7');
}
app.on('ready', createMyWindow);
*/
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
    // createShellWindow('d5105475-269c-4b5f-92ca-6c0ed54014e5');
    createSftpWindow('99294c0c-e8fa-474a-8e53-1242f7ce6bd7');
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
