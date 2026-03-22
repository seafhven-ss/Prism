/**
 * Daily conversation log + auto-summarize + compaction.
 *
 * 1. Every message is appended to `data/logs/YYYY-MM-DD.txt`
 * 2. On the first message of a new day, yesterday's log is auto-summarized
 * 3. When daily entries exceed 5, they are merged into a weekly summary
 */
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { memoryStore } from './memory.js';
import { kimiAsk } from '../kimi.js';
const LOGS_DIR = join(process.cwd(), 'data', 'logs');
const MAX_DAILY_ENTRIES = 5;
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}
function timeStr() {
    return new Date().toISOString().slice(11, 19);
}
function logFilePath(dateStr) {
    return join(LOGS_DIR, `${dateStr}.txt`);
}
class DailyLog {
    lastDate = null;
    summarizing = false;
    async logMessage(role, content) {
        try {
            const today = todayStr();
            if (this.lastDate && this.lastDate !== today && !this.summarizing) {
                void this.summarizeDay(this.lastDate);
            }
            this.lastDate = today;
            await mkdir(LOGS_DIR, { recursive: true });
            const line = `[${timeStr()}] ${role}: ${content}\n`;
            const filePath = logFilePath(today);
            let existing = '';
            try {
                existing = await readFile(filePath, 'utf8');
            }
            catch {
                // File doesn't exist yet
            }
            await writeFile(filePath, existing + line, 'utf8');
        }
        catch (err) {
            console.error(`[DailyLog] Failed to log: ${err}`);
        }
    }
    async summarizeDay(dateStr) {
        if (this.summarizing)
            return;
        this.summarizing = true;
        try {
            const target = dateStr ?? yesterdayStr();
            const filePath = logFilePath(target);
            try {
                await stat(filePath);
            }
            catch {
                return;
            }
            const logContent = await readFile(filePath, 'utf8');
            if (!logContent.trim())
                return;
            const entries = await memoryStore.getAll();
            if (entries.some((e) => e.title === `daily:${target}`))
                return;
            const prompt = [
                '你是一个记忆提炼助手。从以下对话日志中提取当日的关键结论、决策和变更。',
                '规则：',
                '- 只保留结论/决策/事实性变更，不要过程描述',
                '- 用中文输出，按话题分条，每条一行',
                '- 总长度不超过 150 字',
                '- 如果没有值得记录的内容，输出：无重要事项',
                '- 直接输出结果，不要前缀说明',
                '',
                `日期：${target}`,
                '对话日志：',
                logContent,
            ].join('\n');
            const summary = await kimiAsk(prompt);
            const trimmed = summary.trim();
            if (trimmed === '无重要事项' || !trimmed) {
                await unlink(filePath).catch(() => { });
                return;
            }
            await memoryStore.add(`daily:${target}`, trimmed);
            console.log(`[DailyLog] Saved daily summary for ${target}`);
            await unlink(filePath).catch(() => { });
            await this.maybeCompact();
        }
        catch (err) {
            console.error(`[DailyLog] Summarization failed: ${err}`);
        }
        finally {
            this.summarizing = false;
        }
    }
    async maybeCompact() {
        try {
            const entries = await memoryStore.getAll();
            const dailyEntries = entries.filter((e) => e.title.startsWith('daily:'));
            if (dailyEntries.length <= MAX_DAILY_ENTRIES)
                return;
            console.log(`[DailyLog] ${dailyEntries.length} daily entries, compacting...`);
            dailyEntries.sort((a, b) => a.title.localeCompare(b.title));
            const firstDate = dailyEntries[0].title.replace('daily:', '');
            const lastDate = dailyEntries[dailyEntries.length - 1].title.replace('daily:', '');
            const combined = dailyEntries
                .map((e) => `[${e.title.replace('daily:', '')}] ${e.content}`)
                .join('\n');
            const prompt = [
                '你是一个记忆压缩助手。将以下多日摘要合并为一条周报。',
                '规则：',
                '- 合并重复信息，保留关键结论和决策',
                '- 用中文输出，按话题分条',
                '- 总长度不超过 300 字',
                '- 直接输出结果，不要前缀说明',
                '',
                '多日摘要：',
                combined,
            ].join('\n');
            const merged = await kimiAsk(prompt);
            const trimmed = merged.trim();
            await memoryStore.removeByTitlePrefix('daily:');
            await memoryStore.add(`weekly:${firstDate}~${lastDate}`, trimmed);
            console.log(`[DailyLog] Created weekly summary: ${firstDate}~${lastDate}`);
        }
        catch (err) {
            console.error(`[DailyLog] Compaction failed: ${err}`);
        }
    }
}
export const dailyLog = new DailyLog();
