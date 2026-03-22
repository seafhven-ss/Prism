import { spawn, execSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import readline from 'node:readline';
import net from 'node:net';
import { join } from 'node:path';

const CWD = process.cwd();
const RUNTIME_DIR = join(CWD, 'runtime');
const PYTHON_DIR = join(RUNTIME_DIR, 'python');
const NAPCAT_DIR = join(RUNTIME_DIR, 'napcat');
const BRIDGE_DIR = join(RUNTIME_DIR, 'installer-bridge');
const ENV_PATH = join(CWD, '.env');
const GUIDE_PATH = join(CWD, '\u5b89\u88c5\u8bf4\u660e.txt');
const CONFIG_ONLY = process.argv.includes('--configure-only');
const AUTO_CONFIRM = process.env.PRISM_INSTALL_AUTO_CONFIRM === '1';
const PRESET_BOT_QQ = (process.env.PRISM_INSTALL_BOT_QQ ?? '').trim();
const PRESET_MY_QQ = (process.env.PRISM_INSTALL_MY_QQ ?? '').trim();
const NAPCAT_LAUNCH_REQUEST = join(BRIDGE_DIR, 'launch-napcat.req');
const NAPCAT_LAUNCH_ACK = join(BRIDGE_DIR, 'launch-napcat.ack');
const PRISM_LAUNCH_REQUEST = join(BRIDGE_DIR, 'launch-prism.req');
const PRISM_LAUNCH_ACK = join(BRIDGE_DIR, 'launch-prism.ack');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function pause(message = '\u6309\u56de\u8f66\u7ee7\u7eed...') {
  if (AUTO_CONFIRM) {
    console.log(`${message} [自动继续]`);
    return;
  }
  await ask(`${message} `);
}

function panel(title, lines = []) {
  console.log('');
  console.log('============================================================');
  console.log(title);
  console.log('============================================================');
  for (const line of lines) {
    console.log(line);
  }
  console.log('');
}

function info(lines) {
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log('');
}

function commandExists(cmd) {
  try {
    execSync(`where ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      windowsHide: false,
    });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

function startDetached(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    shell: false,
  });
  child.unref();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeFileIfExists(filePath) {
  try {
    unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function isTcpPortOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const done = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitForTcpPort(host, port, timeoutMs, intervalMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isTcpPortOpen(host, port)) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

async function waitForFile(filePath, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(filePath)) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

function startVisibleBatch(batchPath, cwd) {
  const command = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/k','call',${psQuote(batchPath)} -WorkingDirectory ${psQuote(cwd)}`;
  startDetached('powershell.exe', ['-NoProfile', '-Command', command], CWD);
}

function requestNapCatLaunch() {
  mkdirSync(BRIDGE_DIR, { recursive: true });
  removeFileIfExists(NAPCAT_LAUNCH_ACK);
  writeFileSync(NAPCAT_LAUNCH_REQUEST, `${Date.now()}\n`, 'utf8');
}

async function requestPrismLaunch() {
  mkdirSync(BRIDGE_DIR, { recursive: true });
  removeFileIfExists(PRISM_LAUNCH_ACK);
  writeFileSync(PRISM_LAUNCH_REQUEST, `${Date.now()}\n`, 'utf8');
  return waitForFile(PRISM_LAUNCH_ACK, 10000, 500);
}

function openExternal(target) {
  startDetached('cmd', ['/c', 'start', '', target], CWD);
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : '';
}

function wireLines(stream, onLine) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      onLine(line);
    }
  });
  stream.on('end', () => {
    if (buffer.trim()) onLine(buffer);
  });
}

function addPythonToPath() {
  const scriptsDir = join(PYTHON_DIR, 'Scripts');
  const currentPath = process.env.PATH ?? '';
  if (!currentPath.includes(PYTHON_DIR)) {
    process.env.PATH = `${scriptsDir};${PYTHON_DIR};${currentPath}`;
  }
}

