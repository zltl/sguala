import { clipboard } from 'electron';
import { loadConfig, mergeConfig, storeConfig } from './conf';

export async function exportConfigToClipbard() {
    const confObj = await loadConfig();
    const confText = JSON.stringify(confObj);
    clipboard.writeText(confText);
}

export async function mergeConfigFromClipbard(): Promise<string> {
    const clipText = clipboard.readText();
    return mergeConfig(clipText);
}

