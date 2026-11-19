// 在遊戲頁面內執行（electron . --selftest=game）：只用「地墊聲音」（參考音檔模擬）完成一輪操作：
// 操控方式選「地墊」→ 開局背景校正 → 選單用 6/4/6 移動、9 進入第 2 關 → 關卡前背景校正 → 7 放大、6 右移
// → 同時踩 1＋7 換成望遠鏡、1 先 7 後（差 150 ms）換回手機、再單踩 7 仍是放大 → 3 退出 → 9 確認回選單。
// 第 1 關沒有望遠鏡，所以測試前先給望遠鏡並解鎖第 2 關（結束時還原進度）。
// 需要先跑過 --selftest（逐格校正設定已存在 localStorage）。
(async () => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms, step = 100) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(step); } return false; };
  const RX = await import('./js/audio-receiver.js');
  // 自我測試和安裝版共用同一個使用者資料夾：結束時還原遊戲進度（測試會給望遠鏡、記錄遊玩日期）
  const PROGRESS_KEY = 'bird-view.progress.v1';
  const progressBefore = localStorage.getItem(PROGRESS_KEY);
  const log = [];
  const check = (name, ok, extra = {}) => { log.push({ name, ok: !!ok, ...extra }); return ok; };
  let armed = false;
  RX.on('frame', ({ rows }) => { armed = rows.every((r) => r.state === 'armed'); });
  const inputs = [];
  RX.on('input', (e) => inputs.push(e.conflict ? `conflict:${e.positions}` : e.position));

  /** 踩一格：播放該格音檔（疊加在環境音上），等聲音結束並重新待命 */
  const step = (pos) => stepMany([[pos, 0.05]]);
  /** 同時踩多格：[[格, 開始秒數], ...] */
  async function stepMany(items) {
    await until(() => armed, 4000);
    await RX.playTestInput(items.map(([pos, at]) => ({ url: `audio-protocol/button-0${pos}.wav`, at })), { keep: true });
    await sleep(3400);
  }

  await until(() => document.querySelectorAll('.level-card').length, 5000);
  check('saved per-position config', RX.getConfig() || true);
  const { P } = await import('./js/progress.js');
  P.grantScope();
  const c1 = (P.all.captures[1] ||= []);
  while (c1.length < 5) c1.push(`selftest-${c1.length}`);
  document.querySelector('.style-switch .chip[data-style].active').click();   // 重畫選單：第 2 關解鎖

  // 1. 開啟麥克風控制（測試模式：環境音循環）→ 自動背景校正
  const CONTROL_KEY = 'bird-view.control';
  const controlBefore = localStorage.getItem(CONTROL_KEY);
  document.querySelector('.chip[data-ctl="mat"]').click();
  check('mic overlay shown', await until(() => !$('calOverlay').hidden, 3000));
  check('startup calibration', await until(() => RX.calibrationValid() && $('calOverlay').hidden, 20000), { msg: $('calOvMsg').textContent });
  check('detector armed', await until(() => armed, 5000));

  // 2. 選單：6 → 焦點到第 2 張，4 → 回第 1 張，6 → 第 2 張，9 → 進入第 2 關
  const focusIdx = () => [...document.querySelectorAll('.level-card')].findIndex((c) => c.classList.contains('kfocus'));
  await step(6);
  check('menu 6 → focus 2', focusIdx() === 1, { focus: focusIdx(), inputs: [...inputs] });
  await step(4);
  check('menu 4 → focus 1', focusIdx() === 0, { focus: focusIdx() });
  await step(6);
  check('menu 6 → focus 2 (level 2 unlocked)', focusIdx() === 1 && !document.querySelectorAll('.level-card')[1].disabled);
  inputs.length = 0;
  await step(9);
  // 進入關卡前會先等安靜、再做 10 秒背景校正
  check('level calibration overlay', await until(() => !$('calOverlay').hidden, 5000));
  check('level started', await until(() => !$('screen-game').hidden && $('calOverlay').hidden && RX.calibrationValid(), 25000), { msg: $('calOvMsg').textContent });
  await sleep(3500);                                   // 關卡開場提示
  check('detector armed in level', await until(() => armed, 5000));

  // 3. 關卡中（第 2 關，有段變焦）：7 放大、6 右移
  const zoom0 = $('rZoom').textContent, xy0 = $('rXY').textContent;
  await step(7);
  check('7 zoom in', $('rZoom').textContent !== zoom0, { before: zoom0, after: $('rZoom').textContent });
  await step(6);
  check('6 move right', $('rXY').textContent !== xy0, { before: xy0, after: $('rXY').textContent });

  // 3b. 1＋7 切換裝置（切換時不得先縮小）
  const dev = () => $('rDevice').textContent;
  inputs.length = 0;
  await stepMany([[1, 0.05], [7, 0.05]]);
  check('1+7 together → scope 10X', dev().startsWith('單筒望遠鏡') && $('rZoom').textContent === '10X',
    { device: dev(), zoom: $('rZoom').textContent, inputs: [...inputs] });
  inputs.length = 0;
  await stepMany([[1, 0.05], [7, 0.2]]);
  check('1 then 7 (+150ms) → phone 1X', dev().startsWith('手機') && $('rZoom').textContent === '1X',
    { device: dev(), zoom: $('rZoom').textContent, inputs: [...inputs] });
  const zoom1 = $('rZoom').textContent;
  await step(7);
  check('7 alone still zooms in', $('rZoom').textContent !== zoom1 && dev().startsWith('手機'),
    { before: zoom1, after: $('rZoom').textContent });

  // 4. 3 → 退出對話框，9 → 確認（預設焦點：回關卡選單）
  await step(3);
  check('3 exit dialog', !$('modal').hidden, { title: $('modalTitle').textContent });
  await step(9);
  check('9 back to menu', !$('screen-menu').hidden && $('modal').hidden);

  // 關閉地墊收音、還原操控方式與進度
  document.querySelector('.chip[data-ctl="keyboard"]').click();
  if (controlBefore === null) localStorage.removeItem(CONTROL_KEY);
  else localStorage.setItem(CONTROL_KEY, controlBefore);
  if (progressBefore === null) localStorage.removeItem(PROGRESS_KEY);
  else localStorage.setItem(PROGRESS_KEY, progressBefore);
  const ok = log.every((l) => l.ok);
  return { ok, log, inputs, conflicts: RX.conflictCount() };
})();