async function ensureBundledPython() {
  if (existsSync(join(PYTHON_DIR, 'python.exe'))) {
    addPythonToPath();
    return;
  }

  const bundledZip = join(CWD, 'vendor', 'python-embedded.zip');
  if (!existsSync(bundledZip)) {
    throw new Error('\u7f3a\u5c11 vendor/python-embedded.zip');
  }

  info(['\u6b63\u5728\u51c6\u5907\u5185\u7f6e Python \u8fd0\u884c\u73af\u5883...']);
  mkdirSync(PYTHON_DIR, { recursive: true });

  const unzipCode = await runCommand(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Path '${bundledZip}' -DestinationPath '${PYTHON_DIR}' -Force`],
  );
  if (unzipCode !== 0) {
    throw new Error('\u89e3\u538b Python \u5931\u8d25');
  }

  const pthFile = join(PYTHON_DIR, 'python313._pth');
  if (existsSync(pthFile)) {
    const patched = readFileSync(pthFile, 'utf8').replace(/^#\s*import site/m, 'import site');
    writeFileSync(pthFile, patched, 'utf8');
  }

  const getPipPath = join(CWD, 'vendor', 'get-pip.py');
  if (existsSync(getPipPath)) {
    info(['\u6b63\u5728\u5b89\u88c5 pip...']);
    const pipCode = await runCommand(join(PYTHON_DIR, 'python.exe'), [getPipPath, '--no-warn-script-location']);
    if (pipCode !== 0) {
      throw new Error('\u5b89\u88c5 pip \u5931\u8d25');
    }
  }

  addPythonToPath();
}

async function ensureKimiCli() {
  addPythonToPath();
  if (commandExists('kimi')) return;

  await ensureBundledPython();
  addPythonToPath();

  const pipExe = join(PYTHON_DIR, 'Scripts', 'pip.exe');
  const pipBin = existsSync(pipExe) ? pipExe : 'pip';
  info(['\u6b63\u5728\u5b89\u88c5 KIMI Code CLI...']);
  const code = await runCommand(pipBin, ['install', 'kimi-cli', '-q', '--no-warn-script-location']);
  if (code !== 0 || !commandExists('kimi')) {
    throw new Error('\u5b89\u88c5 KIMI Code CLI \u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5');
  }
}

async function ensureNapCat() {
  if (existsSync(join(NAPCAT_DIR, 'NapCatWinBootMain.exe'))) return;

  const bundledZip = join(CWD, 'vendor', 'NapCat.Shell.zip');
  if (!existsSync(bundledZip)) {
    throw new Error('\u7f3a\u5c11 vendor/NapCat.Shell.zip');
  }

  info(['\u6b63\u5728\u89e3\u538b NapCat...']);
  mkdirSync(NAPCAT_DIR, { recursive: true });

  const code = await runCommand(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Path '${bundledZip}' -DestinationPath '${NAPCAT_DIR}' -Force`],
  );
  if (code !== 0) {
    throw new Error('\u89e3\u538b NapCat \u5931\u8d25');
  }

  const configDir = join(NAPCAT_DIR, 'config');
  mkdirSync(configDir, { recursive: true });
  const onebotConfigPath = join(configDir, 'onebot11.json');
  if (!existsSync(onebotConfigPath)) {
    const onebotConfig = {
      network: {
        websocketServers: [
          {
            name: 'prism-ws',
            enable: true,
            host: '127.0.0.1',
            port: 3001,
            token: '',
            heartInterval: 30000,
            debug: false,
          },
        ],
        websocketClients: [],
        httpServers: [],
        httpClients: [],
      },
      musicSignUrl: '',
      enableLocalFile2Url: false,
      parseMultMsg: false,
    };
    writeFileSync(onebotConfigPath, JSON.stringify(onebotConfig, null, 2), 'utf8');
  }
}

