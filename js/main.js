import { t, LANGUAGES, getLocale, setLocale, applyStaticTranslations } from './i18n.js';
import { Camera } from './camera.js';
import { Renderer } from './render.js';
import { Presence } from './presence.js';
import { shoot, birdBox } from './capture.js';
import { P } from './progress.js';
import { DEVICES, fmt } from './device.js';
import { loadAllLevels, prepareLevel, birdInfo, loadBirdDb } from './level.js';
import { initInput, press, pressSwap, SWAP } from './input.js';
import { initDex, renderDex } from './dex.js';
import { showScreen, toast, hideToast, modal, modalOpen, modalKey } from './ui.js';
import * as RX from './audio-receiver.js';
import { initSetup, openSetup, leaveSetup, setupKey } from './audio-setup.js';
import { soundPrefs, setVolume, previewSound, unlockAudio, enterSoundscape, leaveSoundscape } from './soundscape.js';

const $ = (id) => document.getElementById(id);

const G = {
  levels: [],
  level: null,
  assets: null,
  camera: null,
  renderer: null,
  presence: null,
  style: P.style,
  busy: false,
  menuFocus: 0,
  mic: false,
  control: 'keyboard',
};

/* 操控方式三選一：mat＝地墊超聲波（開麥克風）、touch＝觸控螢幕、keyboard＝鍵盤。三種模式下鍵盤都可當備用。 */
const CONTROL_KEY = 'bird-view.control';
const MIC_KEY = 'bird-view.mic';            // v0.3 以前的「麥克風控制」開關，只用來遷移
const CONTROLS = ['mat', 'touch', 'keyboard'];
const CAPTION = {
  mat: t("🎤 地墊收音中・踩到的格子會亮起・雙腳同踩 1＋7 換裝置"),
  touch: t("點按九宮格操作・兩指同按 1＋7 換裝置"),
  keyboard: t("鍵盤 1–9・方向鍵・＋／－・空白鍵拍照・Esc 退出"),
};
/** 沒有選過時：手機／平板（粗指標）預設觸控，其餘預設鍵盤 */
const defaultControl = () => (matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard');
function loadControl() {
  try {
    const c = localStorage.getItem(CONTROL_KEY);
    if (CONTROLS.includes(c)) return c;
    if (localStorage.getItem(MIC_KEY) === '1') return 'mat';
  } catch {}
  return defaultControl();
}
const TEST_AUDIO = new URLSearchParams(location.search).has('audiotest');

let languageFocus = 0;
function initLanguageSettings() {
  $('languageChoices').innerHTML = LANGUAGES.map(l =>
    `<button type="button" class="chip language-choice" data-locale="${l.id}" lang="${l.id}" aria-pressed="${l.id === getLocale()}">${l.label}</button>`).join('');
  $('btnSettings').onclick = openSettings;
  $('btnSettingsBack').onclick = toMenu;
  for (const button of document.querySelectorAll('[data-locale]')) {
    button.onclick = () => { if (!setLocale(button.dataset.locale)) toMenu(); };
  }
}
function openSettings() {
  languageFocus = Math.max(0, LANGUAGES.findIndex(l => l.id === getLocale()));
  showScreen('settings');
  focusLanguage();
}
function focusLanguage() {
  document.querySelectorAll('[data-locale]').forEach((b, i) => b.classList.toggle('kfocus', i === languageFocus));
}
function settingsKey(key) {
  if (key === '3') { toMenu(); return; }
  const delta = { 2: -1, 4: -1, 6: 1, 8: 1 }[key];
  if (delta) { languageFocus = (languageFocus + delta + LANGUAGES.length) % LANGUAGES.length; focusLanguage(); }
  if (key === '9') document.querySelectorAll('[data-locale]')[languageFocus]?.click();
}

init();

async function init() {
  applyStaticTranslations();
  G.renderer = new Renderer();
  await loadBirdDb();
  G.levels = await loadAllLevels();

  initInput(onKey);
  initLanguageSettings();
  const playable = G.levels.filter((l) => l.assetStatus !== 'stub');
  initDex(() => toMenu(), [...new Set(playable.flatMap((l) => l.birds.map((b) => b.species)))]);

  $('btnDex').onclick = () => { showScreen('dex'); renderDex(); };
  $('btnReset').onclick = async () => {
    const ok = await modal(t("重設進度"), t("將清除圖鑑、風景照、遊玩日期與望遠鏡獎勵，確定嗎？"),
      [{ label: t("取消"), value: false, ghost: true }, { label: t("確定重設"), value: true }]);
    if (ok) { P.reset(); G.style = P.style; applyStyle(); renderMenu(); }
  };
  document.querySelector('.style-switch').addEventListener('click', (e) => {
    const c = e.target.closest('.chip[data-style]');
    if (!c) return;
    G.style = c.dataset.style;
    P.setStyle(G.style);
    applyStyle();
    renderMenu();
  });

  for (const c of document.querySelectorAll('.chip[data-ctl]')) c.onclick = () => setControl(c.dataset.ctl);
  for (const [id, kind] of [['volMusic', 'music'], ['volNature', 'nature']]) {
    $(id).oninput = (e) => { unlockAudio(); setVolume(kind, e.target.value); updateSoundUi(); };
    $(id).onchange = () => previewSound(kind);           // 放開滑桿時試聽
  }
  $('btnCal').onclick = () => toSetup();
  initSetup({ onBack: () => backFromSetup(), test: TEST_AUDIO });
  RX.on('input', onMicInput);
  RX.on('lost', onMicLost);
  document.addEventListener('visibilitychange', () => {
    // 校正在頁面轉背景時失效；回到前景後自動重新收音並校正
    if (!document.hidden && G.mic && $('screen-audio').hidden) recalibrate(t("回到遊戲，重新做背景校正"));
  });

  // Android 版（Capacitor）：返回鍵 = 3（退出／返回）
  const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (capApp) capApp.addListener('backButton', () => press('3'));

  G.control = loadControl();
  applyStyle();
  updateSoundUi();
  updateControlUi();
  renderMenu();
  showScreen('menu');

  // 上次選地墊：瀏覽器要求使用者手勢後才能開麥克風，等第一次點擊／按鍵再啟動
  // （第一下若正是點操控方式的 chip，交給 chip 自己處理）
  if (G.control === 'mat') {
    const go = (e) => {
      // Opening language settings must not request or restart microphone capture.
      if (!$('screen-settings').hidden || e.target?.closest?.('#btnSettings') ||
          (!$('screen-menu').hidden && ['Digit1', 'Numpad1'].includes(e.code))) return;
      removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true);
      if (e.target && e.target.closest && e.target.closest('.chip[data-ctl]')) return;
      if (G.control === 'mat' && !G.mic) setMic(true);
    };
    addEventListener('pointerdown', go, true);
    addEventListener('keydown', go, true);
  }
}

