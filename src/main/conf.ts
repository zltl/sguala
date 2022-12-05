
import { app, BrowserWindow, dialog } from 'electron';
import { VersionStr } from './version';
import { promises as fs } from "fs"
import { ServerLogins } from './serverlogins';
import { v4 as uuidv4 } from 'uuid';


import path from 'path';
import { AlertConfig } from './alertConfig';
import { SmtpConfig } from './smtpConfig';

export class Config {
    version: string = VersionStr()
    fetchStatInterval: number = 10 * 1000
    servers: ServerLogins[] = []
    alerts: AlertConfig[] = []
    smtpc: SmtpConfig
}

function getConfigFilePath(): string {
    const userDataPath = app.getPath('userData');
    const configFilePath = path.join(userDataPath, 'sguala.json');
    return configFilePath;
}

export async function loadConfig(): Promise<Config> {
    try {
        const configFilePath = getConfigFilePath();
        const content = await fs.readFile(configFilePath, 'utf8');
        console.log("loading config from ", configFilePath)
        const res = JSON.parse(content);
        if (!res.alerts) {
            res.alerts = [{
                // insert default rule if empty
                "uuid": "0",
                "isOpen": false,
                "toEmail": "",
                "cpuCheck": false,
                "memCheck": false,
                "diskCheck": false,
                "upCheck": false,
                "cpuAlertValue": 90,
                "memAlertValue": 90,
                "diskAlertValue": 90,
                "cpuAlertForValue": 5,
                "memAlertForValue": 5,
                "diskAlertForValue": 5,
                "upAlertForValue": 5,
                "mailInterval": 120
            }];
        }
        if (!res.smtpc) {
            res.smtpc = {
                "fromHost": "smtp.163.com",
                "fromPort": 465,
                "fromSecure": true,
                "fromEmail": "sguala@163.com",
                "fromPassword": "FAEUVUZKNWSYHCBI",
            };
        }
        return res;
    } catch (e: any) {
        console.log("err: ", e);
        return new Config();
    }
}

export async function storeConfig(config: Config) {
    const configFilePath = getConfigFilePath();
    const content = JSON.stringify(config, null, 2);
    console.log('writing config to ', configFilePath);
    await fs.writeFile(configFilePath, content, 'utf8');
}

export async function putServerConfig(arg: ServerLogins) {
    const config = await loadConfig();
    if (!arg.uuid) {
        arg.uuid = uuidv4();
        config.servers.push(arg);
    } else {
        for (let i = 0; i < config.servers.length; ++i) {
            if (config.servers[i].uuid == arg.uuid) {
                config.servers[i] = arg;
                break;
            }
        }
    }
    await storeConfig(config);
}

export async function delServerConfig(uuid: string) {
    console.log("uuid=", uuid);
    const config = await loadConfig();
    for (let i = 0; i < config.servers.length; ++i) {
        if (config.servers[i].uuid == uuid) {
            config.servers.splice(i, 1);
            break;
        }
    }
    await storeConfig(config);
}

export async function getServerConfig(uuid: string): Promise<ServerLogins> {
    const config = await loadConfig();
    for (let i = 0; i < config.servers.length; ++i) {
        if (config.servers[i].uuid == uuid) {
            return config.servers[i];
        }
    }
    return undefined;
}

export async function moveFront(uuid: string) {
    const config = await loadConfig();

    for (let i = 0; i < config.servers.length; ++i) {
        if (config.servers[i].uuid == uuid) {
            if (i == 0) {
                return;
            }
            const tmp = config.servers[i - 1];
            config.servers[i - 1] = config.servers[i];
            config.servers[i] = tmp;
            await storeConfig(config);
            return;
        }
    }
}

export async function getAlertConfig(uuid: string): Promise<AlertConfig> {
    const config = await loadConfig();
    for (let i = 0; i < config.alerts.length; ++i) {
        if (config.alerts[i].uuid == uuid) {
            return config.alerts[i];
        }
    }
    if (config.alerts.length > 0) {
        return config.alerts[config.alerts.length - 1];
    }
    return undefined;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
    const config = await loadConfig();
    return config.smtpc;
}

export async function putSmtpConfig(arg: SmtpConfig) {
    const config = await loadConfig();
    config.smtpc = arg;
    await storeConfig(config);
}



export async function delAlertConfig(uuid: string) {
    const config = await loadConfig();
    for (let i = 0; i < config.alerts.length; ++i) {
        if (config.alerts[i].uuid == uuid) {
            config.servers.splice(i, 1);
            break;
        }
    }
    await storeConfig(config);
}

export async function putAlertConfig(arg: AlertConfig) {
    const config = await loadConfig();
    let found = false;
    for (let i = 0; i < config.alerts.length; ++i) {
        if (config.alerts[i].uuid == arg.uuid) {
            config.alerts[i] = arg;
            found = true;
            break;
        }
    }
    if (!found) {
        config.alerts.push(arg);
    }
    await storeConfig(config);
}

export async function mergeConfigOpen() {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Json', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
        ],
        title: '导入配置文件',
    });
    if (result.canceled) {
        return;
    }
    result.filePaths.forEach(async (fname) => {
        console.log('loading config file', fname);
        const content = await fs.readFile(fname, 'utf8');
        mergeConfig(content);
    });
}

export async function exportConfigOpen() {
    const pwd = await fs.realpath('.');
    const result = await dialog.showSaveDialog({
        title: '选择导出配置文件位置',
        defaultPath: path.join(pwd, './sguala-config.json'),
        properties: ['showHiddenFiles']
    });
    if (result.canceled) {
        return;
    }
    let targetPath = result.filePath;
    try {
        const tartgetStat = await fs.stat(targetPath);
        if (tartgetStat.isDirectory()) {
            targetPath = path.join(targetPath, 'sguala-config.json');
        }
    } catch {
        console.log('not exists, may create');
    }
    const config = await loadConfig();
    const content = JSON.stringify(config, null, 2);
    console.log('writing config to ', targetPath);
    await fs.writeFile(targetPath, content, 'utf8');
}


export async function mergeConfig(newText: string): Promise<string> {
    const clipText = newText;
    const clipObj = JSON.parse(clipText);
    const config = await loadConfig();
    try {
        for (let i = 0; i < clipObj.servers.length; i++) {
            let found = false;
            const cs = clipObj.servers[i];
            for (let j = 0; j < config.servers.length; j++) {
                const ss = config.servers[j];
                if (cs.uuid == ss.uuid) {
                    found = true;
                    config.servers[j] = cs;
                }
            }
            if (!found) {
                config.servers.push(cs);
            }
        }
        for (let i = 0; i < clipObj.alerts.length; i++) {
            let found = false;
            const cs = clipObj.servers[i];
            if (cs.uuid == "0") {
                continue;
            }
            for (let j = 0; j < config.alerts.length; j++) {
                const ss = config.alerts[j];
                if (cs.uuid == ss.uuid) {
                    found = true;
                    config.alerts[j] = cs;
                }
            }
            if (!found) {
                config.alerts.push(cs);
            }
        }
        await storeConfig(config);
    } catch (e) {
        console.log("e merge Config", e);
        return String(e);
    }
}

