import { spawn } from 'node:child_process';
function getWindowsShell() {
    return process.env.ComSpec || 'C:\\WINDOWS\\system32\\cmd.exe';
}
/**
 * Build a clean environment for child processes.
 * Strips Claude Code nesting-guard env vars.
 */
function buildCleanEnv(base) {
    const env = { ...(base ?? process.env) };
    for (const key of Object.keys(env)) {
        const upper = key.toUpperCase();
        if (upper === 'CLAUDECODE' ||
            upper === 'CLAUDE_CODE' ||
            upper === 'CLAUDE_CODE_ENTRYPOINT' ||
            upper === 'CLAUDE_CODE_SESSION' ||
            upper.startsWith('CLAUDE_CODE_')) {
            delete env[key];
        }
    }
    return env;
}
/**
 * Run an external CLI and return its stdout/stderr.
 * Uses spawn with stdin piping to avoid shell quoting issues.
 */
export function runCli(bin, args, options) {
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const cleanEnv = buildCleanEnv(options?.env);
    return new Promise((resolve, reject) => {
        let settled = false;
        let stdoutBuf = '';
        let stderrBuf = '';
        const settle = (fn) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                fn();
            }
        };
        const child = spawn(bin, args, {
            cwd: options?.cwd,
            env: cleanEnv,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: process.platform === 'win32' ? getWindowsShell() : false,
            windowsHide: true,
        });
        const timer = setTimeout(() => {
            settle(() => {
                child.kill();
                reject(new Error(`CLI '${bin}' timed out after ${timeoutMs}ms`));
            });
        }, timeoutMs);
        child.stdout?.on('data', (chunk) => { stdoutBuf += chunk.toString(); });
        child.stderr?.on('data', (chunk) => { stderrBuf += chunk.toString(); });
        child.on('error', (err) => settle(() => reject(err)));
        child.on('close', (code) => {
            settle(() => {
                if (code === 0) {
                    resolve({ stdout: stdoutBuf.trim(), stderr: stderrBuf.trim() });
                }
                else {
                    const detail = stderrBuf.trim() || stdoutBuf.trim() || '(no output)';
                    reject(new Error(`CLI '${bin}' exited with code ${code ?? '?'}: ${detail}`));
                }
            });
        });
        if (options?.stdin !== undefined) {
            child.stdin?.write(options.stdin, 'utf8');
        }
        child.stdin?.end();
    });
}