function updateSoundUi() {
  const p = soundPrefs();
  for (const [id, v] of [['volMusic', p.musicVol], ['volNature', p.natureVol]]) {
    $(id).value = v;
    $(`${id}Out`).textContent = v > 0 ? `${v}%` : t("關");
  }
}

/** 切換操控方式：地墊開麥克風並校正；觸控／鍵盤關閉收音，也不會要求麥克風權限 */
async function setControl(mode) {
  if (!CONTROLS.includes(mode)) return;
  G.control = mode;
  try { localStorage.setItem(CONTROL_KEY, mode); } catch {}
  updateControlUi();
  if (mode === 'mat') { if (!G.mic) await setMic(true); }
  else if (G.mic) await setMic(false);
  updateControlUi();
}

/* ================= 麥克風（地墊）控制 =================
 * 依 motionpad-audio-receiver：開啟收音 → 10 秒背景校正（保持未踩踏）→ 偵測器從 locked 開始；
 * 每一局（進入關卡）都重新做背景校正；各格的頻率與閾值倍率在「收音設定與校正」畫面設定並保存。
 * 地墊 5 號是休息區，不產生事件；觸控與鍵盤仍可使用。
 */

async function setMic(on) {
  G.mic = on;
  if (on) {
    try {
      await openMicInput();
      await recalibrate(t("開啟地墊控制"));
      // 還沒做逐格踩踏檢查：各格都是預設閾值（背景 × 4），容易被雜音誤觸
      if (G.mic && RX.getConfig().channels.every((c) => c.thresholdMode === 'global')) {
        const go = await modal(t("建議先做一鍵引導校正"),
          t("<p>目前各格使用預設閾值（背景 × 4），環境雜音可能造成誤觸。</p><p>「一鍵引導校正」會依序做背景校正、請你逐格踩 1 2 3 4 6 7 8 9，並自動套用各格閾值，約 1 分鐘。</p>"),
          [{ label: t("稍後再說"), value: false, ghost: true }, { label: t("開始一鍵引導校正"), value: true }]);
        if (go) toSetup({ guided: true });
      }
    } catch (e) {
      // 開不了麥克風：退回這台裝置的預設操控方式，避免卡在沒有輸入的狀態
      G.mic = false;
      G.control = defaultControl();
      try { localStorage.setItem(CONTROL_KEY, G.control); } catch {}
      await modal(t("無法開啟麥克風"), t("<p>{0}</p><p>請確認已允許麥克風權限，並接上麥克風。</p>", [e.message || e]) +
        t("<p>已暫時改用「{0}」操控。</p>", [G.control === 'touch' ? t("觸控螢幕") : t("鍵盤")]));
    }
  } else RX.stop();
  updateControlUi();
}

