/**
 * Speech-to-Text: local whisper.cpp (pre-bundled).
 */
import { writeFile, readFile, unlink, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { runCli } from './shell.js';
const TMP_DIR = join(tmpdir(), 'prism', 'voice');
const MODEL_CACHE_DIR = join(tmpdir(), 'prism', 'whisper-models');
const MODEL_CACHE_PATH = join(MODEL_CACHE_DIR, 'ggml-tiny.bin');
async function ensureAsciiModelPath() {
    await mkdir(MODEL_CACHE_DIR, { recursive: true });
    try {
        const cached = await readFile(MODEL_CACHE_PATH);
        if (cached.length > 0) {
            return MODEL_CACHE_PATH;
        }
    }
    catch {
        // cache miss
    }
    await copyFile(config.WHISPER_MODEL_PATH, MODEL_CACHE_PATH);
    return MODEL_CACHE_PATH;
}
/**
 * Transcribe audio buffer to text using local whisper.cpp.
 */
export async function transcribe(audioBuffer) {
    return transcribeLocal(audioBuffer);
}
async function transcribeLocal(audioBuffer) {
    await mkdir(TMP_DIR, { recursive: true });
    const id = randomBytes(4).toString('hex');
    const oggPath = join(TMP_DIR, `voice-${id}.ogg`);
    const wavPath = join(TMP_DIR, `voice-${id}.wav`);
    const txtPath = join(TMP_DIR, `voice-${id}.txt`);
    try {
        await writeFile(oggPath, audioBuffer);
        const modelPath = await ensureAsciiModelPath();
        console.log(`[STT] Local: converting OGG → WAV (${audioBuffer.length} bytes)...`);
        await runCli(config.FFMPEG_BIN, [
            '-i', oggPath,
            '-ar', '16000',
            '-ac', '1',
            '-y',
            wavPath,
        ], { timeoutMs: 30_000 });
        console.log(`[STT] Local: transcribing with whisper-cli...`);
        const { stdout } = await runCli(config.WHISPER_BIN, [
            '--model', modelPath,
            '--language', config.WHISPER_LANGUAGE,
            '--no-timestamps',
            '--no-prints',
            '--output-txt',
            '--output-file', join(TMP_DIR, `voice-${id}`),
            wavPath,
        ], { timeoutMs: config.WHISPER_TIMEOUT_MS });
        let text;
        try {
            text = (await readFile(txtPath, 'utf8')).trim();
        }
        catch {
            text = parseWhisperOutput(stdout);
        }
        if (!text)
            throw new Error('Local whisper returned empty transcription');
        return text;
    }
    finally {
        await unlink(oggPath).catch(() => { });
        await unlink(wavPath).catch(() => { });
        await unlink(txtPath).catch(() => { });
    }
}
function parseWhisperOutput(stdout) {
    return stdout
        .split('\n')
        .map((line) => line.replace(/^\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/, '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
}
