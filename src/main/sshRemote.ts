// helper functions to get info from host

import { ipcMain, dialog } from "electron";
import ssh2, { Client } from "ssh2";
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from "fs";

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

type SshClientType = 'ssh' | 'shell' | 'sftp';

export class SshClient {
  c: Client;
  opts: SshConnectOptions;
  ctype: SshClientType;
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


  constructor(c: Client, opts?: SshConnectOptions, ctype?: SshClientType) {
    this.c = c;
    this.opts = opts;
    this.ctype = ctype;
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

      const opts = structuredClone(this.opts);
      if (opts.usePassword) {
        opts.privateKey = undefined;
      } else {
        opts.password = undefined;
      }

      this.c.connect(opts);
    });
  }

  checkConnected = async (): Promise<void> => {
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
    return;
  }

  sftpDoRealPath = async (chanKey: string, sftp: any, data: any) => {
    const win = this.win;
    sftp.realpath(data.path, (err: any, abspath: string) => {
      if (err) {
        console.log('realpath error:', err);
        win.webContents.send(chanKey, {
          op: 'realPath',
          data: data.path,
          err: err.message,
        });
      } else {
        win.webContents.send(chanKey, {
          op: 'realPath',
          path: data.path,
          realPath: abspath,
        });
      }
    });
  };

  sftpDoLs = async (chanKey: string, sftp: any, data: any) => {
    const win = this.win;
    sftp.readdir(data.path, (err: any, list: any[]) => {
      if (err) {
        console.log('readdir error:', err);
        win.webContents.send(chanKey, {
          op: 'ls',
          path: data.path,
          err: err.message,
        });
      } else {
        const ret: any[] = [];
        const prefDir = data.path + "/...";
        for (const item of list) {
          const ic = {
            name: item.filename,
            fullPath: data.path + "/" + item.filename,
          };

          const isDir = item.longname.startsWith('d')
          ret.push({
            name: item.filename,
            path: prefDir,
            isDir: isDir,
            size: isDir ? 0 : item.attrs.size,
            mtime: new Date(item.attrs.mtime * 1000).toLocaleString(),
          });
        }
        win.webContents.send(chanKey, {
          op: 'ls',
          path: data.path,
          list: ret,
        });
      }
    });
  };

  sftpPut = async (chanKey: string, sftp: any, data: any) => {
    const win = this.win;
    const targetDia = await dialog.showOpenDialog(this.win, {
      title: 'sguala - download to',
      properties: ['openFile', 'openDirectory'],
    });
    const localPath = targetDia.filePaths[0];
    const tranferPutOne = async (localF: any, remotePath: string, started = false, curUuid?: string) => {
      const remotePathConc = remotePath + '/' + localF.name;
      if (!curUuid) {
        curUuid = uuidv4();
      }
      if (!started) {
        await win.webContents.send(chanKey, {
          'op': 'transferStart',
          'transferType': 'put',
          'remoteFullPath': remotePathConc,
          'localFullPath': localF.fullPath,
          'uuid': curUuid,
        });
      }

      console.log(`putting ${localF.fullPath} to ${remotePathConc}`);
      if (localF.isDir) {
        await new Promise((mkdirResolve, mkdirReject) => {
          sftp.mkdir(remotePathConc, async (err: any) => {
            if (err) {
              console.log('mkdir error:', err);
              await win.webContents.send(curUuid, {
                'op': 'transferError',
                'transferType': 'put',
                'remoteFullPath': remotePathConc,
                'localFullPath': localF.fullPath,
                'error': err.message,
              });
              return;
            }
            mkdirResolve(0);
          });
        });

        const flist = await fs.readdir(localF.fullPath);
        const xuidm = new Map();
        for (const f of flist) {
          const localFPath = path.join(localF.fullPath, f);
          const stat = await fs.stat(localFPath);
          const uid = uuidv4();
          xuidm.set(f, uid);
          await win.webContents.send(chanKey, {
            'op': 'transferStart',
            'transferType': 'put',
            'remoteFullPath': remotePathConc + '/' + f,
            'localFullPath': localFPath,
            'uuid': uid,
          });
        }
        for (const f of flist) {
          const localFPath = path.join(localF.fullPath, f);
          const stat = await fs.stat(localFPath);
          const xuuid = xuidm.get(f);
          await tranferPutOne({
            fullPath: localFPath,
            isDir: stat.isDirectory(),
            name: f,
            size: stat.size,
            mtime: stat.mtime.toLocaleString(),
          }, remotePathConc, true, xuuid);
        }
        win.webContents.send(curUuid, {
          'op': 'transferProgress',
          'transfered': 0,
          'fsize': 0,
          'speed': '-',
          'isEnd': true,
          'remoteFullPath': remotePathConc,
          'localFullPath': localF.fullPath,
        });
      } else {
        return new Promise((gResolve, gReject) => {
          const startTs = new Date();
          let prevStepTs = new Date();
          let prevTotal = 0;

          let gtotal = 0;
          let gfsize = localF.size;
          console.log('putting', localF.fullPath, 'to', remotePathConc);
          sftp.fastPut(localF.fullPath, remotePathConc, {
            step: async (total: number, nb: number, fsize: number) => {
              const curTs = new Date();
              const ms = curTs.getTime() - prevStepTs.getTime();
              if (ms < 100 && total < fsize) {
                return;
              }
              const speed = (total - prevTotal) * 1000 / ms;
              await win.webContents.send(curUuid, {
                'op': 'transferProgress',
                'transfered': total,
                'fsize': fsize,
                'speed': speed,
                'isEnd': false,
                'remoteFullPath': remotePathConc,
                'localFullPath': localF.fullPath,
              });
              gtotal = total;
              gfsize = fsize;
              prevStepTs = curTs;
              prevTotal = total;
            }
          }, async (e: any) => {
            if (e) {
              console.log('put error:', e);
              await win.webContents.send(curUuid, {
                'op': 'transferError',
                'transferType': 'put',
                'remoteFullPath': remotePathConc,
                'localFullPath': localF.fullPath,
                'error': e.message,
              });
              gResolve(0);
              return;
            } else {
              const curTs = new Date();
              const ms = curTs.getTime() - startTs.getTime();
              const speed = gfsize * 1000 / ms;
              await win.webContents.send(curUuid, {
                'op': 'transferProgress',
                'transfered': gfsize,
                'fsize': gfsize,
                'speed': speed,
                'isEnd': true,
                'remoteFullPath': remotePathConc,
                'localFullPath': localF.fullPath,
              });
              console.log('transfer success', remotePathConc);
              gResolve(0);
            }
          });
        });
      }
    }

    const stat = await fs.stat(localPath);
    const localF = {
      fullPath: localPath,
      isDir: stat.isDirectory(),
      name: path.basename(localPath),
      size: stat.size,
      mtime: stat.mtime.toLocaleString(),
    };

    await tranferPutOne(localF, data.remotePath);
  };

  sftpGet = async (chanKey: string, sftp: any, data: any) => {
    // get file/dir from remote
    const targetDia = await dialog.showOpenDialog(this.win, {
      title: 'sguala - download to',
      properties: ['openDirectory'],
    });
    const localPath = targetDia.filePaths[0];

    const tranferOne = async (remoteF: any, local: string, started = true, curUuid?: string) => {
      const win = this.win;
      const localPathConc = path.join(local, remoteF.name);
      if (!curUuid) {
        curUuid = uuidv4();
      }
      if (!started) {
        await win.webContents.send(chanKey, {
          'op': 'transferStart',
          'transferType': 'get',
          'remoteFullPath': remoteF.fullPath,
          'localFullPath': localPathConc,
          'uuid': curUuid,
        });
      }
      console.log(`transfering ${JSON.stringify(remoteF)} to ${localPathConc} ${curUuid}`);

      if (remoteF.isDir) {
        await fs.mkdir(localPathConc, {
          recursive: true
        });
        return new Promise((getResolve, getReject) => {
          sftp.readdir(remoteF.fullPath, async (err: any, list: any[]) => {
            if (err) {
              console.log("EGETSFTP", err);
              await win.webContents.send(curUuid, {
                'op': 'transferError',
                'transferType': 'get',
                'remoteFullPath': remoteF.fullPath,
                'localFullPath': localPathConc,
                'error': err.message,
              });
              getResolve(1);
              return;
            }
            const uidxm = new Map();
            for (const fent of list) {
              const xuuid = uuidv4();
              uidxm.set(fent.filename, xuuid);
              await win.webContents.send(chanKey, {
                'op': 'transferStart',
                'transferType': 'get',
                'fullPath': remoteF.fullPath + '/' + fent.filename,
                'localFullPath': path.join(localPathConc, fent.filename),
                'uuid': xuuid,
              });
            }
            for (const fent of list) {
              const isDir = fent.longname.startsWith('d');
              const xuuid = uidxm.get(fent.filename);
              await tranferOne({
                name: fent.filename,
                fullPath: remoteF.fullPath + '/' + fent.filename,
                isDir: isDir,
                size: isDir ? 0 : fent.attrs.size,
                mtime: new Date(fent.attrs.mtime * 1000).toLocaleString(),
              }, localPathConc, true, xuuid);
            }

            await win.webContents.send(curUuid, {
              'op': 'transferProgress',
              'transfered': 0,
              'fsize': 1,
              'speed': '-',
              'isEnd': true,
              'remoteFullPath': remoteF.fullPath,
              'localFullPath': localPathConc,
            });

            getResolve(0);
          });
        });
      } else {
        const startTs = new Date();
        let prevStepTs = new Date();
        let prevTotal = 0;

        let gtotal = 0;
        let gfsize = remoteF.size;
        console.log("fastGeting", JSON.stringify(remoteF), "to", localPathConc);

        return new Promise((gResolve, gReject) => {
          sftp.fastGet(remoteF.fullPath, localPathConc, {
            step: async (total: number, nb: number, fsize: number) => {
              const curTs = new Date();
              const ms = curTs.getTime() - prevStepTs.getTime();
              if (ms < 100 && total != fsize) {
                return;
              }
              const speed = (total - prevTotal) * 1000 / ms;
              await win.webContents.send(curUuid, {
                'op': 'transferProgress',
                'transfered': total,
                'fsize': fsize,
                'isEnd': false,
                'remoteFullPath': remoteF.fullPath,
                'localFullPath': localPathConc,
              });
              gtotal = total;
              gfsize = fsize;
              prevStepTs = curTs;
              prevTotal = total;
            },
          }, async (err: any) => {
            if (err) {
              console.log('transfer error', err);
              win.webContents.send(curUuid, {
                'op': 'transferError',
                'transferType': 'get',
                'remoteFullPath': remoteF.fullPath,
                'localFullPath': localPathConc,
                'error': err.message,
              });
              gResolve(1);
              return;
            }
            const curTs = new Date();
            const ms = curTs.getTime() - startTs.getTime();
            let speed = 0;
            if (ms > 0) {
              speed = gfsize * 1000 / ms;
            }
            win.webContents.send(curUuid, {
              'op': 'transferProgress',
              'transfered': gfsize,
              'fsize': gfsize,
              'speed': speed,
              'isEnd': true,
              'remoteFullPath': remoteF.fullPath,
              'localFullPath': localPathConc,
            });
            console.log('transfer success', remoteF.fullPath)
          });
          gResolve(0);
        });
      }
    };
    await tranferOne(data.remoteF, localPath);
  }

  sftp = async (): Promise<void> => {
    const chanKey = `SFTP_CHANNEL_${this.opts.uuid}/${this.opts.windowId}`;
    const win = this.win;
    await this.checkConnected();

    return new Promise((resolve, reject) => {
      this.c.sftp((err, sftp) => {
        if (err) {
          console.log('sftp error:', err);
          reject(err);
          return;
        }
        ipcMain.on(chanKey, async (ev, data) => {
          console.log('sftp got data:', data, chanKey);
          if (data.op === 'realPath') {
            await this.sftpDoRealPath(chanKey, sftp, data);
          } else if (data.op === 'ls') {
            await this.sftpDoLs(chanKey, sftp, data);
          } else if (data.op === 'get') {
            await this.sftpGet(chanKey, sftp, data);
          } else if (data.op === 'put') {
            await this.sftpPut(chanKey, sftp, data);
          }
        });
        resolve();
      });
    });
  };

  shell = async (): Promise<void> => {
    const chanKey = `SHELL_CHANNEL_${this.opts.uuid}/${this.opts.windowId}`;
    const win = this.win;
    await this.checkConnected();
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
    if (this.ctype == 'shell') {
      SshRemote.deleteShellClient(this.mkeyStr());
    } else if (this.ctype === 'ssh') {
      SshRemote.deleteClient(this.mkeyStr());
    } else {
      // sftp
      SshRemote.deleteSftpClient(this.mkeyStr());
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
  private static sftpMap = new Map<string, SshClient>();

  static client(opts: SshConnectOptions): SshClient {
    const mkey = new SshClientMapKey(opts.windowId, opts.uuid);
    const mkeyStr = mkey.toString();
    console.log(`SshRemote.client.key: ${mkeyStr}`);
    if (this.clientMap.has(mkeyStr)) {
      console.log(`SshRemote.client: ${mkeyStr} found`);
      return this.clientMap.get(mkeyStr);
    }
    console.log(`SshRemote.client: ${mkeyStr} not found`);
    const c = new SshClient(null, opts, 'ssh');
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
    const c = new SshClient(null, opts, 'shell');
    c.win = win;
    this.shellMap.set(mkeyStr, c);

    return c;
  }

  static sftp(opts: SshConnectOptions, win: any): SshClient {
    const mkey = new SshClientMapKey(opts.windowId, opts.uuid);
    const mkeyStr = mkey.toString();
    console.log(`SshRemote.client.key: ${mkeyStr}`);
    if (this.sftpMap.has(mkeyStr)) {
      console.log(`SshRemote.client: ${mkeyStr} found`);
      return this.sftpMap.get(mkeyStr);
    }
    console.log(`SshRemote.client: ${mkeyStr} not found`);
    const c = new SshClient(null, opts, 'sftp');
    c.win = win;
    this.sftpMap.set(mkeyStr, c);
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

  static getSftpClient(winId: number, serverid: string): SshClient {
    const mkey = new SshClientMapKey(winId, serverid);
    const mkeyStr = mkey.toString();
    if (this.sftpMap.has(mkeyStr)) {
      return this.sftpMap.get(mkeyStr);
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

  static deleteSftpClient(mkeyStr: string) {
    this.sftpMap.delete(mkeyStr);
  }
  static async deleteSftpServerClient(opts: SshConnectOptions) {
    const mkey = new SshClientMapKey(opts.windowId, opts.uuid);
    const mkeyStr = mkey.toString();
    const c = this.sftpMap.get(mkeyStr);
    if (c) {
      await c.close();
    }
  }
}

