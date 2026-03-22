/**
 * Short-term conversation history — kept in memory, lost on restart.
 * Maintains the last N turns per chat so the LLM has context.
 * Uses string chatId for IM-agnostic design.
 */
const MAX_TURNS = 10;
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours idle → auto-clear
function estimateTokens(text) {
    let count = 0;
    for (const char of text) {
        count += char.charCodeAt(0) > 0x2e80 ? 0.5 : 0.25;
    }
    return Math.max(1, Math.ceil(count));
}
class ConversationStore {
    histories = new Map();
    addUser(chatId, content) {
        this.ensureSession(chatId);
        const turns = this.histories.get(chatId);
        turns.push({ role: 'user', content, timestamp: Date.now() });
        this.trim(chatId);
    }
    addAssistant(chatId, content) {
        this.ensureSession(chatId);
        const turns = this.histories.get(chatId);
        turns.push({ role: 'assistant', content, timestamp: Date.now() });
        this.trim(chatId);
    }
    getContextString(chatId) {
        const turns = this.histories.get(chatId);
        if (!turns || turns.length === 0)
            return '';
        return turns
            .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
            .join('\n');
    }
    turnCount(chatId) {
        return this.histories.get(chatId)?.length ?? 0;
    }
    tokenCount(chatId) {
        const turns = this.histories.get(chatId);
        if (!turns || turns.length === 0) return 0;
        return turns.reduce((sum, t) => sum + estimateTokens(t.content), 0);
    }
    clear(chatId) {
        this.histories.delete(chatId);
    }
    ensureSession(chatId) {
        const turns = this.histories.get(chatId);
        if (turns && turns.length > 0) {
            const lastTs = turns[turns.length - 1].timestamp;
            if (Date.now() - lastTs > SESSION_TIMEOUT_MS) {
                this.histories.set(chatId, []);
                return;
            }
        }
        if (!turns) {
            this.histories.set(chatId, []);
        }
    }
    trim(chatId) {
        const turns = this.histories.get(chatId);
        if (turns && turns.length > MAX_TURNS * 2) {
            this.histories.set(chatId, turns.slice(-MAX_TURNS * 2));
        }
    }
}
export const conversationStore = new ConversationStore();
