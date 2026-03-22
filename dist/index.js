/**
 * Prism — QQ AI 助手，一键安装，开箱即用。
 *
 * QQ (OneBot v11) + KIMI Code
 */
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { qqAdapter } from './qq/adapter.js';
import { createHandler } from './qq/handler.js';
import { loadBootstrapFiles } from './state/bootstrap.js';
// ── PID lock ─────────────────────────────────────────────────────────────────
const PID_FILE = join(import.meta.dirname ?? '.', '..', 'daemon.pid');
function acquireLock() {
    if (existsSync(PID_FILE)) {
        const oldPid = readFileSync(PID_FILE, 'utf8').trim();
        try {
            process.kill(Number(oldPid), 0);
            console.error(`[错误] 已有一个 Prism 在运行 (PID ${oldPid})，请先关闭它。`);
            process.exit(1);
        }
        catch {
            // stale PID file
        }
    }
    writeFileSync(PID_FILE, String(process.pid), 'utf8');
}
function releaseLock() {
    try {
        unlinkSync(PID_FILE);
    }
    catch { /* ignore */ }
}
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    acquireLock();
    console.log('');
    console.log('  Prism - QQ AI 助手');
    console.log('  ==================');
    console.log('');
    // Load personality files
    await loadBootstrapFiles();
    // Start QQ connection
    const handler = createHandler();
    try {
        const self = await qqAdapter.getSelf();
        console.log(`  QQ 机器人已连接：${self.nickname} (${self.userId})`);
    }
    catch {
        console.log('  QQ 连接中...（等待 NapCat）');
    }
    await qqAdapter.start(handler);
    console.log('');
    console.log('  Prism 已启动！在 QQ 上给机器人发消息试试。');
    console.log('  按 Ctrl+C 停止。');
    console.log('');
}
main().catch((error) => {
    console.error('[错误]', error);
    process.exit(1);
});
