import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(THIS_DIR, '..', '.env');
const PROJECT_DIR = join(THIS_DIR, '..');
function stripQuotes(value) {
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}
function loadEnvFile() {
    if (!existsSync(ENV_PATH))
        return;
    const raw = readFileSync(ENV_PATH, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0)
            continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = stripQuotes(trimmed.slice(eqIndex + 1).trim());
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}
loadEnvFile();
function resolveProjectPath(value, fallback) {
    const actual = value || fallback;
    return isAbsolute(actual) ? actual : join(PROJECT_DIR, actual);
}
function parseBool(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
export const config = {
    ONEBOT_WS_URL: process.env.ONEBOT_WS_URL || 'ws://127.0.0.1:3001',
    ONEBOT_TOKEN: process.env.ONEBOT_TOKEN || '',
    BOT_QQ_ID: process.env.BOT_QQ_ID || '',
    ALLOWED_USER_ID: process.env.ALLOWED_USER_ID || '',
    KIMICODE_BIN: process.env.KIMICODE_BIN || 'kimi',
    KIMICODE_TIMEOUT_MS: parseInt(process.env.KIMICODE_TIMEOUT_MS || '600000', 10),
    FFMPEG_BIN: process.env.FFMPEG_BIN || 'ffmpeg.exe',
    WHISPER_BIN: process.env.WHISPER_BIN || 'whisper-cli.exe',
    WHISPER_MODEL_PATH: resolveProjectPath(process.env.WHISPER_MODEL_PATH, 'models\\ggml-tiny.bin'),
    WHISPER_LANGUAGE: process.env.WHISPER_LANGUAGE || 'zh',
    WHISPER_TIMEOUT_MS: parseInt(process.env.WHISPER_TIMEOUT_MS || '120000', 10),
    VOICE_TRANSCRIPT_CORRECTION: parseBool(process.env.VOICE_TRANSCRIPT_CORRECTION, true),
};
