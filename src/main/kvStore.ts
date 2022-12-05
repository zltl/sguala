
import { app } from 'electron';
import { promises as fs } from "fs"
import sfs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import path from 'path';

export class KVS {
    curDir: string
    curGroup: []
}

function getKvFilePath(): string {
    const userDataPath = app.getPath('userData');
    const kvPath = path.join(userDataPath, 'kv.json');
    return kvPath;
}

export async function loadKv(): Promise<KVS> {
    try {
        const kvFilePath = getKvFilePath();
        const content = await fs.readFile(kvFilePath, 'utf8');
        console.log("loading config from ", kvFilePath)
        const res = JSON.parse(content);
        return res
    } catch (e: any) {
        console.log("err: ", e);
        return new KVS();
    }
}

export async function storeKv(kvs: KVS) {
    const configFilePath = getKvFilePath();
    const content = JSON.stringify(kvs);
    console.log('writing kvs to ', configFilePath, content);
    await fs.writeFile(configFilePath, content, 'utf8');
}

export async function kvsGetCurDir(): Promise<string> {
    const kvs = await loadKv();
    if (sfs.existsSync(kvs.curDir)) {
        return await fs.realpath(kvs.curDir);
    }
    return await fs.realpath('.');
}

export async function kvsSetCurDir(dir: string) {
    try {
        dir = await fs.realpath(dir);
        const kvs = await loadKv();
        kvs.curDir = dir;
        await storeKv(kvs);
    } catch (e) {
        console.log("not store ", e);
    }
}

export async function kvsGetCurGroup(): Promise<[]> {
    const kvs = await loadKv();
    return kvs.curGroup;
}
export async function kvsSetCurGroup(groups: []) {
    try {
        const kvs = await loadKv();
        kvs.curGroup = groups;
        await storeKv(kvs);
    } catch (e) {
        console.log("not store ", e);
    }
}