function getQQPath() {
  const localAppData = process.env.LOCALAPPDATA ?? '';
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';

  const candidates = [
    join(programFiles, 'Tencent', 'QQNT', 'QQ.exe'),
    join(programFilesX86, 'Tencent', 'QQNT', 'QQ.exe'),
    join(localAppData, 'Programs', 'Tencent', 'QQNT', 'QQ.exe'),
    join(localAppData, 'Tencent', 'QQNT', 'QQ.exe'),
    'C:\\Tencent\\QQNT\\QQ.exe',
    'D:\\Tencent\\QQNT\\QQ.exe',
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function writeNapCatLauncher(qqExePath) {
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    'title NapCat',
    'set "NAPCAT_DIR=%~dp0"',
    `set "QQPath=${qqExePath}"`,
    'set NAPCAT_PATCH_PACKAGE=%NAPCAT_DIR%qqnt.json',
    'set NAPCAT_LOAD_PATH=%NAPCAT_DIR%loadNapCat.js',
    'set NAPCAT_INJECT_PATH=%NAPCAT_DIR%NapCatWinBootHook.dll',
    'set NAPCAT_LAUNCHER_PATH=%NAPCAT_DIR%NapCatWinBootMain.exe',
    'set NAPCAT_MAIN_PATH=%NAPCAT_DIR%napcat.mjs',
    'if not exist "%QQPath%" (',
    '  echo QQ.exe not found: %QQPath%',
    '  pause',
    '  exit /b 1',
    ')',
    'if not exist "%NAPCAT_LAUNCHER_PATH%" (',
    '  echo NapCatWinBootMain.exe not found: %NAPCAT_LAUNCHER_PATH%',
    '  pause',
    '  exit /b 1',
    ')',
    'set NAPCAT_MAIN_PATH=%NAPCAT_MAIN_PATH:\\=/%',
    'echo (async () =^> {await import("file:///%NAPCAT_MAIN_PATH%")})() > "%NAPCAT_LOAD_PATH%"',
    '"%NAPCAT_LAUNCHER_PATH%" "%QQPath%" "%NAPCAT_INJECT_PATH%" %*',
    'pause',
  ];
  writeFileSync(join(NAPCAT_DIR, 'prism-napcat.bat'), lines.join('\r\n'), 'utf8');
}

async function ensureQQPath() {
  let qqPath = getQQPath();
  if (qqPath) return qqPath;

  panel('需要先安装 QQ', [
    '  未检测到 QQNT，请先安装 QQ 桌面版。',
    '  推荐地址：https://im.qq.com',
    '  安装完成后，也可以手动输入 QQ.exe 的完整路径。',
  ]);

  while (!qqPath) {
    const manualPath = await ask('QQ.exe 完整路径（留空则重新检测）: ');
    if (manualPath && existsSync(manualPath)) {
      qqPath = manualPath;
      break;
    }
    qqPath = getQQPath();
    if (!qqPath) {
      info(['仍未检测到 QQ，请安装完成后再继续。']);
    }
  }

  return qqPath;
}

async function loginKimi() {
  panel('人工操作 1/2：登录 KIMI Code', [
    '  现在将自动发起 KIMI 授权。',
    '  浏览器会自动打开登录页；登录完成后这里会自动继续。',
  ]);
  console.log('  正在打开 KIMI 登录页...');
  console.log('');

  const result = await new Promise((resolve) => {
    let lastMessage = '';
    let sawSuccess = false;
    let openedUrl = false;
    let announcedWait = false;

    const child = spawn('kimi', ['login', '--json'], {
      cwd: CWD,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: false,
    });

    const handleLine = (line) => {
      const text = line.trim();
      if (!text) return;

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        lastMessage = text;
        console.log(`  ${text}`);
        return;
      }

      const message = typeof payload.message === 'string' ? payload.message : '';
      const eventType = typeof payload.type === 'string' ? payload.type : '';
      const eventUrl =
        (payload.data && typeof payload.data.verification_url === 'string' && payload.data.verification_url) ||
        extractUrl(message);

      if (message) {
        lastMessage = message;
      }

      if (eventType === 'verification_url') {
        if (eventUrl && !openedUrl) {
          openExternal(eventUrl);
          openedUrl = true;
        }
        console.log('  浏览器授权页已打开。');
        if (eventUrl) {
          console.log(`  如未自动跳转，请手动打开：${eventUrl}`);
        }
        console.log('  请在页面中完成登录与授权，安装器会自动等待。');
        console.log('');
        return;
      }

      if (eventType === 'waiting') {
        if (!announcedWait) {
          console.log('  正在等待你在浏览器中完成授权...');
          console.log('');
          announcedWait = true;
        }
        return;
      }

      if (eventType === 'success') {
        sawSuccess = true;
        console.log('  KIMI 登录完成。');
        console.log('');
        return;
      }

      if (eventType === 'error') {
        if (message) {
          console.log(`  ${message}`);
        }
        return;
      }

      if (message) {
        console.log(`  ${message}`);
      }
    };

    wireLines(child.stdout, handleLine);
    wireLines(child.stderr, handleLine);

    child.on('error', (error) => {
      resolve({
        ok: false,
        message: error.message || 'KIMI 登录程序启动失败',
      });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0 && sawSuccess,
        message: lastMessage || 'KIMI 登录未完成',
      });
    });
  });

  if (!result.ok) {
    throw new Error(result.message);
  }
}

