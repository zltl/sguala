
import { app } from 'electron';
import { VersionStr } from './version';
import { promises as fs } from "fs"
import { ServerLogins } from './serverlogins';

import path from 'path';

export class Config {
    version: string = VersionStr()
    fetchStatInterval: number = 10 * 1000
    servers: ServerLogins[] = []
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
        return res;
    } catch (e: any) {
        console.log("err: ", e);
        return new Config();
    }
}

export async function storeConfig(config: Config) {
    const configFilePath = getConfigFilePath();
    const content = JSON.stringify(config);
    console.log('writing config to ', configFilePath);
    await fs.writeFile(configFilePath, content, 'utf8');
}

export async function putServerConfig(arg: ServerLogins) {
    const config = await loadConfig();
    for (let i = 0; i < config.servers.length; ++i) {
        if (config.servers[i].uuid == arg.uuid) {
            config.servers[i] = arg;
            return;
        }
    }
    config.servers.push(arg);
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

