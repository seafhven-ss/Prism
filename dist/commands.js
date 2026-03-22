/**
 * Simplified command handler — 6 user-facing commands.
 *
 * /help, /status, /mem, /remember, /new, + plain text → ask
 */
import { dispatchAsk } from './ask.js';
import { kimiAsk, getKimiStatus } from './kimi.js';
import { conversationStore } from './state/conversation.js';
import { memoryStore } from './state/memory.js';
import { isMemoryEnabled, setMemoryEnabled } from './state/settings.js';
export async function handleCommand(text, chatId, chatType, _fromUserId) {
    const trimmed = text.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    if (command === '/help')
        return handleHelp();
    if (command === '/ping')
        return { messages: ['pong'] };
    if (command === '/status')
        return handleStatus();
    if (command === '/ask') {
        const content = trimmed.slice(4).trim();
        if (!content)
            return { messages: ['用法：/ask <内容>'] };
        await dispatchAsk(content, chatId, chatType);
        return { messages: [] };
    }
    if (command === '/mem') {
        const memArgs = trimmed.slice(4).trim();
        return handleMem(memArgs);
    }
    if (command === '/remember') {
        const hint = trimmed.slice(9).trim();
        return handleRemember(chatId, hint);
    }
    if (command === '/new') {
        conversationStore.clear(chatId);
        return { messages: ['对话已清除，开始新会话。'] };
    }
    return null;
}
function handleHelp() {
    return {
        messages: [
            [
                'Prism 命令：',
                '',
                '直接发消息    和 AI 聊天（默认）',
                '/mem          记忆管理（on|off|show|add|del|clear）',
                '/remember     提炼当前对话要点存入记忆',
                '/new          清除对话历史，开始新会话',
                '/status       查看连接状态',
                '/help         显示此帮助',
                '',
                '记忆体系（三级）：',
                '  L1 短期对话  当前会话上下文（最近10轮，2小时超时自动清除）',
                '  L2 长期记忆  手动添加或 /remember 提取的要点（持久化）',
                '  L3 自动摘要  每日对话自动提炼 → 超过5条自动合并为周报',
            ].join('\n'),
        ],
    };
}
async function handleStatus() {
    const status = await getKimiStatus();
    const memEnabled = await isMemoryEnabled();
    const levels = await memoryStore.getByLevel();
    const totalEntries = levels.manual.count + levels.daily.count + levels.weekly.count;
    const totalTokens = levels.manual.tokens + levels.daily.tokens + levels.weekly.tokens;
    const lines = [
        `引擎：KIMI Code ${status.online ? '(在线)' : '(离线)'}`,
        status.version ? `版本：${status.version}` : '',
        status.error ? `错误：${status.error}` : '',
        `记忆：${memEnabled ? '开启' : '关闭'} (${totalEntries} 条，~${totalTokens} tokens)`,
        `  手动记忆  ${levels.manual.count} 条  ~${levels.manual.tokens} tokens`,
        `  日摘要    ${levels.daily.count} 条  ~${levels.daily.tokens} tokens`,
        `  周报      ${levels.weekly.count} 条  ~${levels.weekly.tokens} tokens`,
    ].filter(Boolean);
    return { messages: [lines.join('\n')] };
}
async function handleMem(args) {
    const parts = args.split(/\s+/);
    const sub = parts[0]?.toLowerCase() ?? '';
    switch (sub) {
        case '': {
            const enabled = await isMemoryEnabled();
            const levels = await memoryStore.getByLevel();
            const totalEntries = levels.manual.count + levels.daily.count + levels.weekly.count;
            const totalTokens = levels.manual.tokens + levels.daily.tokens + levels.weekly.tokens;
            return {
                messages: [
                    [
                        `记忆：${enabled ? '开启' : '关闭'}`,
                        `条目：${totalEntries}，约 ~${totalTokens} tokens`,
                        `  手动记忆  ${levels.manual.count} 条  ~${levels.manual.tokens} tokens`,
                        `  日摘要    ${levels.daily.count} 条  ~${levels.daily.tokens} tokens`,
                        `  周报      ${levels.weekly.count} 条  ~${levels.weekly.tokens} tokens`,
                        '',
                        '用法：',
                        '/mem on       开启记忆',
                        '/mem off      关闭记忆',
                        '/mem show     查看所有记忆（按级别分组）',
                        '/mem add <内容>  添加记忆',
                        '/mem del <id>  删除记忆',
                        '/mem clear    清空所有记忆',
                    ].join('\n'),
                ],
            };
        }
        case 'on': {
            await setMemoryEnabled(true);
            return { messages: ['记忆已开启。'] };
        }
        case 'off': {
            await setMemoryEnabled(false);
            return { messages: ['记忆已关闭。'] };
        }
        case 'show': {
            const levels = await memoryStore.getByLevel();
            const totalEntries = levels.manual.count + levels.daily.count + levels.weekly.count;
            if (totalEntries === 0) {
                return { messages: ['暂无记忆。用 /mem add <内容> 添加。'] };
            }
            const sections = [];
            if (levels.manual.count > 0) {
                sections.push(`── 手动记忆 (${levels.manual.count} 条，~${levels.manual.tokens} tokens) ──`);
                for (const e of levels.manual.entries) {
                    sections.push(`#${e.id} ${e.title} [~${e.tokens} tokens]\n${e.content}`);
                }
            }
            if (levels.daily.count > 0) {
                sections.push(`── 日摘要 (${levels.daily.count} 条，~${levels.daily.tokens} tokens) ──`);
                for (const e of levels.daily.entries) {
                    sections.push(`#${e.id} ${e.title} [~${e.tokens} tokens]\n${e.content}`);
                }
            }
            if (levels.weekly.count > 0) {
                sections.push(`── 周报 (${levels.weekly.count} 条，~${levels.weekly.tokens} tokens) ──`);
                for (const e of levels.weekly.entries) {
                    sections.push(`#${e.id} ${e.title} [~${e.tokens} tokens]\n${e.content}`);
                }
            }
            const totalTokens = levels.manual.tokens + levels.daily.tokens + levels.weekly.tokens;
            sections.push(`\n共 ${totalEntries} 条，~${totalTokens} tokens`);
            return { messages: [sections.join('\n\n')] };
        }
        case 'add': {
            const content = parts.slice(1).join(' ').trim();
            if (!content)
                return { messages: ['用法：/mem add <标题>: <内容>'] };
            const colonIdx = content.indexOf(':');
            let title;
            let body;
            if (colonIdx > 0 && colonIdx < 30) {
                title = content.slice(0, colonIdx).trim();
                body = content.slice(colonIdx + 1).trim() || title;
            }
            else {
                title = content.slice(0, 20).trim();
                body = content;
            }
            const entry = await memoryStore.add(title, body);
            return { messages: [`已添加记忆 #${entry.id}「${entry.title}」(~${entry.tokens} tokens)`] };
        }
        case 'del': {
            const id = parseInt(parts[1], 10);
            if (isNaN(id))
                return { messages: ['用法：/mem del <id>'] };
            const ok = await memoryStore.remove(id);
            return { messages: [ok ? `已删除记忆 #${id}` : `记忆 #${id} 不存在`] };
        }
        case 'clear': {
            const count = await memoryStore.clear();
            return { messages: [`已清空所有记忆（${count} 条）`] };
        }
        default:
            return { messages: ['未知命令。输入 /mem 查看用法。'] };
    }
}
async function handleRemember(chatId, hint) {
    const history = conversationStore.getContextString(chatId);
    if (!history) {
        return { messages: ['当前没有对话记录，先聊几句再试。'] };
    }
    const extractPrompt = [
        '你是一个记忆提炼助手。从以下对话中提取值得记住的要点。',
        hint ? `用户提示：${hint}` : '',
        '规则：',
        '- 输出：第一行标题（20字以内），空行，然后要点',
        '- 简明扼要，保留关键信息',
        '- 如果有多个话题，只提取最重要的一个',
        '- 直接输出，不要前缀说明',
        '',
        '对话内容：',
        history,
    ].filter(Boolean).join('\n');
    try {
        const result = await kimiAsk(extractPrompt);
        const text = result.trim();
        const lines = text.split('\n');
        const title = lines[0].replace(/^#+\s*/, '').slice(0, 30).trim();
        const body = lines.slice(1).join('\n').trim() || title;
        const entry = await memoryStore.add(title, body);
        return {
            messages: [`已保存记忆 #${entry.id}「${entry.title}」(~${entry.tokens} tokens)\n\n${body}`],
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { messages: [`提取失败：${msg}`] };
    }
}
