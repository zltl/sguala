import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Shared with CLI (`cli/internal/secret`): passwords for password-auth hosts.
 * Prefer not to keep plaintext in sguala_2.json.
 *
 * File: <UserConfigDir>/sguala/host_passwords.json (mode 0600)
 * Format: { "version": 1, "hosts": { "<alias-or-name>": "<password>" } }
 *
 * CLI also tries the OS keyring when available; this desktop path uses the
 * portable file so headless Linux / systems without a secret service still work.
 */

const FILE_VERSION = 1;

type FileStore = {
  version: number;
  hosts: Record<string, string>;
};

/** XDG-style path matching Go os.UserConfigDir()/sguala. */
export function hostPasswordsFilePath(): string {
  if (process.env.SGUALA_PASSWORDS_FILE) {
    return process.env.SGUALA_PASSWORDS_FILE;
  }
  const home = app.getPath('home');
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'sguala', 'host_passwords.json');
  }
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appdata, 'sguala', 'host_passwords.json');
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(xdg, 'sguala', 'host_passwords.json');
}

async function readStore(): Promise<FileStore> {
  const p = hostPasswordsFilePath();
  try {
    const raw = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(raw) as FileStore;
    if (!parsed.hosts || typeof parsed.hosts !== 'object') {
      parsed.hosts = {};
    }
    if (!parsed.version) parsed.version = FILE_VERSION;
    return parsed;
  } catch (e: any) {
    if (e && e.code === 'ENOENT') {
      return { version: FILE_VERSION, hosts: {} };
    }
    throw e;
  }
}

async function writeStore(store: FileStore): Promise<void> {
  const p = hostPasswordsFilePath();
  await fs.mkdir(path.dirname(p), { mode: 0o700, recursive: true });
  store.version = FILE_VERSION;
  if (!store.hosts) store.hosts = {};
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  await fs.rename(tmp, p);
  try {
    await fs.chmod(p, 0o600);
  } catch {
    // ignore on platforms that don't support chmod the same way
  }
}

export async function getHostPassword(alias: string): Promise<string> {
  const key = (alias || '').trim();
  if (!key) return '';
  const store = await readStore();
  return store.hosts[key] || '';
}

export async function setHostPassword(alias: string, password: string): Promise<void> {
  const key = (alias || '').trim();
  if (!key) throw new Error('empty host alias');
  const store = await readStore();
  if (!password) {
    delete store.hosts[key];
  } else {
    store.hosts[key] = password;
  }
  await writeStore(store);
}

export async function deleteHostPassword(alias: string): Promise<void> {
  await setHostPassword(alias, '');
}

/** Move a stored password when the server display/alias name changes. */
export async function renameHostPassword(oldAlias: string, newAlias: string): Promise<void> {
  const from = (oldAlias || '').trim();
  const to = (newAlias || '').trim();
  if (!from || !to || from === to) return;
  const store = await readStore();
  const pw = store.hosts[from];
  if (!pw) return;
  if (store.hosts[to] && store.hosts[to] !== pw) {
    throw new Error(`password already stored for ${to}`);
  }
  store.hosts[to] = pw;
  delete store.hosts[from];
  await writeStore(store);
}

/** Resolve password for a server: shared file by name, else legacy JSON field. */
export async function resolveServerPassword(server: {
  name?: string;
  usePassword?: boolean;
  password?: string;
}): Promise<string> {
  if (!server?.usePassword) {
    return '';
  }
  if (server.name) {
    const fromFile = await getHostPassword(server.name);
    if (fromFile) return fromFile;
  }
  return server.password || '';
}

/** After save: move password into shared file; clear JSON field. Empty password keeps existing file entry. */
export async function migratePasswordOutOfServer(server: {
  name?: string;
  usePassword?: boolean;
  password?: string;
}): Promise<{ password?: string }> {
  if (!server?.usePassword) {
    if (server?.name) {
      await deleteHostPassword(server.name);
    }
    return { password: undefined };
  }
  const pw = server.password || '';
  if (pw && server.name) {
    await setHostPassword(server.name, pw);
  }
  return { password: undefined };
}