async function openMicInput() {
  await RX.init();
  if (RX.isLive()) return;
  if (TEST_AUDIO) await RX.playTestInput([{ url: 'audio-protocol/environment.wav', loop: true }]);
  else await RX.start();
}

/** 顯示「背景校正」覆蓋層並做 10 秒校正；失敗時可重試 */
async function recalibrate(title = t("背景校正")) {
  if (!G.mic || G.calibrating) return;
  G.calibrating = true;
  const ov = $('calOverlay');
  $('calOvTitle').textContent = title;
  ov.hidden = false;
  try {
    await openMicInput();
    $('calOvBar').style.width = '0%';
    $('calOvMsg').textContent = t("請回到 5 號休息區，不要踩踏地墊…");
    await RX.waitQuiet();
    await RX.calibrate((p) => {
      $('calOvBar').style.width = `${p * 100}%`;
      $('calOvMsg').textContent = t("請站在 5 號休息區，不要踩踏地墊… {0} 秒", [Math.ceil((1 - p) * 10)]);
    });
  } catch (e) {
    ov.hidden = true;
    G.calibrating = false;
    const again = await modal(t("背景校正失敗"), `<p>${e.message}</p>`,
      [{ label: t("關閉麥克風控制"), value: false, ghost: true }, { label: t("重新校正"), value: true }]);
    if (again) return recalibrate(title);
    return setMic(false);
  }
  ov.hidden = true;
  G.calibrating = false;
  updateControlUi();
}

function onMicInput(ev) {
  if (!G.mic || !$('screen-audio').hidden || G.calibrating) return;    // Setup 畫面自己顯示命中；非地墊模式不接收
  if (ev.conflict) {
    // 同時踩 1 與 7（中間隔著 4，不會是跨格誤踩）＝切換裝置的雙腳手勢
    const pos = [...ev.positions].sort((a, b) => a - b);
    if (pos.length === 2 && pos[0] === 1 && pos[1] === 7) { flashMic(); pressSwap(); return; }
    // 其他衝突是資料品質事件：不移動；提示最多每 3 秒一次
    const now = performance.now();
    if (!(now - (G.conflictToastAt || 0) < 3000)) {
      G.conflictToastAt = now;
      toast(t("同時踩到 {0} 號，請只踩一格", [ev.positions.join('、')]), 'bad', 1200);
    }
    return;
  }
  flashMic();
  press(String(ev.position));
}

function flashMic() {
  const ind = $('micInd');
  ind.classList.add('on');
  setTimeout(() => ind.classList.remove('on'), 250);
}

function onMicLost(e) {
  updateControlUi();
  if (!G.mic || !$('screen-audio').hidden || G.calibrating) return;
  if (document.hidden) return;                                // 回到前景時再校正
  recalibrate(t("收音中斷：{0}", [e.reason]));
}

