/**
 * OneBot v11 adapter for QQ.
 *
 * - Receives AND sends messages via WebSocket
 * - Auto-reconnects with exponential backoff
 * - Supports token authentication
 *
 * Compatible with: NapCat, go-cqhttp, Lagrange.OneBot, etc.
 */
import WebSocket from 'ws';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { config } from '../config.js';
function parseCqRecord(raw) {
    const match = raw.match(/\[CQ:record,([^\]]+)\]/i);
    if (!match)
        return null;
    const data = {};
    for (const pair of match[1].split(',')) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex <= 0)
            continue;
        data[pair.slice(0, eqIndex)] = pair.slice(eqIndex + 1);
    }
    return Object.keys(data).length > 0 ? data : null;
}
class OneBotAdapter {
    ws = null;
    onMessage = null;
    reconnectTimer = null;
    reconnectAttempt = 0;
    stopped = false;
    pendingCalls = new Map();
    echoCounter = 0;
    async start(onMessage) {
        this.onMessage = onMessage;
        this.stopped = false;
        this.connect();
    }
    async stop() {
        this.stopped = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        for (const [, pending] of this.pendingCalls) {
            pending.reject(new Error('WebSocket closed'));
        }
        this.pendingCalls.clear();
    }
    // ── Send API calls over WebSocket ──────────────────────────────────────────
    callApi(action, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }
            const echo = `api_${++this.echoCounter}_${Date.now()}`;
            const timer = setTimeout(() => {
                this.pendingCalls.delete(echo);
                reject(new Error(`OneBot API timeout: ${action}`));
            }, 30_000);
            this.pendingCalls.set(echo, {
                resolve: (data) => {
                    clearTimeout(timer);
                    resolve(data);
                },
                reject: (err) => {
                    clearTimeout(timer);
                    reject(err);
                },
            });
            const payload = JSON.stringify({ action, params, echo });
            this.ws.send(payload);
        });
    }
    async sendMessage(chatId, chatType, text) {
        console.log(`[QQ] 发送 -> ${chatType}(${chatId}): "${text.slice(0, 80)}"`);
        const message = text.replace(/\r\n/g, '\n');
        if (chatType === 'group') {
            await this.callApi('send_group_msg', {
                group_id: Number(chatId),
                message,
                auto_escape: false,
            });
        }
        else {
            await this.callApi('send_private_msg', {
                user_id: Number(chatId),
                message,
                auto_escape: false,
            });
        }
    }
    async getSelf() {
        const data = await this.callApi('get_login_info');
        return {
            userId: String(data.user_id),
            nickname: data.nickname,
        };
    }
    async getRecordBuffer(record) {
        const directPath = [record.path, record.file].find((candidate) => !!candidate && existsSync(candidate));
        if (directPath) {
            return readFile(directPath);
        }
        const directUrl = [record.url, record.file].find((candidate) => typeof candidate === 'string' && /^https?:\/\//i.test(candidate));
        if (directUrl) {
            const response = await fetch(directUrl);
            if (!response.ok) {
                throw new Error(`下载语音失败: HTTP ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        if (record.file) {
            const data = await this.callApi('get_record', {
                file: record.file,
                out_format: 'ogg',
            });
            const localPath = data?.file || data?.path;
            if (localPath && existsSync(localPath)) {
                return readFile(localPath);
            }
        }
        throw new Error('无法获取语音文件');
    }
    // ── WebSocket connection management ────────────────────────────────────────
    connect() {
        if (this.stopped)
            return;
        console.log(`[QQ] Connecting to ${config.ONEBOT_WS_URL}...`);
        const wsOptions = {};
        if (config.ONEBOT_TOKEN) {
            wsOptions.headers = {
                Authorization: `Bearer ${config.ONEBOT_TOKEN}`,
            };
        }
        const ws = new WebSocket(config.ONEBOT_WS_URL, wsOptions);
        this.ws = ws;
        ws.on('open', () => {
            console.log('[QQ] WebSocket connected');
            this.reconnectAttempt = 0;
        });
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                if (parsed.echo && this.pendingCalls.has(parsed.echo)) {
                    this.handleApiResponse(parsed);
                }
                else if (parsed.post_type) {
                    this.handleEvent(parsed);
                }
            }
            catch (err) {
                console.error('[QQ] Failed to parse message:', err);
            }
        });
        ws.on('close', (code, reason) => {
            console.log(`[QQ] WebSocket closed: code=${code} reason=${reason.toString()}`);
            this.ws = null;
            for (const [key, pending] of this.pendingCalls) {
                pending.reject(new Error('WebSocket disconnected'));
                this.pendingCalls.delete(key);
            }
            this.scheduleReconnect();
        });
        ws.on('error', (err) => {
            console.error(`[QQ] WebSocket error: ${err.message}`);
        });
    }
    handleApiResponse(data) {
        const pending = this.pendingCalls.get(data.echo);
        if (!pending)
            return;
        this.pendingCalls.delete(data.echo);
        if (data.retcode === 0) {
            pending.resolve(data.data);
        }
        else {
            pending.reject(new Error(`OneBot API error: retcode=${data.retcode} ${data.message ?? ''}`));
        }
    }
    scheduleReconnect() {
        if (this.stopped)
            return;
        this.reconnectAttempt++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 30_000);
        console.log(`[QQ] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }
    handleEvent(event) {
        if (event.post_type === 'meta_event')
            return;
        if (event.post_type !== 'message')
            return;
        const msgEvent = event;
        this.handleMessageEvent(msgEvent);
    }
    handleMessageEvent(event) {
        let text = '';
        let record = null;
        if (Array.isArray(event.message)) {
            const textParts = [];
            for (const seg of event.message) {
                if (seg.type === 'text') {
                    textParts.push(seg.data.text ?? '');
                }
                else if (!record && seg.type === 'record') {
                    record = seg.data ?? null;
                }
            }
            text = textParts.join('').trim();
        }
        else if (typeof event.message === 'string') {
            text = event.message.replace(/\[CQ:[^\]]+\]/g, '').trim();
        }
        else if (event.raw_message) {
            text = event.raw_message.replace(/\[CQ:[^\]]+\]/g, '').trim();
        }
        if (!record && event.raw_message) {
            record = parseCqRecord(event.raw_message);
        }
        const chatType = event.message_type === 'group' ? 'group' : 'private';
        const chatId = chatType === 'group'
            ? String(event.group_id)
            : String(event.user_id);
        const incoming = {
            messageId: String(event.message_id),
            chatId,
            chatType,
            senderId: String(event.user_id),
            text: text || undefined,
            record: record || undefined,
            raw: event,
        };
        if (this.onMessage) {
            void Promise.resolve(this.onMessage(incoming)).catch((err) => {
                console.error('[QQ] Message handler error:', err);
            });
        }
    }
}
export const qqAdapter = new OneBotAdapter();
