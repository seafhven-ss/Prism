/**
 * /ask dispatcher — assembles prompt and sends to KIMI Code.
 *
 * Prompt layers: SOUL + USER + [MEMORY] + [conversation history] + message
 * Fire-and-forget: returns immediately, sends result async via QQ.
 */
import { qqAdapter } from './qq/adapter.js';
import { kimiAsk } from './kimi.js';
import { isMemoryEnabled } from './state/settings.js';
import { conversationStore } from './state/conversation.js';
import { memoryStore } from './state/memory.js';
import { dailyLog } from './state/daily-log.js';
import { getSoulPrompt, getUserPrompt } from './state/bootstrap.js';
import { chunkText, formatChunks } from './utils/chunk.js';
import { cleanMarkdown } from './utils/format.js';
async function buildPrompt(content, chatId, memEnabled) {
    const parts = [];
    const soul = getSoulPrompt();
    if (soul)
        parts.push(`[System]\n${soul}`);
    const user = getUserPrompt();
    if (user)
        parts.push(`[User Profile]\n${user}`);
    if (memEnabled) {
        const memCtx = await memoryStore.getContextString();
        if (memCtx)
            parts.push(`[Long-term Memory]\n${memCtx}`);
    }
    const historyCtx = conversationStore.getContextString(chatId);
    if (historyCtx)
        parts.push(`[Conversation History]\n${historyCtx}`);
    parts.push(`[Current Message]\n${content}`);
    return parts.join('\n\n');
}
/**
 * Dispatch an /ask request. Returns immediately; result sent async.
 */
export async function dispatchAsk(content, chatId, chatType) {
    const memEnabled = await isMemoryEnabled();
    // Record user message
    conversationStore.addUser(chatId, content);
    void dailyLog.logMessage('user', content);
    // Fire-and-forget
    void executeAsk(content, chatId, chatType, memEnabled);
}
async function executeAsk(content, chatId, chatType, memEnabled) {
    try {
        const fullPrompt = await buildPrompt(content, chatId, memEnabled);
        console.log(`[Ask] Sending to KIMI (prompt ${fullPrompt.length} chars, mem=${memEnabled})`);
        const thinkingTimer = setTimeout(() => {
            qqAdapter.sendMessage(chatId, chatType, '... thinking ...').catch(() => { });
        }, 120_000);
        let response;
        try {
            response = await kimiAsk(fullPrompt);
        }
        finally {
            clearTimeout(thinkingTimer);
        }
        // Record assistant response
        const truncated = response.length > 500 ? response.slice(0, 497) + '...' : response;
        conversationStore.addAssistant(chatId, truncated);
        void dailyLog.logMessage('assistant', truncated);
        // Send response
        const fullText = cleanMarkdown(response);
        const chunks = chunkText(fullText);
        const parts = formatChunks(chunks);
        for (const part of parts) {
            await qqAdapter.sendMessage(chatId, chatType, part);
        }
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const truncatedErr = errMsg.length > 500 ? errMsg.slice(0, 497) + '...' : errMsg;
        try {
            await qqAdapter.sendMessage(chatId, chatType, `出错了：${truncatedErr}`);
        }
        catch (sendErr) {
            console.error(`[Ask] Failed to send error: ${sendErr}`);
        }
    }
}