function updateControlUi() {
  for (const c of document.querySelectorAll('.chip[data-ctl]')) c.classList.toggle('active', c.dataset.ctl === G.control);
  const stage = $('stage');
  for (const m of CONTROLS) stage.classList.toggle(`ctl-${m}`, m === G.control);
  $('keypadCap').textContent = CAPTION[G.control];
  $('micInd').hidden = !G.mic;
  const st = $('ctlStatus');
  st.classList.toggle('live', G.mic && RX.calibrationValid());
  st.textContent = G.control !== 'mat' ? '' : !G.mic ? t("（點一下畫面即開始收音）")
    : RX.calibrationValid() ? t("收音中・校正有效") : t("收音中・尚未校正");
}

function toSetup({ guided = false } = {}) {
  showScreen('audio');
  openSetup({ guided });
}

function backFromSetup() {
  toMenu();
  // 觸控／鍵盤模式下在設定畫面開過收音：回選單就停止，不讓地墊事件混進來
  if (!G.mic && RX.isLive()) RX.stop();
  if (G.mic && !RX.calibrationValid()) recalibrate(t("背景校正"));
  updateControlUi();
}

/* ================= 選單 ================= */

function applyStyle() {
  for (const c of document.querySelectorAll('.chip[data-style]'))
    c.classList.toggle('active', c.dataset.style === G.style);
}

function renderMenu() {
  const grid = $('levelGrid');
  grid.innerHTML = '';
  for (const [i, lv] of G.levels.entries()) {
    const unlocked = P.isUnlocked(lv, G.levels);
    const st = P.isCleared(lv);
    const found = P.speciesInLevel(lv.id).length;
    const stub = lv.assetStatus === 'stub';
    const b = document.createElement('button');
    b.className = 'level-card' + (st.cleared ? ' done' : '');
    b.disabled = !unlocked || stub;

    let mark;
    if (stub) mark = t("敬請期待");
    else if (!unlocked) mark = t("未解鎖");
    else if (st.cleared) mark = t("已通關 {0}/{1}", [found, lv.requiredSpecies]) + (st.byDays && !st.byCount ? t("（連續 3 天）") : '');
    else mark = t("{0}/{1} 種 · ", [found, lv.requiredSpecies]) + (lv.zoomMode === 'continuous' ? t("無段變焦") : t("有段變焦"));

    b.innerHTML = `<span class="n">LEVEL ${String(lv.id).padStart(2, '0')}</span>
      <span class="t">${lv.title}</span>
      <span class="s">${lv.subtitle || ''}</span>
      <span class="m">${mark}</span>`;
    b.onclick = () => startLevel(lv);
    b.classList.toggle('kfocus', i === G.menuFocus);
    grid.appendChild(b);
  }
  const dexCount = Object.keys(P.dexAll).length;
  $('menuFoot').textContent =
    t("圖鑑 {0} 種　·　風景照 {1} 張　·　", [dexCount, P.landscapes.length]) +
    (P.hasScope ? t("已擁有 10–20X 單筒望遠鏡（關卡中同時按 1＋7 切換）") : t("尚未取得單筒望遠鏡"));
}

function stopPresence() {
  if (G.presence) G.presence.destroy();
  G.presence = null;
  G.renderer.setStay(null);
}

function toMenu() {
  leaveSoundscape();
  stopPresence();
  G.level = null;
  hideToast();
  renderMenu();
  showScreen('menu');
}

/* ================= 關卡 ================= */

