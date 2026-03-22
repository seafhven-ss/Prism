/**
 * Bootstrap file loader — reads SOUL.md and USER.md once on startup.
 * Always injected into prompts regardless of /mem on|off.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const DATA_DIR = join(process.cwd(), 'data');
let soulContent = '';
let userContent = '';
export async function loadBootstrapFiles() {
    soulContent = await safeRead(join(DATA_DIR, 'SOUL.md'));
    userContent = await safeRead(join(DATA_DIR, 'USER.md'));
    console.log(`[Bootstrap] SOUL.md: ${soulContent.length} chars, USER.md: ${userContent.length} chars`);
}
export function getSoulPrompt() {
    return soulContent;
}
export function getUserPrompt() {
    return userContent;
}
async function safeRead(filePath) {
    try {
        return (await readFile(filePath, 'utf8')).trim();
    }
    catch {
        return '';
    }
}
