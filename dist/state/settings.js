/**
 * Simple settings store — just the memory toggle.
 * Defaults to ON for consumer users.
 */
import { readJsonFile, writeJsonFile } from './storage.js';
const SETTINGS_FILE = 'settings.json';
let settings = null;
async function ensureLoaded() {
    if (!settings) {
        settings = await readJsonFile(SETTINGS_FILE, { memoryEnabled: true });
    }
    return settings;
}
export async function isMemoryEnabled() {
    const s = await ensureLoaded();
    return s.memoryEnabled;
}
export async function setMemoryEnabled(enabled) {
    settings = { memoryEnabled: enabled };
    await writeJsonFile(SETTINGS_FILE, settings);
}
