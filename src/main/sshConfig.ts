import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface SshConfigHost {
  name: string;
  hostName: string;
  user: string;
  port: number;
  identityFile?: string;
  proxyJump?: string;
}

interface HostBlock {
  patterns: string[];
  // last-wins for most keys; IdentityFile keeps first non-empty
  values: Record<string, string>;
}

function expandHome(p: string, home: string): string {
  if (!p) {
    return p;
  }
  if (p === '~') {
    return home;
  }
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(home, p.slice(2));
  }
  return p;
}

function stripComment(line: string): string {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuote = !inQuote;
      continue;
    }
    if (ch === '#' && !inQuote) {
      return line.slice(0, i);
    }
  }
  return line;
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) {
    tokens.push(cur);
  }
  return tokens;
}

function isWildcard(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?');
}

function parseConfigText(content: string): { blocks: HostBlock[]; includes: string[] } {
  const blocks: HostBlock[] = [];
  const includes: string[] = [];
  let current: HostBlock | null = null;

  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = stripComment(raw).trim();
    if (!line) {
      continue;
    }
    const tokens = tokenize(line);
    if (tokens.length === 0) {
      continue;
    }
    const key = tokens[0].toLowerCase();
    if (key === 'host') {
      if (current) {
        blocks.push(current);
      }
      current = {
        patterns: tokens.slice(1),
        values: {},
      };
      continue;
    }
    if (key === 'match') {
      // Match blocks are uncommon; close Host and ignore Match content simply by
      // ending current host and not starting a new one until next Host.
      if (current) {
        blocks.push(current);
        current = null;
      }
      continue;
    }
    if (key === 'include') {
      for (const p of tokens.slice(1)) {
        includes.push(p);
      }
      continue;
    }
    if (!current || tokens.length < 2) {
      continue;
    }
    const value = tokens.slice(1).join(' ');
    // Keep first IdentityFile; last-wins for others (OpenSSH uses first IdentityFile).
    if (key === 'identityfile') {
      if (!current.values.identityfile) {
        current.values.identityfile = value;
      }
      continue;
    }
    current.values[key] = value;
  }
  if (current) {
    blocks.push(current);
  }
  return { blocks, includes };
}

async function expandIncludeGlobs(pattern: string, cwd: string, home: string): Promise<string[]> {
  const expanded = expandHome(pattern, home);
  const abs = path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
  if (!abs.includes('*') && !abs.includes('?')) {
    return [abs];
  }
  const dir = path.dirname(abs);
  const base = path.basename(abs);
  // very small glob: only * in filename
  try {
    const entries = await fs.readdir(dir);
    const re = new RegExp('^' + base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return entries
      .filter((e) => re.test(e))
      .map((e) => path.join(dir, e))
      .sort();
  } catch {
    return [];
  }
}

async function loadConfigRecursive(
  filePath: string,
  home: string,
  seen: Set<string>,
  depth: number
): Promise<HostBlock[]> {
  if (depth > 8) {
    return [];
  }
  const resolved = path.resolve(filePath);
  if (seen.has(resolved)) {
    return [];
  }
  seen.add(resolved);

  let content: string;
  try {
    content = await fs.readFile(resolved, 'utf-8');
  } catch {
    return [];
  }

  const { blocks, includes } = parseConfigText(content);
  const cwd = path.dirname(resolved);
  const out = [...blocks];
  for (const inc of includes) {
    const files = await expandIncludeGlobs(inc, cwd, home);
    for (const f of files) {
      out.push(...await loadConfigRecursive(f, home, seen, depth + 1));
    }
  }
  return out;
}

function mergeDefaults(specific: Record<string, string>, defaults: Record<string, string>): Record<string, string> {
  const merged = { ...defaults, ...specific };
  // IdentityFile: specific first, else default
  if (specific.identityfile) {
    merged.identityfile = specific.identityfile;
  } else if (defaults.identityfile) {
    merged.identityfile = defaults.identityfile;
  }
  return merged;
}

/**
 * Parse ~/.ssh/config (and Includes) into concrete Host entries.
 * Skips wildcard Host patterns. Applies Host * / Host !* defaults lightly via Host *.
 */
export async function loadSshConfigHosts(configPath?: string): Promise<SshConfigHost[]> {
  const home = os.homedir();
  const mainPath = configPath || path.join(home, '.ssh', 'config');
  const blocks = await loadConfigRecursive(mainPath, home, new Set(), 0);

  const starDefaults: Record<string, string> = {};
  for (const b of blocks) {
    if (b.patterns.length === 1 && b.patterns[0] === '*') {
      Object.assign(starDefaults, b.values);
    }
  }

  const byName = new Map<string, SshConfigHost>();
  for (const b of blocks) {
    const concrete = b.patterns.filter((p) => p && !isWildcard(p));
    if (concrete.length === 0) {
      continue;
    }
    const vals = mergeDefaults(b.values, starDefaults);
    const user = vals.user || 'root';
    let port = 22;
    if (vals.port) {
      const p = parseInt(vals.port, 10);
      if (Number.isFinite(p) && p >= 1 && p <= 65535) {
        port = p;
      }
    }
    const identityFile = vals.identityfile
      ? expandHome(vals.identityfile, home)
      : undefined;

    for (const name of concrete) {
      const hostName = vals.hostname || name;
      const entry: SshConfigHost = {
        name,
        hostName,
        user,
        port,
        identityFile,
        proxyJump: vals.proxyjump,
      };
      // Later Host blocks for same alias override earlier (OpenSSH uses first match;
      // for import, last concrete block wins so more specific files after Include win).
      byName.set(name, entry);
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Exported for unit tests. */
export function parseSshConfigContentForTest(content: string): SshConfigHost[] {
  const { blocks } = parseConfigText(content);
  const starDefaults: Record<string, string> = {};
  for (const b of blocks) {
    if (b.patterns.length === 1 && b.patterns[0] === '*') {
      Object.assign(starDefaults, b.values);
    }
  }
  const out: SshConfigHost[] = [];
  for (const b of blocks) {
    for (const name of b.patterns.filter((p) => p && !isWildcard(p))) {
      const vals = mergeDefaults(b.values, starDefaults);
      let port = 22;
      if (vals.port) {
        const p = parseInt(vals.port, 10);
        if (Number.isFinite(p) && p >= 1 && p <= 65535) {
          port = p;
        }
      }
      out.push({
        name,
        hostName: vals.hostname || name,
        user: vals.user || 'root',
        port,
        identityFile: vals.identityfile,
        proxyJump: vals.proxyjump,
      });
    }
  }
  return out;
}
