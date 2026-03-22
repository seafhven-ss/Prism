# Prism

An AI assistant daemon that bridges QQ with KIMI Code.

Prism receives messages from QQ (via OneBot v11), sends them to KIMI Code CLI, and returns the AI responses — with multi-level memory management, conversation context, and daily log auto-summarization.

## Features

- **QQ integration** via OneBot v11 (NapCat, go-cqhttp, Lagrange.OneBot)
- **KIMI Code** as the AI engine
- **Three-level memory system** with per-entry token counting
- **Voice messages** via local whisper-cli (speech-to-text)
- **Daily logs** with auto-summarization and weekly compaction
- **Personality customization** via SOUL.md / USER.md

## Memory Architecture

Prism uses a three-level hierarchical memory system, each level has per-entry token estimation:

| Level | Name | Storage | Lifecycle |
|-------|------|---------|-----------|
| L1 | Short-term conversation | RAM | Last 10 turns per chat, 2-hour idle timeout |
| L2 | Long-term memory | `data/MEMORY.md` | Manual (`/mem add`) or extracted (`/remember`), persistent |
| L3 | Auto-summary | `data/MEMORY.md` | Daily auto-summarize → weekly auto-compact when > 5 daily entries |

### Token Counting

Every memory entry includes a token estimate (`[~N tokens]`), calculated using:
- CJK characters: 0.5 tokens each
- ASCII characters: 0.25 tokens each

Token counts are visible in:
- `/mem` — per-level subtotals
- `/mem show` — per-entry and per-level breakdown
- `/status` — overall and per-level summary
- `data/MEMORY.md` — in each section header

### Memory File Format

```markdown
## #1 Title [~42 tokens]
Content text

## #2 daily:2026-03-21 [~35 tokens]
Auto-summarized daily content

## #3 weekly:2026-03-15~2026-03-21 [~80 tokens]
Auto-compacted weekly summary
```

### Prompt Composition

Prompts are assembled in this order:
1. `[System]` — SOUL.md (personality)
2. `[User Profile]` — USER.md (user context)
3. `[Long-term Memory]` — All L2/L3 entries (if memory enabled)
4. `[Conversation History]` — L1 recent turns
5. `[Current Message]` — User's new message

## Quick Start

### Prerequisites

- Node.js >= 18
- [KIMI CLI](https://github.com/MoonshotAI/kimi-cli) installed and authenticated
- [NapCat](https://github.com/NapNeko/NapCatQQ) or any OneBot v11 compatible QQ framework

### Setup

```bash
cd Prism
npm install

cp .env.example .env
# Edit .env with your QQ bot credentials and user ID

# Optional: customize personality
cp data/SOUL.example.md data/SOUL.md
cp data/USER.example.md data/USER.md

npm run dev
```

### Configuration

Edit `.env`:

| Variable | Description |
|---|---|
| `ONEBOT_WS_URL` | OneBot WebSocket URL (default: `ws://127.0.0.1:3001`) |
| `ONEBOT_TOKEN` | OneBot access token |
| `BOT_QQ_ID` | QQ bot account ID |
| `ALLOWED_USER_ID` | Your QQ user ID (only this user can interact) |
| `KIMICODE_BIN` | Path to KIMI CLI (default: `kimi`) |
| `KIMICODE_TIMEOUT_MS` | KIMI response timeout in ms (default: `600000`) |
| `FFMPEG_BIN` | Path to ffmpeg (for voice messages) |
| `WHISPER_BIN` | Path to whisper-cli (for voice messages) |
| `WHISPER_MODEL_PATH` | Whisper model file path |

## Commands

| Command | Description |
|---|---|
| Direct message | Chat with AI (default) |
| `/mem` | Memory status with per-level breakdown |
| `/mem on\|off` | Toggle long-term memory |
| `/mem show` | View all memories grouped by level with token counts |
| `/mem add <content>` | Add manual memory entry |
| `/mem del <id>` | Delete a memory entry |
| `/mem clear` | Clear all memories |
| `/remember [hint]` | Extract current conversation key points into memory |
| `/new` | Clear conversation history, start new session |
| `/status` | View engine status and memory stats |
| `/help` | Show help with memory architecture explanation |

## License

MIT