async function launchNapCat(qqPath) {
  writeNapCatLauncher(qqPath);
  const launcherPath = join(NAPCAT_DIR, 'prism-napcat.bat');
  panel('人工操作 2/2：登录 QQ 机器人', [
    '  接下来会启动 NapCat。',
    '  请用“机器人 QQ 号”扫码登录。',
    '  安装器会自动等待登录成功，不需要再手工确认。',
  ]);
  requestNapCatLaunch();
  const launchedByBridge = await waitForFile(NAPCAT_LAUNCH_ACK, 15000, 500);
  if (!launchedByBridge) {
    startVisibleBatch(launcherPath, NAPCAT_DIR);
  }

  console.log('  NapCat 窗口已启动。');
  console.log('  请在弹出的 QQ / NapCat 窗口中扫码登录。');
  console.log('  登录成功后，安装器会自动进入下一步。');
  console.log('');

  const ready = await waitForTcpPort('127.0.0.1', 3001, 300000, 2000);
  if (!ready) {
    throw new Error('NapCat 超时未就绪，请确认已扫码登录且窗口仍然打开');
  }

  console.log('  NapCat 登录完成。');
  console.log('');
}

async function collectIds() {
  if (PRESET_BOT_QQ && PRESET_MY_QQ) {
    panel('最后一步：填写两个 QQ 号', [
      '  已使用预设测试参数自动填充 QQ 号。',
    ]);
    console.log(`  机器人 QQ: ${PRESET_BOT_QQ}`);
    console.log(`  你的 QQ: ${PRESET_MY_QQ}`);
    console.log('');
    return { botQQ: PRESET_BOT_QQ, myQQ: PRESET_MY_QQ };
  }

  panel('最后一步：填写两个 QQ 号', [
    '  1. 机器人 QQ：刚才登录到 NapCat 的那个 QQ 号',
    '  2. 你的 QQ：你自己用来给机器人发消息的 QQ 号',
  ]);

  const botQQ = await ask('机器人 QQ: ');
  if (!botQQ) throw new Error('机器人 QQ 不能为空');

  const myQQ = await ask('你的 QQ: ');
  if (!myQQ) throw new Error('你的 QQ 不能为空');

  return { botQQ, myQQ };
}

function writeEnv(botQQ, myQQ) {
  const lines = [
    '# Prism config',
    `BOT_QQ_ID=${botQQ}`,
    `ALLOWED_USER_ID=${myQQ}`,
    'ONEBOT_WS_URL=ws://127.0.0.1:3001',
    'ONEBOT_TOKEN=',
    'KIMICODE_BIN=kimi',
    'KIMICODE_TIMEOUT_MS=600000',
  ];
  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
}

function ensureBootstrapFiles() {
  const dataDir = join(CWD, 'data');
  const soulSrc = join(dataDir, 'SOUL.example.md');
  const soulDst = join(dataDir, 'SOUL.md');
  const userSrc = join(dataDir, 'USER.example.md');
  const userDst = join(dataDir, 'USER.md');

  if (!existsSync(soulDst) && existsSync(soulSrc)) copyFileSync(soulSrc, soulDst);
  if (!existsSync(userDst) && existsSync(userSrc)) copyFileSync(userSrc, userDst);
}

function writeGuide(botQQ, myQQ, qqPath) {
  const lines = [
    'Prism 安装说明',
    '==============================',
    '',
    '这是一个面向中文用户的 QQ + KIMI Code 远程终端控制方案。',
    '你现在已经完成安装，后续只需要记住下面几件事。',
    '',
    '一、怎么启动',
    '1. 双击 start.bat',
    '2. 确保 NapCat 已登录且窗口不要关闭',
    '3. 在你自己的 QQ 上给机器人 QQ 发消息',
    '',
    '二、当前配置',
    `- 机器人 QQ：${botQQ}`,
    `- 你的 QQ：${myQQ}`,
    `- QQ 路径：${qqPath}`,
    '- QQ 通道：OneBot WebSocket ws://127.0.0.1:3001',
    '- 智能引擎：KIMI Code CLI',
    '',
    '三、常用文件',
    '- install.bat：首次安装或全量修复',
    '- setup.bat：重新填写 QQ 号',
    '- start.bat：启动 Prism',
    '- napcat-start.bat：单独启动 NapCat',
    '- .env：当前配置文件',
    '',
    '四、日常使用建议',
    '- 机器人 QQ 和你的 QQ 最好分开使用',
    '- 如果消息没反应，先检查 NapCat 是否还在线',
    '- 如果 KIMI 失效，重新执行 kimi login',
    '',
  ];
  writeFileSync(GUIDE_PATH, lines.join('\r\n'), 'utf8');
}

