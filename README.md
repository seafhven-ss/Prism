# Prism

**Prism** is a lightweight AI assistant daemon that turns QQ into an intelligent terminal — bridging QQ messaging with KIMI Code CLI, featuring a three-level hierarchical memory system with per-entry token tracking.

Prism 是一个轻量级 AI 助手守护进程，将 QQ 变成智能终端。通过 OneBot v11 协议连接 QQ，以 KIMI Code CLI 作为 AI 引擎，内置三级分层记忆管理系统，每条记忆自动计算 token 用量。

---

## Why Prism / 为什么做这个

大多数 AI 聊天工具要么需要复杂的部署环境，要么缺乏上下文记忆管理。Prism 的设计目标是：

- **零门槛使用** — 双击 `install.bat` 即可完成安装，通过 QQ 直接对话，不需要命令行基础
- **记忆不丢失** — 三级记忆体系确保重要信息持久化，日志自动提炼，不会因为重启或时间流逝而遗忘关键上下文
- **Token 可见可控** — 每条记忆标注 token 估算，用户随时掌握上下文预算消耗
- **国产方案友好** — QQ 作为消息通道 + KIMI Code 作为 AI 引擎，无需翻墙或海外 API

## Features / 核心功能

- **QQ 即时通讯集成** — 通过 OneBot v11 协议（兼容 NapCat、go-cqhttp、Lagrange.OneBot）
- **KIMI Code AI 引擎** — 本地 CLI 调用，支持长上下文推理
- **三级记忆系统** — 短期对话 / 长期记忆 / 自动摘要，每条记忆带 token 计数
- **语音消息** — 本地 whisper-cli 语音转文字，支持中文识别
- **每日自动摘要** — 对话日志自动提炼关键结论，超过 5 条日摘要自动合并为周报
- **人格自定义** — 通过 SOUL.md / USER.md 定制 AI 性格和用户画像
- **纯中文交互** — 安装引导、命令、回复全程中文

---

## Memory Architecture / 记忆架构

Prism 采用三级分层记忆系统，每条记忆自动估算 token 用量：

| 级别 | 名称 | 存储位置 | 生命周期 |
|------|------|----------|----------|
| L1 | 短期对话 | 内存 | 最近 10 轮，闲置 2 小时自动清除，重启丢失 |
| L2 | 长期记忆 | `data/MEMORY.md` | 手动添加（`/mem add`）或 AI 提取（`/remember`），持久化 |
| L3 | 自动摘要 | `data/MEMORY.md` | 每日自动提炼 → 超过 5 条自动合并为周报，持久化 |

### Token 计数

每条记忆自动估算 token 消耗：
- 中文字符：0.5 tokens/字
- ASCII 字符：0.25 tokens/字

可在以下位置查看 token 信息：
- `/mem` — 按级别显示条目数和 token 小计
- `/mem show` — 按级别分组，每条记忆显示独立 token 数
- `/status` — 总览及各级别统计
- `data/MEMORY.md` — 每个条目标题中标注 `[~N tokens]`

### 记忆文件格式

```markdown
## #1 项目偏好 [~42 tokens]
用户偏好使用 TypeScript，喜欢简洁的代码风格

## #2 daily:2026-03-21 [~35 tokens]
确认了部署方案，选择 Vercel；修复了登录 bug

## #3 weekly:2026-03-15~2026-03-21 [~80 tokens]
本周完成了用户系统重构，切换到 JWT 认证...
```

### Prompt 组装顺序

```
[System]              ← SOUL.md（AI 人格）
[User Profile]        ← USER.md（用户画像）
[Long-term Memory]    ← L2 + L3 记忆条目（开启记忆时注入）
[Conversation History]← L1 近期对话
[Current Message]     ← 当前用户消息
```

---

## Quick Start / 快速开始

### 环境要求

