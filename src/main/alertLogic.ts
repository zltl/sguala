import { AlertConfig } from './alertConfig';
import { loadConfig } from './conf';
import { SendMail } from './sendEmail';
import { ServerLogins } from './serverlogins';
import { LinuxStat } from './ssh';

class AlertState {
    conf: AlertConfig
    prevCPUMatchTs = 0
    prevMemMatchTs = 0
    prevDiskMatchTs = 0
    prevUpMatchTs = 0
}

let alerts: Map<string, AlertState>;

export async function checkAlert(login: ServerLogins, stat: LinuxStat, up: boolean) {
    if (!alerts) {
        const config = await loadConfig();
        config.alerts.map((conf) => {
            const state = new AlertState();
            state.conf = conf;
            alerts.set(conf.uuid, state);
        });
    }

    const state = alerts.get(login.uuid);
    if (!state || !state.conf.isOpen) {
        return;
    }
    const curts = Math.floor(new Date().valueOf() / 1000);
    const conf = state.conf;

    if (!up) {
        if (conf.upCheck) {
            if (state.prevUpMatchTs == 0) {
                state.prevUpMatchTs = curts;
            }
            if (curts - state.prevUpMatchTs >= conf.upAlertForValue * 60) {
                console.log('alert host down ', login.name);
                await SendMail(conf, login, stat, false, false, false, true);
            }
        }
        return;
    }

    let alertCPU = false;
    let alertMem = false;
    let alertDisk = false;

    if (conf.cpuCheck) {
        if (stat.cpuload * 100 > conf.cpuAlertValue) {
            if (state.prevCPUMatchTs == 0) {
                state.prevCPUMatchTs = curts;
            }
            if (curts - state.prevCPUMatchTs >= conf.cpuAlertForValue * 60) {
                alertCPU = true;
            }
        } else {
            state.prevCPUMatchTs = 0;
        }
    }

    if (conf.memCheck) {
        if (stat.memUsePercent * 100 > conf.memAlertValue) {
            if (state.prevMemMatchTs == 0) {
                state.prevMemMatchTs = curts;
            }
            if (curts - state.prevMemMatchTs >= conf.memAlertForValue * 60) {
                alertMem = true;
            }
        } else {
            state.prevMemMatchTs = 0;
        }
    }

    if (conf.diskCheck) {
        let matched = false;
        for (const dst of stat.disks) {
            if (dst.usePercent * 100 > conf.diskAlertValue) {
                matched = true;
            }
        }
        if (matched) {
            if (state.prevDiskMatchTs == 0) {
                state.prevDiskMatchTs = curts;
            }
            if (curts - state.prevDiskMatchTs >= conf.diskAlertForValue * 60) {
                alertDisk = true;
            }
        } else {
            state.prevDiskMatchTs = 0;
        }
    }
    const alertDown = false;

    if (alertCPU || alertMem || alertDisk) {
        console.log('alert host ', login.name);
        await SendMail(conf, login, stat, alertCPU, alertMem, alertDisk, alertDown);
    }
}