function openGuide() {
  startDetached('notepad.exe', [GUIDE_PATH]);
}

function writeGuideClean(botQQ, myQQ, qqPath) {
  const lines = [
    'Prism 安装说明',
    '==============================',
    '',
    '这是一个面向中文用户的 QQ + KIMI Code 远程终端控制方案。',
    '你现在已经完成安装，后续只需要记住下面几件事。',
    '',
    '一、怎么启动',
    '1. 双击 start.bat',
    '2. 确保 NapCat 已登录且窗口不要关闭',
    '3. 在你自己的 QQ 上给机器人 QQ 发消息',
    '',
    '二、当前配置',
    `- 机器人 QQ：${botQQ}`,
    `- 你的 QQ：${myQQ}`,
    `- QQ 路径：${qqPath}`,
    '- QQ 通道：OneBot WebSocket ws://127.0.0.1:3001',
    '- 智能引擎：KIMI Code CLI',
    '',
    '三、常用文件',
    '- install.bat：首次安装或全量修复',
    '- setup.bat：重新填写 QQ 号',
    '- start.bat：启动 Prism',
    '- napcat-start.bat：单独启动 NapCat',
    '- .env：当前配置文件',
    '',
    '四、日常使用建议',
    '- 机器人 QQ 和你的 QQ 最好分开使用',
    '- 如果消息没反应，先检查 NapCat 是否还在线',
    '- 如果 KIMI 失效，重新执行 kimi login',
    '',
  ];
  writeFileSync(GUIDE_PATH, lines.join('\r\n'), 'utf8');
}

async function runInstall() {
  panel('Prism 一键安装', [
    '  纯中文 · QQ 通道 · KIMI Code · 面向国内用户',
    '',
    '  安装过程已压缩到最少操作：',
    '  1. 自动准备运行环境',
    '  2. 登录 KIMI',
    '  3. 登录 NapCat',
    '  4. 填两个 QQ 号',
  ]);

  await pause('按回车开始安装...');

  panel('自动准备中', [
    '  正在检查并准备 KIMI Code、NapCat 和基础运行环境。',
  ]);
  await ensureKimiCli();
  await ensureNapCat();

  await loginKimi();
  const qqPath = await ensureQQPath();
  await launchNapCat(qqPath);

  const { botQQ, myQQ } = await collectIds();
  writeEnv(botQQ, myQQ);
  ensureBootstrapFiles();
  writeGuideClean(botQQ, myQQ, qqPath);
  openGuide();
  await requestPrismLaunch();

  panel('安装完成', [
    '  Prism 已完成安装。',
    '  已自动生成并打开：安装说明.txt',
    '',
    '  下次使用只需要：',
    '  - 双击 start.bat',
    '  - 保持 NapCat 在线',
    '  - 在 QQ 里给机器人发消息',
  ]);
}

async function runConfigureOnly() {
  panel('Prism 重新配置', [
    '  这个模式只做两件事：',
    '  1. 重新填写两个 QQ 号',
    '  2. 重新生成并打开 安装说明.txt',
  ]);

  const qqPath = await ensureQQPath();
  const { botQQ, myQQ } = await collectIds();
  writeEnv(botQQ, myQQ);
  ensureBootstrapFiles();
  writeGuideClean(botQQ, myQQ, qqPath);
  openGuide();

  panel('重新配置完成', [
    '  新配置已经保存。',
    '  已自动打开：安装说明.txt',
  ]);
}

async function main() {
  try {
    if (CONFIG_ONLY) {
      await runConfigureOnly();
    } else {
      await runInstall();
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('');
  console.error(`安装失败：${error instanceof Error ? error.message : String(error)}`);
  rl.close();
  process.exit(1);
});
