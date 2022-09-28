import { clipboard } from 'electron';
import { loadConfig, storeConfig } from './conf';

export async function exportConfigToClipbard() {
    const confObj = await loadConfig();
    const confText = JSON.stringify(confObj);
    clipboard.writeText(confText);
}

export async function mergeConfigFromClipbard(): Promise<string> {
    const clipText = clipboard.readText();
    const clipObj = JSON.parse(clipText);
    const config = await loadConfig();
    try {
        for (let i = 0; i < clipObj.servers.length; i++) {
            let found = false;
            const cs = clipObj.servers[i];
            for (let j = 0; j < config.servers.length; j++) {
                const ss = config.servers[j];
                if (cs.uuid == ss.uuid) {
                    found = true;
                    config.servers[j] = cs;
                }
            }
            if (!found) {
                config.servers.push(cs);
            }
        }
        for (let i = 0; i < clipObj.alerts.length; i++) {
            let found = false;
            const cs = clipObj.servers[i];
            if (cs.uuid == "0") {
                continue;
            }
            for (let j = 0; j < config.alerts.length; j++) {
                const ss = config.alerts[j];
                if (cs.uuid == ss.uuid) {
                    found = true;
                    config.alerts[j] = cs;
                }
            }
            if (!found) {
                config.alerts.push(cs);
            }
        }
        await storeConfig(config);
    } catch (e) {
        console.log("e merge Config", e);
        return String(e);
    }
}

