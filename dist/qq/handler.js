import { qqAdapter } from './adapter.js';
import { config } from '../config.js';
import { isUserAllowed } from '../security.js';
import { handleCommand } from '../commands.js';
import { dispatchAsk } from '../ask.js';

/**
 * Create the message handler for the QQ adapter.
 */
export function createHandler() {
    return async function processMessage(message) {
        const { senderId, chatId, chatType, text, record } = message;
        console.log(`[QQ] 收到消息: sender=${senderId}, chatId=${chatId}, type=${chatType}, text="${text?.slice(0, 50)}"`);

        if (config.BOT_QQ_ID && senderId === config.BOT_QQ_ID) {
            console.log('[QQ] 忽略机器人自身消息');
            return;
        }

        if (!isUserAllowed(senderId)) {
            console.log(`[QQ] 忽略未授权用户 ${senderId}, ALLOWED=${config.ALLOWED_USER_ID}`);
            return;
        }

        try {
            if (record) {
                await qqAdapter.sendMessage(chatId, chatType, '当前版本为纯文字版，请直接发送文字消息。');
                return;
            }

            if (!text)
                return;

            const result = await handleCommand(text, chatId, chatType, senderId);
            if (result) {
                for (const msg of result.messages) {
                    await qqAdapter.sendMessage(chatId, chatType, msg);
                }
            }
            else if (!text.startsWith('/')) {
                await dispatchAsk(text.trim(), chatId, chatType);
            }
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[QQ] Error: ${errMsg}`);
            try {
                await qqAdapter.sendMessage(chatId, chatType, `出错了：${errMsg}`);
            }
            catch {
                console.error('[QQ] Failed to send error notification');
            }
        }
    };
}
