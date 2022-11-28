import { Client, ClientChannel } from 'ssh2';
import { ServerLogins } from './serverlogins';
import { checkAlert } from './alertLogic';
import { ipcMain } from 'electron';

export class SshFetchStats {
    srvStats = new Map<string, LinuxSession>();

    constructor() {
        console.log('..')
    }

    startShell(win: any, login: ServerLogins, cnt: number): ShellSession {
        console.log('start shell...... ', login.name);
        const s = new ShellSession();
        s.login = login;
        s.conn = new Client();
        const chanKey = 'SHELL_CHANNEL_' + login.uuid + `/${cnt}`;

        s.conn.on('ready', async () => {
            console.log('ssh', login.host, login.port, 'ready');
            s.conn.exec('export TERM=xterm-256color', () => { console.log('export ok') });
            s.conn.shell(
                {
                    env: {
                        'PATH': '$PATH:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/bin',
                        'TERM': 'xterm-256color'
                    }
                },
                (err, stream) => {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    stream.write('export TERM=xterm-256color\n');

                    ipcMain.on(chanKey, async (ev, data) => {
                        if (data.op == 'data') {
                            console.log("get data from xterm", data.data);
                            stream.write(data.data);
                        } else if (data.op == 'resize') {
                            stream.setWindow(data.rows, data.cols, '', '');
                        }
                        console.log("witten to remote");
                    });

                    stream.on('close', () => {
                        console.log("CLOSE");
                    });
                    stream.on('data', async (data: any) => {
                        console.log('send to ', chanKey);
                        win.send(chanKey, {
                            'op': "data",
                            "data": data,
                        });
                        console.log("sended to xterm");
                    });

                });
            // TODO: shell
        });

        s.conn.on('close', async () => {
            console.log('ssh', login.host, login.port, 'close')
        });

        s.conn.on('timeout', async () => {
            console.log('ssh', login.host, login.port, 'timeout')
        });

        const connArgs = { ...login };
        if (connArgs.usePassword) {
            connArgs.privateKey = undefined;
        } else {
            connArgs.password = undefined;
        }
        console.log("connecting...", JSON.stringify(connArgs));
        s.conn.connect({ ...connArgs });

        return s;
    }

    exeEnv() {
        return {
            'PATH': '$PATH:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/bin'
        };
    }

    getStat(uuid: string): LinuxStat {
        // console.log('get stat...');
        const s = this.srvStats.get(uuid);
        if (!s) {
            return undefined;
        }
        setTimeout(async () => {
            await checkAlert(s.serverLogins, s.stat, s.stat.online == OnlineStatus.ONLINE);
        }, 10);

        return s.stat;
    }

    calculateCpuLoad(s: LinuxSession, data: string) {
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

        if (!s.prev) {
            s.prev = {
                user: user,
                nice: nice,
                system: system,
                idle: idle,
                iowait: iowait,
                irq: irq,
                softirq: softirq,
                steal: steal,
            };
        } else {
            const prev = s.prev;
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
            s.stat.cpuload = CPU_Percentage;
            console.log('>>>>> cpu', CPU_Percentage);
        }
    }

    execGetStdout(s: LinuxSession, cmd: string, fn: (s: LinuxSession, data: string) => any) {
        try {
            s.conn.exec(cmd, { env: this.exeEnv() }, (err: any, stream: any) => {
                let content = '';
                if (err) {
                    console.log('error when ', cmd, s.serverLogins.host, s.serverLogins.port);
                    return;
                }
                stream.on('close', (code: number, signal: any) => {
                    fn(s, content)
                }).on('data', (data: string) => {
                    console.log('ondata...', cmd);
                    content = content + data;
                }).stderr.on('data', (data: string) => {
                    console.log('stderr ', cmd, data, s.serverLogins.host, s.serverLogins.port);
                });
            });
        } catch (e: any) {
            console.log('exception...', cmd);
        }
    }

    getCPULoad(s: LinuxSession) {
        this.execGetStdout(s, 'cat /proc/stat', (s: LinuxSession, data: string) => {
            this.calculateCpuLoad(s, data);
        });
    }

    getMemInfo(s: LinuxSession) {
        this.execGetStdout(s, 'cat /proc/meminfo', (s: LinuxSession, data: string) => {
            const getFieldsValue = (dataLines: string[], line: number): number => {
                if (line >= dataLines.length) {
                    console.log(`get ${line}-th line of data filed`);
                    return undefined;
                }
                const selectedLine = dataLines[line];
                const fields = selectedLine.split(/\s+/);
                if (fields.length < 2) {
                    console.log(`line ${selectedLine} get number failed`);
                    return undefined;
                }
                const value = Number(fields[1]);
                return value;
            }

            const lines = data.split('\n');
            if (lines.length < 3) {
                console.log('data empty');
                return;
            }
            const memtotal = getFieldsValue(lines, 0);
            const memavail = getFieldsValue(lines, 2);
            s.stat.memtotal = memtotal;
            s.stat.memavail = memavail;
            s.stat.memUsePercent = (memtotal - memavail) / memtotal;
            console.log(">>>>> mem: ", memtotal, memavail, s.stat.memUsePercent);
        });
    }

