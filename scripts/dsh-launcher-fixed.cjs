// DeepSeek Harness 启动器（修复版）
// 启动 dsh web（--port 0 让 OS 挑空闲端口），从输出文件捕获带 token 的 URL，
// 用 CloakBrowser --app 打开独立窗口（无地址栏、无收藏栏、无认证错误）
// 拿不到 token 时绝不开浏览器（避免无 token 认证错误窗口）

const { spawn, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const WORK_DIR = 'D:\\DeepSeekHNS';
const CLOAK = 'D:\\Program Files (x86)\\CloakBrowser\\chrome.exe';
const APP_DATA = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\49046\\AppData\\Local', 'DeepSeek-Harness-App');
const OUT_LOG = path.join(process.env.TEMP || '.', 'dsh-web-out.log');
const ERR_LOG = path.join(process.env.TEMP || '.', 'dsh-web-err.log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. 杀掉残留的 dsh web 进程：使用 tasklist 和 findstr 替代 wmic
try {
  // 使用 tasklist 获取 node 进程，然后用 findstr 过滤包含 bin.ts + web 的进程
  const tasklistOutput = execSync('tasklist /FI "IMAGENAME eq node.exe" /V /FO CSV', { encoding: 'utf8', windowsHide: true });
  
  // 解析 CSV 输出，查找包含 bin.ts + web 的进程
  const lines = tasklistOutput.split(/\r?\n/);
  lines.forEach((line) => {
    if (line.includes('bin.ts') && line.includes('web')) {
      // CSV 格式： "node.exe","12345","Console","1","1024 K","Running","0:00:05","node --import tsx/esm apps/cli/src/bin.ts web"
      const match = line.match(/"node\.exe","(\d+)"/);
      if (match) {
        const pid = match[1];
        try {
          execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore', windowsHide: true });
        } catch {}
      }
    }
  });
} catch { /* 无残留进程 */ }

// 2. 清空旧日志
fs.writeFileSync(OUT_LOG, '');
fs.writeFileSync(ERR_LOG, '');

// 3. 启动 dsh web，--port 0 让 OS 挑空闲端口，输出重定向到文件
const outFd = fs.openSync(OUT_LOG, 'w');
const errFd = fs.openSync(ERR_LOG, 'w');
const child = spawn('node', ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web', '--port', '0', '--no-open'], {
  cwd: WORK_DIR,
  windowsHide: true,
  stdio: ['ignore', outFd, errFd],
});

// 4. 轮询输出文件，等 token URL（最长 30 秒）；绝不回退到无 token URL
async function main() {
  let url = null;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    let combined = '';
    try { combined += fs.readFileSync(OUT_LOG, 'utf8'); } catch {}
    try { combined += fs.readFileSync(ERR_LOG, 'utf8'); } catch {}
    const m = combined.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_\-]+/);
    if (m) { url = m[0]; break; }
  }

  if (!url) return; // 拿不到 token 不开浏览器

  // 5. 用 CloakBrowser App 模式打开（独立数据目录 → 独立窗口）
  const browser = spawn(CLOAK, [`--app=${url}`, `--user-data-dir=${APP_DATA}`], { windowsHide: true });
  browser.on('error', () => {
    spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [`--app=${url}`, `--user-data-dir=${APP_DATA}`], { windowsHide: true });
  });
}

main();