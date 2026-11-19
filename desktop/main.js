/**
 * 走，賞鳥趣 — Windows 桌面版（Electron）
 *
 * 遊戲檔放在 resources/web（開發時用 ../build/web，先跑 python tools/stage_web.py），
 * 以自訂的安全協定 app://bird-view/ 提供，ES Modules 與麥克風（getUserMedia）都能使用。
 * 權限只允許麥克風；收音不回播、不保存。F11 切換全螢幕。
 *
 * 自我測試：electron . --selftest  → 以 ?audiotest（參考音檔模擬收音）跑完背景校正、逐格檢查與偵測，輸出 JSON 後結束。
 *           electron . --selftest=game → 只用地墊聲音完成「選單 → 進關 → 放大／移動 → 退出」一輪。
 */
const { app, BrowserWindow, protocol, net, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// --selftest：收音校正與偵測；--selftest=game：只用地墊聲音玩一輪（需先跑過 --selftest）
const SELFTEST_ARG = process.argv.find((x) => x === '--selftest' || x.startsWith('--selftest='));
const SELFTEST = !!SELFTEST_ARG;
const SELFTEST_SCRIPT = SELFTEST_ARG === '--selftest=game' ? 'game-selftest.js'
  : SELFTEST_ARG === '--selftest=soundscape' ? 'soundscape-selftest.js' : 'audio-selftest.js';
const WEB_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.join(__dirname, '..', 'build', 'web');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function serve() {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(WEB_ROOT, rel));
    if (!file.startsWith(WEB_ROOT) || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function permissions() {
  const allow = (perm) => perm === 'media' || perm === 'audioCapture';
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
    // 只允許收音，不允許相機
    const types = (details && details.mediaTypes) || [];
    cb(allow(perm) && !types.includes('video'));
  });
  session.defaultSession.setPermissionCheckHandler((wc, perm) => allow(perm));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#0d1b16',
    title: '走，賞鳥趣',
    icon: path.join(WEB_ROOT, 'icon.png'),
    autoHideMenuBar: true,
    show: !SELFTEST || process.argv.includes('--show'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,      // 視窗被其他視窗蓋住時收音迴圈仍每 20 ms 執行
    },
  });
  // The localized document title also names the desktop window.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.loadURL(`app://bird-view/index.html${SELFTEST ? '?audiotest' : ''}`);
  if (SELFTEST) win.webContents.once('did-finish-load', () => runSelftest(win));
  else {
    // 驗證用：--shot=<檔案> 載入後擷取視窗畫面並結束（不影響一般啟動）
    const shot = process.argv.find((a) => a.startsWith('--shot='));
    if (shot) win.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 2500));
      fs.writeFileSync(shot.slice(7), (await win.webContents.capturePage()).toPNG());
      app.exit(0);
    });
  }
  return win;
}

async function runSelftest(win) {
  const script = fs.readFileSync(path.join(__dirname, 'selftest', SELFTEST_SCRIPT), 'utf8');
  let out;
  try {
    out = await win.webContents.executeJavaScript(script, true);
  } catch (e) {
    out = { ok: false, error: String(e && e.message || e) };
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  const shot = process.argv.find((a) => a.startsWith('--shot='));
  if (shot) {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(shot.slice(7), img.toPNG());
  }
  app.exit(out && out.ok ? 0 : 1);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serve();
  permissions();
  createWindow();
});

app.on('window-all-closed', () => app.quit());
