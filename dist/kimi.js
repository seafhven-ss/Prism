/**
 * KIMI Code CLI wrapper — direct integration, no abstract interface.
 *
 * Uses --print mode for non-interactive execution:
 *   kimiAsk() — runs `kimi --print --final-message-only`, pipes prompt via stdin
 *
 * KIMI Code CLI: https://github.com/MoonshotAI/kimi-cli
 */
import { config } from './config.js';
import { runCli } from './utils/shell.js';
/** Force Python-based CLIs to use UTF-8 regardless of Windows code page. */
function getKimiEnv() {
    return {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
    };
}
/**
 * Send a prompt to KIMI Code and return the text response.
 */
export async function kimiAsk(prompt) {
    console.log(`[KIMI] ask(): timeout=${config.KIMICODE_TIMEOUT_MS}ms`);
    const { stdout } = await runCli(config.KIMICODE_BIN, ['--print', '--final-message-only'], {
        timeoutMs: config.KIMICODE_TIMEOUT_MS,
        stdin: prompt,
        env: getKimiEnv(),
    });
    if (!stdout)
        throw new Error('KIMI Code: empty response');
    return stdout;
}
/**
 * Check if KIMI CLI is available.
 */
export async function getKimiStatus() {
    try {
        const { stdout } = await runCli(config.KIMICODE_BIN, ['--version'], {
            timeoutMs: 10_000,
            env: getKimiEnv(),
        });
        return { online: true, version: stdout.split('\n')[0].trim() };
    }
    catch (err) {
        return { online: false, error: err instanceof Error ? err.message : String(err) };
    }
}