- Node.js >= 18
- [KIMI CLI](https://github.com/nicepkg/kimi-cli) 已安装并完成登录
- [NapCat](https://github.com/NapNeko/NapCatQQ) 或其他 OneBot v11 兼容框架

### 一键安装（推荐）

双击 `install.bat`，按照中文引导完成配置。安装完成后会自动生成 `安装说明.txt`。

### 手动安装

```bash
cd Prism
npm install

cp .env.example .env
# 编辑 .env 填入 QQ 号和配置

# 可选：自定义 AI 人格
cp data/SOUL.example.md data/SOUL.md
cp data/USER.example.md data/USER.md
```

### 启动

```bash
# 一键启动
双击 start.bat

# 或手动启动
node dist/index.js
```

### 配置说明

编辑 `.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BOT_QQ_ID` | 机器人 QQ 号 | — |
| `ALLOWED_USER_ID` | 允许交互的用户 QQ 号 | — |
| `ONEBOT_WS_URL` | OneBot WebSocket 地址 | `ws://127.0.0.1:3001` |
| `ONEBOT_TOKEN` | OneBot 访问令牌 | — |
| `KIMICODE_BIN` | KIMI CLI 路径 | `kimi` |
| `KIMICODE_TIMEOUT_MS` | KIMI 超时（毫秒） | `600000` |
| `FFMPEG_BIN` | ffmpeg 路径（语音功能） | `ffmpeg.exe` |
| `WHISPER_BIN` | whisper-cli 路径（语音功能） | `whisper-cli.exe` |
| `WHISPER_MODEL_PATH` | Whisper 模型文件 | `models\ggml-tiny.bin` |

---

## Commands / 命令列表

| 命令 | 说明 |
|------|------|
| 直接发消息 | 和 AI 聊天（默认行为） |
| `/mem` | 查看记忆状态（按级别显示条目数和 token） |
| `/mem on` \| `off` | 开启 / 关闭长期记忆 |
| `/mem show` | 查看所有记忆（按级别分组，含 token 计数） |
| `/mem add <内容>` | 手动添加记忆条目 |
| `/mem del <id>` | 删除指定记忆 |
| `/mem clear` | 清空全部记忆 |
| `/remember [提示]` | 让 AI 提取当前对话要点存入记忆 |
| `/new` | 清除对话历史，开始新会话 |
| `/status` | 查看引擎状态和记忆统计 |
| `/help` | 显示帮助（含记忆体系说明） |

---

## Project Structure / 项目结构

```
Prism/
├── dist/                    # 运行时代码
│   ├── index.js             # 入口，守护进程管理
│   ├── ask.js               # Prompt 组装 + KIMI 调度
│   ├── commands.js           # 命令路由和处理
│   ├── kimi.js              # KIMI CLI 封装
│   ├── security.js          # 用户白名单校验
│   ├── config.js            # 环境变量加载
│   ├── qq/
│   │   ├── adapter.js       # OneBot WebSocket 适配器
│   │   └── handler.js       # 消息路由
│   ├── state/
│   │   ├── memory.js        # L2/L3 长期记忆（token 计数 + 分级管理）
│   │   ├── conversation.js  # L1 短期对话历史
│   │   ├── daily-log.js     # 每日日志 + 自动摘要 + 周报压缩
│   │   ├── settings.js      # 设置持久化
│   │   ├── storage.js       # JSON 文件读写
│   │   └── bootstrap.js     # 启动加载 SOUL.md / USER.md
│   └── utils/
│       ├── chunk.js         # QQ 消息分段（4400字符限制）
│       ├── format.js        # Markdown → 纯文本
│       ├── shell.js         # 子进程管理
│       └── stt.js           # 语音转文字
├── data/
│   ├── SOUL.example.md      # AI 人格模板
│   └── USER.example.md      # 用户画像模板
├── install.bat              # 一键安装
├── setup.bat                # 重新配置 QQ 号
├── start.bat                # 日常启动
└── .env.example             # 配置模板
```

---

## FAQ / 常见问题

**QQ 消息出现乱码 `????????????`**
> 这是 OneBot 消息段格式兼容性问题，Prism 已改为直接发送纯文本消息。

**安装说明在哪？**
> 安装完成后自动打开 `安装说明.txt`，也保存在项目根目录。

**如何更换 QQ 号？**
> 双击 `setup.bat` 重新配置。

**记忆太多影响响应速度吗？**
> L2/L3 记忆会全部注入 prompt，可以通过 `/mem show` 检查 token 用量，用 `/mem del` 清理不需要的条目。

---

## License

MIT