async function startLevel(lv) {
  // 必須在點擊／按鍵的使用者手勢中先解鎖 AudioContext；素材載入完成後再播放。
  unlockAudio();
  if (G.mic) await recalibrate(t("第 {0} 關開始前的背景校正", [lv.id]));
  stopPresence();
  G.busy = true;
  showScreen('game');
  toast(t("載入中…"), '', 0);

  const assets = await prepareLevel(lv, G.style);
  $('stage').classList.toggle('pencil-fallback', G.style === 'pencil' && assets.pencilFallback);

  G.level = lv;
  G.assets = assets;
  G.camera = new Camera({ aspect: assets.aspect, device: 'phone', zoomMode: lv.zoomMode });
  G.renderer.mount(lv, assets, G.camera);
  G.presence = new Presence(lv, G.camera, {
    onVisible: (b, v) => G.renderer.setBirdVisible(b, v),
    onLeave: (b) => toast(t("{0} 已離開視野<br><span style=\"font-weight:600;opacity:.85\">{1}　稍後會再回來</span>", [birdInfo(b.species).displayName, b.behavior || '']), 'bad', 1800),
    onFocus: (f) => G.renderer.setStay(f, f && birdInfo(f.bird.species)),
    isPaused: () => document.hidden || !$('modal').hidden || $('screen-game').hidden,
  });

  P.recordPlay(lv.id);
  updateKeypad();
  refresh();
  hideToast();
  G.busy = false;
  enterSoundscape(lv.id);

  const days = P.playDates(lv.id).length;
  toast(t("{0}<br><span style=\"font-weight:600;opacity:.8\">（本關已遊玩 {1} 天）</span>", [lv.intro, days]), '', 3200);
}

function refresh() {
  const found = P.speciesInLevel(G.level.id).length;
  G.renderer.draw();
  G.renderer.setHud({ level: G.level, camera: G.camera, found, required: G.level.requiredSpecies, canSwap: canSwap() });
}

const canSwap = () => !!(G.level && G.level.devices.includes('scope') && P.hasScope);

/** 5 號是休息格（地墊上沒有事件），按鍵也不給功能；切換裝置改為同時按 1＋7 */
function updateKeypad() {
  const k5 = document.querySelector('.key[data-k="5"]');
  k5.classList.add('off');
  k5.querySelector('small').textContent = t("休息");
}

/* ================= 按鍵 ================= */

async function onKey(k) {
  if (modalOpen()) { modalKey(k); return; }
  if (!$('screen-settings').hidden) { settingsKey(k); return; }
  if (G.busy) return;
  const onGame = !$('screen-game').hidden;
  const onDex = !$('screen-dex').hidden;

  if (onDex) { if (k === '3') toMenu(); return; }
  if (!$('screen-audio').hidden) { if (k === '3') { leaveSetup(); backFromSetup(); } else setupKey(k); return; }
  if (!$('screen-menu').hidden) { menuKey(k); return; }
  if (!onGame || !G.camera) return;

  switch (k) {
    case '2': G.camera.move(0, -1); refresh(); break;
    case '8': G.camera.move(0, 1); refresh(); break;
    case '4': G.camera.move(-1, 0); refresh(); break;
    case '6': G.camera.move(1, 0); refresh(); break;
    case '7': G.camera.setZoom(1); refresh(); break;
    case '1': G.camera.setZoom(-1); refresh(); break;
    case SWAP: switchDevice(); break;
    case '5': toast(canSwap() ? t("5 號是休息格<br><span style=\"font-weight:600;opacity:.85\">同時按 1＋7 切換裝置</span>") : t("5 號是休息格"), '', 1500); break;
    case '9': await capture(); break;
    case '3': await exitLevel(); break;
  }
}

/** 選單的九宮格操作：2/4/6/8 移動關卡焦點、9 進入、3 看圖鑑 */
function menuKey(k) {
  if (k === '1') { openSettings(); return; }
  const cards = [...document.querySelectorAll('.level-card')];
  if (!cards.length) return;
  const cols = getComputedStyle($('levelGrid')).gridTemplateColumns.split(' ').length || 5;
  const d = { 4: -1, 6: 1, 2: -cols, 8: cols }[k];
  if (d) {
    G.menuFocus = Math.max(0, Math.min(cards.length - 1, G.menuFocus + d));
    cards.forEach((c, i) => c.classList.toggle('kfocus', i === G.menuFocus));
    cards[G.menuFocus].scrollIntoView({ block: 'nearest' });
  } else if (k === '9') {
    const c = cards[G.menuFocus];
    if (c && !c.disabled) c.click();
  } else if (k === '3') {
    showScreen('dex');
    renderDex();
  }
}

