import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import path from 'path';

const version = "2.0.0";

export class Server {
  uuid: string
  name: string
  host: string
  port: number
  username: string
  password?: string
  usePassword: boolean
  privateKey?: string
  updateTime?: string

  useHop?: boolean
  hopServerUuid?: string
}

export class ServerGroup {
  uuid = uuidv4();
  name: string
  tabOpening?: boolean = false
  servers: Server[] = []
}

export class Config {
  version = version;
  groups: ServerGroup[] = [{
    uuid: uuidv4(),
    name: "Default",
    servers: [],
  }];
}

export async function confUpgrade() {
  const legacyPath = path.join(app.getPath('userData'), 'sguala.json');
  try {
    await fs.access(legacyPath, fs.constants.R_OK);
  } catch {
    return;
  }

  const oldConfContent = await fs.readFile(legacyPath, 'utf-8');
  const oldConf = JSON.parse(oldConfContent);
  const newConf = new Config();
  for (const s of oldConf.servers) {
    // add group if not exists
    let g = newConf.groups.find(g => g.name === s.group);
    if (!g) {
      g = new ServerGroup();
      g.name = s.group;
      newConf.groups.push(g);
    }
    // add server to group
    const server = new Server();
    server.uuid = s.uuid;
    server.name = s.name;
    server.host = s.host;
    server.port = s.port;
    server.username = s.username;
    server.password = s.password;
    server.usePassword = s.usePassword;
    server.privateKey = s.privateKey;
    server.useHop = s.useHopping;
    server.hopServerUuid = s.hoppingID;
    server.updateTime = s.updateTime;
    g.servers.push(server);
  }

  await storeConf(newConf);
  await fs.unlink(legacyPath);
}

function getConfigFilePath(): string {
  const userDataPath = app.getPath('userData');
  const configFilePath = path.join(userDataPath, 'sguala_2.json');
  return configFilePath;
}

const configFilePath = getConfigFilePath();
let config = new Config();
const serverUuidMap = new Map<string, Server>();
const groupUuidMap = new Map<string, ServerGroup>();
updateMaps();

function updateMaps() {
  serverUuidMap.clear();
  groupUuidMap.clear();
  for (const g of config.groups) {
    groupUuidMap.set(g.uuid, g);
    for (const s of g.servers) {
      serverUuidMap.set(s.uuid, s);
    }
  }
}

(async () => {
  console.log('configFilePath=', configFilePath);
  try {
    await fs.access(configFilePath, fs.constants.R_OK);
  } catch {
    // file not exists
    await storeConf(config);
  }
  for await (const e of fs.watch(configFilePath)) {
    if (e.filename) {
      console.log("inotify", e.eventType, e.filename);
      await loadConfig();
    }
  }
})();

export async function loadConfig(): Promise<Config> {

  try {
    await fs.access(configFilePath, fs.constants.R_OK);
  } catch {
    // file not exists
    return config;
  }

  try {
    const data = await fs.readFile(configFilePath, 'utf-8');
    config = JSON.parse(data) as Config;
    // Drop legacy alert/smtp fields if present
    delete (config as any).smtp;
    delete (config as any).alert;
    updateMaps();
    return config;
  } catch (e) {
    console.log("loadConfig error", e);
    return config;
  }
}

export function getConfig() {
  return config;
}

export async function storeConf(cc: Config) {
  delete (cc as any).smtp;
  delete (cc as any).alert;
  const data = JSON.stringify(cc, null, 2);
  config = cc;
  updateMaps();
  await fs.writeFile(configFilePath, data, 'utf-8');
}

export default {
  Config,
  Server,
  ServerGroup,

  load: async () => {
    return await loadConfig();
  },

  get: () => {
    return config;
  },

  store: async (c: Config) => {
    await storeConf(c);
  },

  getGroup: (uuid: string): ServerGroup => {
    return groupUuidMap.get(uuid);
  },

  getServer: (uuid: string): Server => {
    return serverUuidMap.get(uuid);
  },

};
