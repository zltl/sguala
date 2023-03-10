// helper functions to get info from host

import { ipcMain } from "electron";
import ssh2, { Client } from "ssh2";

export class SshClientMapKey {
  windowId: number;
  hostUuid: string;
  constructor(windowId: number, hostUuid: string) {
    this.windowId = windowId;
    this.hostUuid = hostUuid;
  }

  toString() {
    return `${this.windowId}-${this.hostUuid}`;
  }
}

interface RunOutput {
  stdout?: string;
  stderr?: string;
  code?: number;
}

export class MemInfo {
  total: number;
  avail: number;
  free: number;
}

export class OneDiskStat {
  name: string;
  total: number;
  avail: number;
}

export class DiskStat {
  List: OneDiskStat[] = [];
}

export interface SshConnectOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  uuid: string;
  windowId: number
}

enum SshClientState {
  Disconnected,
  Connecting,
  Connected,
}

export class ServerStat {
  cpu?: number;
  mem: MemInfo;
  disk: DiskStat;
  online: boolean;
}

export function emptyServerStat(): ServerStat {
  return {
    mem: {
      total: 0,
      avail: 0,
      free: 0,
    },
    disk: {
      List: [],
    },
    online: false,
  };
}

export class SshClient {
  c: Client;
  opts: SshConnectOptions;
  isShell: boolean
  state = SshClientState.Disconnected;
  err: any;
  win: any;
  env = {
    'PATH': '$PATH:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/bin',
    'TERM': 'xterm-256color',
    'LC_ALL': 'en_US.UTF-8',
    'LANG': 'en_US.UTF-8',
    'LANGUAGE': 'en_US.UTF-8'
  };

  // cpuPercent need states
  prev: any;


  constructor(c: Client, opts?: SshConnectOptions, isShell?: boolean) {
    this.c = c;
    this.opts = opts;
    this.isShell = isShell;
  }

  mkeyStr(): string {
    return new SshClientMapKey(this.opts.windowId, this.opts.uuid).toString();
  }

  connect = async (): Promise<void> => {
    console.log(`connecting to: ${this.opts.host}`);
    this.state = SshClientState.Connecting;
    this.c = new Client();

    return new Promise((resolve, reject) => {
      this.c.on("ready", () => {
        this.err = null;
        console.log("connect: ssh ready");
        this.state = SshClientState.Connected;
        resolve();
      });
      this.c.on("error", (err) => {
        this.err = err;
        console.log("connect: ssh error", err);
        this.state = SshClientState.Disconnected;
        this.c.end();
        this.c.destroy();
        reject(err);
      });
      /*
      this.c.on('timeout', () => {
        this.err = "timeout";
        console.log("connect: ssh timeout");
        this.state = SshClientState.Disconnected;
        reject(new Error("ssh timeout"));
      });
            */
      this.c.on("end", () => {
        console.log("connect: ssh end");
        this.state = SshClientState.Disconnected;
      });

      this.c.connect(this.opts);
    });
  }

  shell = async (): Promise<void> => {
    const chanKey = `SHELL_CHANNEL_${this.opts.uuid}/${this.opts.windowId}`;
    const win = this.win;
    if (this.state !== SshClientState.Connected) {
      console.log("ssh client not connected");
      // connect first
      if (this.state === SshClientState.Disconnected) {
        console.log('disconnected, try connect');
        // async connect, then error
        this.state = SshClientState.Connecting;
        await this.connect();
      } else {
        console.log('connecting');
        throw new Error("ssh client not connected");
      }
    }
    // start shell
    return new Promise((resolve, reject) => {
      this.c.shell({ env: this.env }, (err, stream) => {
        if (err) {
          console.log('shell error:', err);
          reject(err);
          return;
        }

        win.setSize(800, 400);
        ipcMain.on(chanKey, async (ev, data) => {
          if (data.op === 'data') {
            stream.write(data.data);
          } else if (data.op === 'resize') {
            stream.setWindow(data.rows, data.cols, '', '');
          }
        });
        
        stream.on('close', () => {
          ipcMain.removeAllListeners(chanKey);
          console.log('shell closed');
          try {
            win.send(chanKey, {
              'op': 'data',
              'data': 'session closed',
            });  
          } catch (e) {
            console.log('session close send error', e);
          }
        });
        stream.on('data', (data: any) => {
          try {
            win.send(chanKey, {
              'op': 'data',
              'data': data,
            });
          } catch (e) {
            console.log('session data send error', e);
          }
        });
        stream.on('error', (err: any) => {
          console.log('error...');
        });
        resolve();
      });
    });
  }