function switchDevice() {
  if (!G.level.devices.includes('scope') || !P.hasScope) {
    toast(t("目前沒有可切換的裝置<br><span style=\"font-weight:600;opacity:.8\">在第 1 關記錄滿 5 種鳥即可獲得單筒望遠鏡</span>"), 'bad');
    return;
  }
  const next = G.camera.device === 'phone' ? 'scope' : 'phone';
  G.camera.setDevice(next);
  refresh();
  toast(t("切換為{0}（{1}–{2}X）", [DEVICES[next].name, fmt(DEVICES[next].min), fmt(DEVICES[next].max)]), 'good', 1200);
}

async function capture() {
  const res = shoot(G.camera, G.presence ? G.presence.visibleBirds() : G.level.birds);
  res.shot.scene = G.assets.sceneUrl;
  G.renderer.flash();

  if (res.type === 'multi') {
    const names = res.hits.map((h) => birdInfo(h.species).displayName).join('、');
    toast(t("一張照片只能有一種鳥<br><span style=\"font-weight:600;opacity:.85\">畫面中有 {0}，請再放大一點</span>", [names]), 'bad');
    return;
  }
  if (res.type === 'landscape') {
    P.addLandscape(res.shot, G.level.id, G.assets.sceneUrl, G.style);
    toast(t("沒有拍到鳥，已存入風景攝影區"), '', 1400);
    refresh();
    return;
  }

  res.shot.birdArt = G.assets.birdUrls[res.bird.species];
  res.shot.birdBox = birdBox(res.bird, G.camera.aspect);
  res.shot.birdCutout = res.bird.art === 'cutout';
  res.shot.birdFlip = !!res.bird.flip;
  const info = birdInfo(res.bird.species);
  const r = P.addBird(res.bird.species, res.shot, G.level.id, G.assets.sceneUrl, G.style);
  const q = res.shot.resolution === 'low' ? t("數位變焦 · 低解析") : t("光學變焦 · 高解析");
  const sub = (t) => `<br><span style="font-weight:600;opacity:.85">${t}</span>`;
  if (r.isNew) toast(t("📷 記錄成功：{0}{1}", [info.displayName, sub(t("{0}　已進入賞鳥圖鑑", [q]))]), 'good');
  else if (r.newInLevel) toast(t("📷 記錄成功：{0}（第 {1} 關 +1）{2}", [info.displayName, G.level.id, sub(r.upgraded ? t("圖鑑照片已更新為高解析") : q)]), 'good');
  else if (r.upgraded) toast(t("{0} 圖鑑照片已更新為高解析版本", [info.displayName]), 'good', 1500);
  else toast(t("本關已記錄過 {0}", [info.displayName]), '', 1300);

  refresh();
  await checkClear();
}

async function checkClear() {
  const lv = G.level;
  const found = P.speciesInLevel(lv.id).length;
  if (found < lv.requiredSpecies) return;

  let extra = '';
  if (lv.reward === 'scope' && !P.hasScope) {
    P.grantScope();
    extra = `<p style="color:var(--green);font-weight:800">${lv.rewardText}</p>`;
    updateKeypad();
    refresh();
  }
  const next = G.levels.find((l) => l.id === lv.id + 1);
  const canNext = !!next && next.assetStatus !== 'stub';
  const actions = [{ label: t("留在本關繼續拍"), value: 'stay', ghost: true }];
  actions.push(canNext ? { label: t("前往第 {0} 關", [next.id]), value: 'next' } : { label: t("回關卡選單"), value: 'menu' });

  const go = await modal(t("第 {0} 關完成！", [lv.id]),
    t("<p>你已記錄 {0} 種鳥類，達成過關條件（{1} 種）。</p>{2}", [found, lv.requiredSpecies, extra]), actions);
  if (go === 'next') startLevel(next);
  else if (go === 'menu') toMenu();
}

async function exitLevel() {
  const go = await modal(t("退出關卡"), t("要離開這一關嗎？已記錄的照片都會保留。"),
    [{ label: t("繼續遊戲"), value: 'stay', ghost: true },
     { label: t("看圖鑑"), value: 'dex', ghost: true },
     { label: t("回關卡選單"), value: 'menu' }]);
  if (go === 'menu') toMenu();
  else if (go === 'dex') { showScreen('dex'); renderDex(); }
}