    getDiskStat(s: LinuxSession) {
        this.execGetStdout(s, 'df', (s: LinuxSession, data: string) => {
            const getFieldsValue = (line: string): DiskStat => {
                const fields = line.split(/\s+/);
                if (fields.length < 5) {
                    console.log(`line ${line} extract failed`);
                    return undefined;
                }
                const res = new DiskStat();
                res.name = fields[0];
                const total = Number(fields[1]);
                const avail = Number(fields[3]);
                res.usePercent = (total - avail) / total;
                return res;
            }
            const lines = data.split('\n');
            const disks: DiskStat[] = [];
            for (let i = 1; i < lines.length; i++) {
                const dstat = getFieldsValue(lines[i]);
                if (!dstat) {
                    continue;
                }
                // console.log('>>>>> disk ', dstat);
                if (dstat.name == 'tmpfs' ||
                    dstat.name == 'udev' ||
                    dstat.name == 'none' ||
                    dstat.name == 'overlay') {
                    // skip
                } else {
                    disks.push(dstat);
                }
            }
            s.stat.disks = disks;
        });
    }

    getStats(s: LinuxSession) {
        console.log('getStats', s.serverLogins.host, s.serverLogins.port);
        this.getCPULoad(s);
        this.getMemInfo(s);
        this.getDiskStat(s);
    }

    sshConnect(s: LinuxSession) {
        console.log('connecting', s.serverLogins.host, s.serverLogins.port);
        s.conn = new Client();
        s.stat.online = OnlineStatus.CONNECTING;
        s.conn.on('ready', async () => {
            s.stat.online = OnlineStatus.ONLINE;
            console.log('ssh', s.serverLogins.host, s.serverLogins.port, 'ready');
            this.getStats(s);
        });

        s.conn.on('close', async () => {
            s.stat.online = OnlineStatus.INIT;
            console.log('ssh', s.serverLogins.host, s.serverLogins.port, 'close')
        });

        s.conn.on('timeout', async () => {
            s.stat.online = OnlineStatus.INIT;
            console.log('ssh', s.serverLogins.host, s.serverLogins.port, 'timeout')
        });

        const connArgs = { ...s.serverLogins };
        if (connArgs.usePassword) {
            connArgs.privateKey = undefined;
        } else {
            connArgs.password = undefined;
        }
        s.conn.connect({ ...connArgs });
    }

    closeServer(uuid: string) {
        const s = this.srvStats.get(uuid);
        if (!s) {
            return;
        }
        console.log("closeing", s.serverLogins.name);
        s.conn && s.conn.end();
        s.closing = true;
        this.srvStats.delete(uuid);
    }

    registerServer(ss: ServerLogins) {
        console.log("conneting", ss.name, ss.host, ss.port, ss.uuid);
        let s = this.srvStats.get(ss.uuid);
        if (!s) {
            s = new LinuxSession();
            s.serverLogins = ss;
            this.srvStats.set(ss.uuid, s);
        }
        this.sshConnect(s);

        const fn = async (s: LinuxSession) => {
            if (s.closing) {
                console.log('server', s.serverLogins.name, 'close');
                return;
            }

            if (s.stat.online == OnlineStatus.INIT) {
                this.sshConnect(s);
            }

            if (s.stat.online == OnlineStatus.ONLINE) {
                this.getStats(s);
            }
            let timeoutMiseconds = 10 * 1000;
            if (!s.stat.cpuload) {
                timeoutMiseconds = 1000;
            }

            setTimeout(() => {
                (async () => {
                    await fn(s);
                })();
            }, timeoutMiseconds);
        };

        fn(s);
    }
}

const OnlineStatus = {
    INIT: 'INIT',
    CONNECTING: 'CONNECTING',
    ONLINE: 'ONLINE',
}

export class DiskStat {
    name: string
    usePercent: number
}

export class LinuxStat {
    cpuload: number
    memavail: number
    memtotal: number
    memUsePercent: number
    online: string = OnlineStatus.INIT
    disks: DiskStat[] = []
}

export class LinuxSession {
    stat: LinuxStat = new LinuxStat()
    serverLogins: ServerLogins
    conn: Client
    closing = false
    prev: PrevData
}

class PrevData {
    user: number
    nice: number
    system: number
    idle: number
    iowait: number
    irq: number
    softirq: number
    steal: number
}

export class ShellSession {
    login: ServerLogins
    conn: Client
    stream: ClientChannel
}

