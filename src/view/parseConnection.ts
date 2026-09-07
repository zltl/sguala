export interface ParsedConnection {
  username: string;
  host: string;
  port: number;
  name: string;
}

/** Split user@host while allowing IPv6 in brackets: user@[::1] */
function splitUserHost(raw: string): { username: string; hostPart: string } {
  const at = raw.lastIndexOf('@');
  if (at <= 0) {
    return { username: 'root', hostPart: raw };
  }
  return {
    username: raw.slice(0, at).trim() || 'root',
    hostPart: raw.slice(at + 1).trim(),
  };
}

/** Parse host / [ipv6] / host:port / [ipv6]:port */
function parseHostPort(hostPart: string): { host: string; port: number } | null {
  if (!hostPart) {
    return null;
  }

  if (hostPart.startsWith('[')) {
    const end = hostPart.indexOf(']');
    if (end < 0) {
      return null;
    }
    const host = hostPart.slice(1, end);
    if (!host) {
      return null;
    }
    const after = hostPart.slice(end + 1);
    if (!after) {
      return { host, port: 22 };
    }
    if (!after.startsWith(':')) {
      return null;
    }
    const port = parseInt(after.slice(1), 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return null;
    }
    return { host, port };
  }

  // hostname:port — only treat as port if the suffix is all digits
  const colon = hostPart.lastIndexOf(':');
  if (colon > 0) {
    const maybePort = hostPart.slice(colon + 1);
    if (/^\d+$/.test(maybePort)) {
      const port = parseInt(maybePort, 10);
      if (!Number.isFinite(port) || port < 1 || port > 65535) {
        return null;
      }
      const host = hostPart.slice(0, colon);
      if (!host || host.includes(':')) {
        // bare IPv6 without brackets is ambiguous; reject
        return null;
      }
      return { host, port };
    }
  }

  // bare IPv6 without brackets / port
  if (hostPart.includes(':')) {
    return null;
  }

  return { host: hostPart, port: 22 };
}

/**
 * Parse a single SSH-style connection string.
 * Supports: user@host, user@host:port, host, host:port,
 * user@[ipv6], user@[ipv6]:port, [ipv6], [ipv6]:port
 */
export function parseConnection(line: string): ParsedConnection | null {
  const s = line.trim();
  if (!s || s.startsWith('#')) {
    return null;
  }

  const { username, hostPart } = splitUserHost(s);
  if (!username) {
    return null;
  }

  const hp = parseHostPort(hostPart);
  if (!hp) {
    return null;
  }

  const name = hp.port === 22 ? `${username}@${hp.host}` : `${username}@${hp.host}:${hp.port}`;
  return {
    username,
    host: hp.host,
    port: hp.port,
    name,
  };
}

export function parseConnections(text: string): {
  ok: ParsedConnection[];
  errors: string[];
} {
  const ok: ParsedConnection[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const parsed = parseConnection(trimmed);
    if (!parsed) {
      errors.push(trimmed);
    } else {
      ok.push(parsed);
    }
  }
  return { ok, errors };
}

/** Normalize host/port when host field accidentally contains ":port". */
export function normalizeHostPort(
  host: string,
  port: number
): { host: string; port: number } | null {
  const h = (host || '').trim();
  if (!h) {
    return null;
  }
  const parsed = parseHostPort(h);
  if (!parsed) {
    return null;
  }
  const hostHadPort =
    (h.startsWith('[') && h.includes(']:')) ||
    (!h.startsWith('[') && h.includes(':') && /^\d+$/.test(h.slice(h.lastIndexOf(':') + 1)));
  if (hostHadPort) {
    return parsed;
  }
  const p = port && Number.isFinite(port) ? port : 22;
  if (p < 1 || p > 65535) {
    return null;
  }
  return { host: parsed.host, port: p };
}