  exec = async (cmd: string): Promise<RunOutput> => {
    console.log(`exec: ${cmd}, on server ${this.opts.host}`);
    if (this.state !== SshClientState.Connected) {
      console.log("ssh client not connected");
      // connect first
      if (this.state === SshClientState.Disconnected) {
        console.log('disconnected, try connect');
        // async connect, then error
        this.state = SshClientState.Connecting;
        this.connect().catch((err) => {
          console.log("ssh connect error", err);
          this.state = SshClientState.Disconnected;
          this.c.end();
          this.c.destroy();
        });
        throw new Error("ssh client not connected");
      }
    }

    return new Promise((resolve, reject) => {
      this.c.exec(cmd, { env: this.env }, (err: any, stream: ssh2.ClientChannel) => {
        if (err) {
          reject(err);
          return;
        }
        let stdout = "";
        let stderr = "";
        stream.on("close", (code: any, signal: any) => {
          console.log("Stream :: close :: code: " + code + ", signal: " + signal);
          resolve({ code: code, stdout: stdout, stderr: stderr });
        }).on("end", () => {
          console.log("Stream :: end");
          resolve({ stdout: stdout, stderr: stderr });
        }).on("data", (data: string) => {
          stdout += data;
        }).stderr.on("data", (data: string) => {
          stderr += data;
        });
      });
    });
  }

  close = async (): Promise<void> => {
    if (this.isShell) {
      SshRemote.deleteShellClient(this.mkeyStr());
    } else {
      SshRemote.deleteClient(this.mkeyStr());
    }
    return new Promise((resolve, reject) => {
      this.c.on("close", () => {
        console.log("ssh close");
        resolve();
      });
      this.c.end();
      this.c.destroy();
    });
  }

  getCpuPercent = async (): Promise<number> => {
    const r = await this.exec("cat /proc/stat");
    if ((r.code && r.code !== 0) || (r.stderr && r.stderr !== "")) {
      throw new Error(`get cpu stat failed: code=${r.code},  stderr=${r.stderr}, stdout=${r.stdout}`);
    }
    return this.calculateCpuPercent(r.stdout);
  }

  calculateCpuPercent = (data: string) => {
    const lines = data.split('\n');
    if (lines.length == 0) {
      console.log('data empty');
      return;
    }
    const firstLine = lines[0];
    const fields = firstLine.split(/\s+/);
    if (fields.length < 9) {
      console.log('data first line must > 8');
      return;
    }

    /*
         user    nice   system  idle      iowait irq   softirq  steal  guest  guest_nice
    cpu  74608   2520   24433   1117073   6176   4054  0        0      0      0
    
    PrevIdle = previdle + previowait
    Idle = idle + iowait
   
    PrevNonIdle = prevuser + prevnice + prevsystem + previrq + prevsoftirq + prevsteal
    NonIdle = user + nice + system + irq + softirq + steal
   
    PrevTotal = PrevIdle + PrevNonIdle
    Total = Idle + NonIdle
   
    # differentiate: actual value minus the previous one
    totald = Total - PrevTotal
    idled = Idle - PrevIdle
   
    CPU_Percentage = (totald - idled)/totald
    */
    const user = Number(fields[1]);
    const nice = Number(fields[2]);
    const system = Number(fields[3]);
    const idle = Number(fields[4]);
    const iowait = Number(fields[5]);
    const irq = Number(fields[6]);
    const softirq = Number(fields[7]);
    const steal = Number(fields[8]);

    const nonIdle = user + nice + system + irq + softirq + steal
    const total = idle + nonIdle;

    if (!this.prev) {
      this.prev = {
        user: user,
        nice: nice,
        system: system,
        idle: idle,
        iowait: iowait,
        irq: irq,
        softirq: softirq,
        steal: steal,
      };
      return 0;
    } else {
      const prev = this.prev;
      const PrevIdle = prev.idle + prev.iowait;
      const Idle = idle + iowait;

      const PrevNonIdle = prev.user + prev.nice + prev.system + prev.irq + prev.softirq + prev.steal
      const NonIdle = user + nice + system + irq + softirq + steal

      const PrevTotal = PrevIdle + PrevNonIdle
      const Total = Idle + NonIdle

      // # differentiate: actual value minus the previous one
      const totald = Total - PrevTotal
      const idled = Idle - PrevIdle

      const CPU_Percentage = (totald - idled) / totald
      return CPU_Percentage;
    }
  }

  getMemStat = async (): Promise<MemInfo> => {
    const r = await this.exec("cat /proc/meminfo");
    if ((r.code && r.code !== 0) || (r.stderr && r.stderr !== "")) {
      throw new Error(`get mem stat failed: code=${r.code},  stderr=${r.stderr}, stdout=${r.stdout}`);
    }
    const lines = r.stdout.split('\n');
    const fields = new Map();
    lines.forEach((line: string) => {
      const splits = line.split(/\s+/);
      if (splits.length < 2) {
        return;
      }
      fields.set(splits[0], Number(splits[1]) * 1000);
    });
    const memtotal = fields.get('MemTotal:');
    let memavail = fields.get('MemAvailable:');
    const memfree = fields.get('MemFree:');
    if (memavail == undefined || memavail == null) {
      const buffers = fields.get('Buffers:');
      const cached = fields.get('Cached:');
      memavail = memfree + buffers + cached;
    }
    return {
      total: memtotal,
      avail: memavail,
      free: memfree,
    };
  }

  getDiskStat = async (): Promise<DiskStat> => {
    const r = await this.exec('df');
    if ((r.code && r.code !== 0) || (r.stderr && r.stderr !== "")) {
      throw new Error(`get disk stat failed: code=${r.code},  stderr=${r.stderr}, stdout=${r.stdout}`);
    }
    const data = r.stdout;
    let prevName = '';
    const getFieldsValue = (line: string): OneDiskStat => {
      const fields = line.split(/\s+/);
      if (fields.length < 5) {
        // console.log(`line ${line} extract failed`);
        prevName = fields[0];
        return undefined;
      }
      const res = new OneDiskStat();
      res.name = fields[0];
      if (res.name == undefined || res.name == '') {
        res.name = prevName;
      }
      const total = Number(fields[1]);
      const avail = Number(fields[3]);
      res.total = total * 1000;
      res.avail = avail * 1000;
      return res;
    }
    const lines = data.split('\n');
    const disks = new DiskStat();
    for (let i = 1; i < lines.length; i++) {
      const dstat = getFieldsValue(lines[i]);
      if (!dstat) {
        continue;
      }
      if (dstat.name == 'tmpfs' ||
        dstat.name == 'devtmpfs' ||
        dstat.name == 'udev' ||
        dstat.name == 'none' ||
        dstat.name == 'overlay' ||
        dstat.name == 'shm' ||
        dstat.name.includes("/dev/loop")) {
        // skip
      } else {
        disks.List.push(dstat);
      }
    }
    return disks;
  }

  getStat = async (): Promise<ServerStat> => {
    try {
      console.log(`getStat/CPU: ${this.opts.uuid} ${this.state}`);
      const cpu = await this.getCpuPercent();
      console.log(`getStat/MEM: ${this.opts.uuid} ${this.state}`);
      const mem = await this.getMemStat();
      console.log(`getStat/DISK: ${this.opts.uuid} ${this.state}`);
      const disk = await this.getDiskStat();
      console.log(`getStat/END: ${this.opts.uuid} ${this.state}`);
      return {
        cpu: cpu,
        mem: mem,
        disk: disk,
        online: this.state === SshClientState.Connected,
      };
    } catch {
      return emptyServerStat();
    }
  }
}

export class SshRemote {
  private static clientMap = new Map<string, SshClient>();
  private static shellMap = new Map<string, SshClient>();

  static client(opts: SshConnectOptions): SshClient {
    const mkey = new SshClientMapKey(opts.windowId, opts.uuid);
    const mkeyStr = mkey.toString();
    console.log(`SshRemote.client.key: ${mkeyStr}`);
    if (this.clientMap.has(mkeyStr)) {
      console.log(`SshRemote.client: ${mkeyStr} found`);
      return this.clientMap.get(mkeyStr);
    }
    console.log(`SshRemote.client: ${mkeyStr} not found`);
    const c = new SshClient(null, opts, false);
    this.clientMap.set(mkeyStr, c);
    return c;
  }

  static shell(opts: SshConnectOptions, win: any): SshClient {
    const mkey = new SshClientMapKey(opts.windowId, opts.uuid);
    const mkeyStr = mkey.toString();
    console.log(`SshRemote.client.key: ${mkeyStr}`);
    if (this.shellMap.has(mkeyStr)) {
      console.log(`SshRemote.client: ${mkeyStr} found`);
      return this.shellMap.get(mkeyStr);
    }

    console.log(`SshRemote.client: ${mkeyStr} not found, new one`);
    const c = new SshClient(null, opts, true);
    c.win = win;
    this.shellMap.set(mkeyStr, c);

    return c;
  }

  static getShellClient(winid: number, serverid: string): SshClient {
    const mkey = new SshClientMapKey(winid, serverid);
    const mkeyStr = mkey.toString();
    if (this.shellMap.has(mkeyStr)) {
      return this.shellMap.get(mkeyStr);
    }
    return null;
  }

  static deleteClient(mkeyStr: string) {
    this.clientMap.delete(mkeyStr);
  }
  static async deleteServerClient(opts: SshConnectOptions) {
    const mkey = new SshClientMapKey(opts.windowId, opts.uuid);
    const mkeyStr = mkey.toString();
    const c = this.clientMap.get(mkeyStr);
    if (c) {
      await c.close();
    }
  }

  static deleteShellClient(mkeyStr: string) {
    this.shellMap.delete(mkeyStr);
  }
  static async deleteShellServerClient(opts: SshConnectOptions) {
    const mkey = new SshClientMapKey(opts.windowId, opts.uuid);
    const mkeyStr = mkey.toString();
    const c = this.shellMap.get(mkeyStr);
    if (c) {
      await c.close();
    }
  }
}

