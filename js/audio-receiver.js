import { t } from './i18n.js';
/**
 * 超聲波接收器：麥克風、AnalyserNode、20 ms 幀迴圈、狀態機驅動、事件輸出與設定保存。
 * 規則見 js/audio-core.js 開頭；收音不回播（MediaStreamSource 只接 AnalyserNode）、不保存原始錄音。
 *
 * 事件（on(type, cb)）：
 *   frame   10 Hz 監測資料（每頻道 power/db/background/threshold/ratio/peakHz/state）
 *   input   { id, cell, position, timestamp, source:'microphone', conflict }
 *   status  { status: 'idle'|'live'|'calibrating'|'ready'|'error', message }
 *   lost    校正失效（頁面轉背景、取樣中斷、裝置中斷）
 */
import {
  defaultConfig, validate, signature, bandPower, toDb, peakNear, Calibration, thresholds, Detector,
  balanceThresholds, monitorCsv, POSITIONS, CALIBRATION_MS, MAX_GAP_MS, SCHEMA_VERSION,
} from './audio-core.js';

const STORE_KEY = 'birdview-audio-v2';
const LOOP_MS = 20;
const MONITOR_MS = 100;
const RECORD_MAX_MS = 300000;

const R = {
  proto: null, config: null, calibration: null, history: [],
  ctx: null, analyser: null, buf: null, stream: null, source: null, testNodes: [],
  timer: null, lastT: null, status: 'idle', message: '',
  cal: null, calResolve: null, detector: null, thr: {}, conflicts: 0,
  tap: null, endMeasure: null, lastMonitor: 0, recording: null, serial: 0,
  listeners: {},
};

/* ================= 事件 ================= */

export function on(type, cb) { (R.listeners[type] ||= new Set()).add(cb); return () => R.listeners[type].delete(cb); }
function emit(type, data) { for (const cb of R.listeners[type] || []) cb(data); }
function setStatus(status, message = '') { R.status = status; R.message = message; emit('status', { status, message }); }

/* ================= 設定與保存 ================= */

export async function loadProtocol() {
  if (!R.proto) R.proto = await fetch('audio-protocol/protocol.json', { cache: 'no-cache' }).then((r) => r.json());
  return R.proto;
}

/**
 * v0.4.6 以前的預設把 7、9 號頻率輸入反了（7＝22990、9＝21500；地墊實際是 7＝21500、9＝22990）。
 * 保存的設定若仍是這組錯誤值，改成正確頻率，並把這兩格閾值改回全域倍率（原閾值是在錯的頻率上量的）。
 * 已在現場量到正確頻率的設定不符合條件，維持原樣。回傳是否有更正。
 */
function fixSwapped79(config) {
  const near = (c, hz) => c && c.frequency != null && Math.abs(c.frequency - hz) <= config.bandwidth;
  const c7 = config.channels.find((c) => c.position === 7), c9 = config.channels.find((c) => c.position === 9);
  if (!near(c7, 22990) || !near(c9, 21500)) return false;
  c7.frequency = 21500; c9.frequency = 22990;
  for (const c of [c7, c9]) { c.thresholdMode = 'global'; c.multiplier = config.multiplier; c.manual = null; }
  return true;
}

/** 載入保存的設定（只做一次）。校正不從保存值還原：只在本次收音有效，每局都要重新校正 */
export async function init() {
  await loadProtocol();
  if (R.config) return R.config;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch {}
  R.config = saved && saved.config && validate(saved.config).length === 0 ? saved.config : defaultConfig(R.proto.keys);
  R.history = saved && Array.isArray(saved.history) ? saved.history.slice(-10) : [];
  R.calibration = null;
  if (fixSwapped79(R.config)) persist();
  return R.config;
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ config: R.config, calibration: R.calibration, history: R.history }));
    return true;
  } catch { return false; }
}

export const getConfig = () => R.config;
export const getCalibration = () => R.calibration;
export const getStatus = () => ({ status: R.status, message: R.message });
export const sampleRate = () => (R.ctx ? R.ctx.sampleRate : 48000);
export const isLive = () => !!R.timer;
export const calibrationValid = () => !!(R.calibration && R.calibration.signature === signature(R.config) && R.timer);

/**
 * 更新設定。只改倍率／閾值／偵測參數：保留背景平均、重置偵測器；
 * 改到簽章（裝置、FFT、頻寬、頻率）：校正失效。回傳錯誤訊息陣列。
 */
export function updateConfig(mut) {
  const next = JSON.parse(JSON.stringify(R.config));
  mut(next);
  const errs = validate(next, sampleRate());
  if (errs.length) return errs;
  const sigChanged = signature(next) !== signature(R.config);
  R.config = next;
  if (R.analyser) {
    R.analyser.fftSize = next.fftSize;
    R.analyser.smoothingTimeConstant = next.smoothing;
    R.buf = new Float32Array(R.analyser.frequencyBinCount);
  }
  if (sigChanged && R.calibration) { R.history.push(R.calibration); R.calibration = null; emit('lost', { reason: t("接收設定已變更，請重新校正") }); }
  rebuildDetector();
  persist();
  return [];
}

export function resetConfig() {
  R.config = defaultConfig(R.proto.keys);
  R.calibration = null;
  rebuildDetector();
  persist();
}

/** 設定匯出：{schemaVersion: 2, config, calibration, calibrationCurrent, events} */
export function exportSettings() {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION, config: R.config, calibration: R.history,
    calibrationCurrent: R.calibration, events: { conflicts: R.conflicts },
  }, null, 2);
}

/** 設定匯入：拒絕 schemaVersion ≠ 2 與 > 1 MiB；匯入後必須重新校正（匯入的校正只存為歷史） */
export function importSettings(text) {
  if (text.length > 1024 * 1024) return [t("檔案超過 1 MiB")];
  let obj;
  try { obj = JSON.parse(text); } catch { return [t("不是有效的 JSON")]; }
  if (!obj || obj.schemaVersion !== SCHEMA_VERSION) return [t("schemaVersion 不是 2")];
  const errs = validate(obj.config, sampleRate());
  if (errs.length) return errs;
  if (obj.calibrationCurrent) R.history.push(obj.calibrationCurrent);
  fixSwapped79(obj.config);
  R.config = obj.config;
  R.calibration = null;
  rebuildDetector();
  persist();
  emit('lost', { reason: t("已匯入設定，請重新校正") });
  return [];
}

/* ================= 收音 ================= */

export async function listDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'audioinput');
  } catch { return []; }
}

async function ensureContext() {
  await loadProtocol();
  if (!R.config) await init();
  if (!R.ctx) {
    R.ctx = new AudioContext({ sampleRate: 48000 });
    R.analyser = R.ctx.createAnalyser();
    R.analyser.minDecibels = -160;
    R.analyser.maxDecibels = 0;
  }
  R.analyser.fftSize = R.config.fftSize;
  R.analyser.smoothingTimeConstant = R.config.smoothing;
  R.buf = new Float32Array(R.analyser.frequencyBinCount);
  if (R.ctx.state === 'suspended') { try { await R.ctx.resume(); } catch {} }
}

/** 開啟收音（需在使用者手勢後）；回傳實際取樣率資訊 */
export async function start({ deviceId } = {}) {
  await ensureContext();
  stopInputs();
  if (deviceId !== undefined && deviceId !== R.config.deviceId) updateConfig((c) => { c.deviceId = deviceId; });
  const audio = {
    channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 },
    autoGainControl: false, noiseSuppression: false, echoCancellation: false,
  };
  if (R.config.deviceId) audio.deviceId = { exact: R.config.deviceId };
  try {
    R.stream = await navigator.mediaDevices.getUserMedia({ audio });
  } catch (e) {
    setStatus('error', t("無法開啟麥克風：{0}", [e.message || e.name]));
    throw e;
  }
  R.source = R.ctx.createMediaStreamSource(R.stream);
  R.source.connect(R.analyser);                 // 只接分析器，永不接 destination
  const track = R.stream.getAudioTracks()[0];
  if (track) {
    track.onended = () => fault(t("麥克風已中斷"));
    track.onmute = () => fault(t("麥克風被靜音或被其他程式佔用"));
  }
  startLoop();
  const st = track && track.getSettings ? track.getSettings() : {};
  return { sampleRate: R.ctx.sampleRate, trackRate: st.sampleRate, label: track ? track.label : '' };
}

/** 停止收音（不保存任何音訊） */
export function stop() {
  stopLoop();
  stopInputs();
  invalidate(t("收音已停止"), false);
  setStatus('idle');
}

function stopInputs() {
  if (R.source) { try { R.source.disconnect(); } catch {} R.source = null; }
  if (R.stream) { for (const t of R.stream.getTracks()) { t.onended = t.onmute = null; t.stop(); } R.stream = null; }
  for (const n of R.testNodes) { try { n.stop && n.stop(); } catch {} try { n.disconnect(); } catch {} }
  R.testNodes = [];
}

function fault(msg) {
  stopLoop();
  stopInputs();
  invalidate(msg, true);
  setStatus('error', msg);
}

function invalidate(reason, notify = true) {
  if (R.cal) { R.cal.error = reason; finishCalibration(); }
  if (R.calibration) { R.history.push(R.calibration); R.calibration = null; persist(); }
  if (R.detector) R.detector = null;
  if (notify) emit('lost', { reason });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && R.timer) invalidate(t("頁面轉到背景，校正已失效"));
});

/**
 * 測試用：以音檔取代麥克風（可疊加）。items: [{ url, gainDb, at(秒), loop }]；keep=true 疊加在目前輸入上。
 * 音檔只接分析器，不會播出聲音。
 */
export async function playTestInput(items, { keep = false } = {}) {
  await ensureContext();
  if (!keep) stopInputs();
  const decoded = await Promise.all(items.map((it) => fetch(it.url).then((r) => r.arrayBuffer()).then((a) => R.ctx.decodeAudioData(a))));
  const t0 = R.ctx.currentTime + 0.05;
  let end = 0;
  items.forEach((it, i) => {
    const s = R.ctx.createBufferSource();
    s.buffer = decoded[i];
    s.loop = !!it.loop;
    const g = R.ctx.createGain();
    g.gain.value = Math.pow(10, (it.gainDb || 0) / 20);
    s.connect(g).connect(R.analyser);
    s.start(t0 + (it.at || 0));
    R.testNodes.push(s, g);
    if (!it.loop) end = Math.max(end, (it.at || 0) + decoded[i].duration);
  });
  if (!R.timer) startLoop();
  return end;
}

/* ================= 幀迴圈 ================= */

function startLoop() {
  stopLoop();
  R.lastT = null;
  R.timer = setInterval(loop, LOOP_MS);
  if (R.status === 'idle' || R.status === 'error') setStatus('live');
}
function stopLoop() { clearInterval(R.timer); R.timer = null; }

function powersOf(frame) {
  const sr = R.ctx.sampleRate, out = {};
  for (const c of R.config.channels) if (c.frequency != null) out[c.id] = bandPower(frame, c.frequency, R.config.bandwidth, R.config.fftSize, sr);
  return out;
}

function loop() {
  const t = performance.now();
  if (R.lastT != null && t - R.lastT > MAX_GAP_MS && (R.cal || R.calibration)) invalidate(t("取樣中斷超過 {0}ms，請重新校正", [MAX_GAP_MS]));
  R.lastT = t;
  R.analyser.getFloatFrequencyData(R.buf);
  const frame = R.buf;
  const powers = powersOf(frame);

  if (R.cal && R.cal.add(t, powers)) finishCalibration();
  if (R.tap) R.tap(t, frame, powers);

  if (R.detector && !R.tap) {          // 逐格檢查量測時暫停偵測（閾值尚未調整，避免誤報衝突）
    for (const ev of R.detector.step(t, powers)) {
      if (ev.type === 'trigger') emit('input', { id: `audio-${++R.serial}`, cell: ev.cell, position: ev.position, timestamp: t, source: 'microphone', conflict: false });
      else if (ev.type === 'conflict') { R.conflicts++; emit('input', { id: `audio-${++R.serial}`, cell: null, positions: ev.positions, timestamp: t, source: 'microphone', conflict: true }); }
    }
  }

  if (t - R.lastMonitor >= MONITOR_MS) {
    R.lastMonitor = t;
    const sr = R.ctx.sampleRate, st = R.detector ? R.detector.states() : {};
    const rows = R.config.channels.filter((c) => c.frequency != null).map((c) => {
      const B = R.calibration ? R.calibration.means[c.id] : null;
      const T = R.thr[c.id];
      return {
        timeMs: Math.round(t), kind: 'channel', id: c.id, position: c.position, frequencyHz: c.frequency,
        power: powers[c.id], db: toDb(powers[c.id]), background: B, threshold: T,
        ratio: T > 0 ? powers[c.id] / T : null,
        peakHz: Math.round(peakNear(frame, c.frequency, 240, R.config.fftSize, sr).hz),
        state: st[c.id] || (R.cal ? 'calibrating' : 'uncalibrated'),
      };
    });
    if (R.recording) {
      R.recording.rows.push(...rows);
      if (t - R.recording.t0 >= RECORD_MAX_MS) stopRecording();
    }
    emit('frame', { rows, recording: !!R.recording, conflicts: R.conflicts });
  }
}

/* ================= 背景校正 ================= */

/** 10 秒背景校正（保持地墊未踩踏）。onProgress(0..1)。成功後偵測器從 locked 開始。 */
export function calibrate(onProgress) {
  if (!R.timer) return Promise.reject(new Error(t("請先開啟收音")));
  const errs = validate(R.config, sampleRate());
  if (errs.length) return Promise.reject(new Error(errs.join('；')));
  if (R.cal) R.cal.error = t("已重新開始校正");
  if (R.calibration) { R.history.push(R.calibration); R.calibration = null; }
  R.detector = null;
  R.conflicts = 0;
  R.cal = new Calibration(R.config, CALIBRATION_MS, R.config.fftSize / sampleRate() * 1000);
  R.cal.onProgress = onProgress;
  setStatus('calibrating', t("背景校正中，請保持地墊未踩踏…"));
  const tick = setInterval(() => R.cal && onProgress && onProgress(R.cal.progress), 100);
  return new Promise((resolve, reject) => {
    R.calResolve = (cal) => {
      clearInterval(tick);
      if (cal.error) { setStatus('error', cal.error); reject(new Error(cal.error)); return; }
      R.calibration = cal.result();
      R.calibration.sampleRate = sampleRate();
      rebuildDetector();
      persist();
      setStatus('ready', t("校正完成"));
      if (onProgress) onProgress(1);
      resolve(R.calibration);
    };
  });
}

function finishCalibration() {
  const cal = R.cal;
  R.cal = null;
  if (R.calResolve) { const f = R.calResolve; R.calResolve = null; f(cal); }
}

function rebuildDetector() {
  if (!R.calibration || R.calibration.signature !== signature(R.config)) { R.detector = null; R.thr = {}; return; }
  R.thr = thresholds(R.config, R.calibration);
  R.detector = new Detector(R.config, R.thr);        // 從 locked 開始：要先等一次釋放
}

/* ================= 逐格踩踏檢查 ================= */

/**
 * 量測某一格：等該格頻道功率超過背景×全域倍率並持續 confirmMs，之後記錄整次踩踏直到放開
 * （低於 背景×全域倍率×releaseRatio 連續 END_QUIET_MS，或最長 MAX_STEP_MS），
 * 得到實測峰值頻率、訊號功率（中位數、P10）、功率序列與其他頻道的串擾（P95）。
 * onState({ phase:'wait'|'measure'|'release', heard: 其他格位置 })
 */
const END_QUIET_MS = 600;
const MAX_STEP_MS = 6000;
export function measurePosition(position, { timeoutMs = 12000, onState } = {}) {
  if (!R.calibration) return Promise.reject(new Error(t("請先完成背景校正")));
  const ch = R.config.channels.find((c) => c.position === position);
  const B = R.calibration.means;
  const base = (id) => B[id] * R.config.multiplier;
  const sr = sampleRate();
  return new Promise((resolve) => {
    const t0 = performance.now();
    let phase = 'wait', since = null, quietSince = null, start = 0;
    const series = [], hz = [], cross = {};
    const end = (r) => { R.tap = null; R.endMeasure = null; resetDetector(); resolve(r); };
    R.endMeasure = () => end({ position, ok: false, reason: t("已取消") });
    R.tap = (t, frame, powers) => {
      if (phase === 'wait') {
        if (t - t0 > timeoutMs) return end({ position, ok: false, reason: t("沒有聽到這一格的頻率") });
        // 最突出（相對背景倍數最大）的頻道
        let top = null;
        for (const c of R.config.channels) {
          if (c.frequency == null) continue;
          const r = powers[c.id] / base(c.id);
          if (r > 1 && (!top || r > top.r)) top = { c, r };
        }
        if (top && top.c.id === ch.id) {
          if (since == null) since = t;
          if (t - since >= R.config.confirmMs) { phase = 'measure'; start = since; onState && onState({ phase }); }
        } else since = null;
        if (phase === 'wait') onState && onState({ phase, heard: top && top.c.id !== ch.id ? top.c.position : null });
        return;
      }
      // measure：整次踩踏
      const p = powers[ch.id];
      series.push([t - start, p]);
      if (p >= base(ch.id)) hz.push(peakNear(frame, ch.frequency, 240, R.config.fftSize, sr).hz);
      for (const c of R.config.channels) if (c.id !== ch.id && c.frequency != null) (cross[c.id] ||= []).push(powers[c.id]);
      if (p < base(ch.id) * R.config.releaseRatio) {
        if (quietSince == null) { quietSince = t; onState && onState({ phase: 'release' }); }
        if (t - quietSince >= END_QUIET_MS) finish();
      } else quietSince = null;
      if (t - start > MAX_STEP_MS) finish();
    };
    const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
    function finish() {
      // 去掉最後放開後的安靜段
      while (series.length && series[series.length - 1][1] < base(ch.id) * R.config.releaseRatio) series.pop();
      if (series.length < 3) return end({ position, ok: false, reason: t("訊號太短") });
      const ps = series.map(([, p]) => p);
      end({
        position, ok: true, signal: q(ps, 0.5), p10: q(ps, 0.1), durationMs: Math.round(series[series.length - 1][0]),
        peakHz: Math.round(q(hz.length ? hz : [ch.frequency], 0.5)), series,
        cross: Object.fromEntries(Object.entries(cross).map(([id, a]) => [id, q(a, 0.95)])),
      });
    }
  });
}

/** 取消進行中的逐格量測：未完成的量測以「已取消」結束（不會卡住呼叫端） */
export function cancelMeasure() { if (R.endMeasure) R.endMeasure(); R.tap = null; resetDetector(); }

/**
 * 等所有頻道安靜（低於目前閾值 × releaseRatio）持續 quietMs，再開始背景校正，避免把剛才的踩踏算進背景。
 * 還沒有任何閾值時（第一次校正）以背景預設值的 4 倍判斷；逾時就直接繼續（校正本身會再檢查背景是否穩定）。
 */
export function waitQuiet({ quietMs = 1000, timeoutMs = 8000 } = {}) {
  if (!R.timer) return Promise.resolve(false);
  const cal = R.calibration || R.history[R.history.length - 1];
  const thr = Object.keys(R.thr).length ? R.thr : cal && cal.means ? thresholds(R.config, cal) : null;
  return new Promise((resolve) => {
    const t0 = performance.now();
    let since = null;
    R.tap = (t, frame, powers) => {
      const loud = thr && R.config.channels.some((c) => c.frequency != null && thr[c.id] > 0 && powers[c.id] >= thr[c.id] * R.config.releaseRatio);
      if (!thr) { if (t - t0 >= quietMs) { R.tap = null; resolve(true); } return; }
      if (loud) since = null; else if (since == null) since = t;
      if (since != null && t - since >= quietMs) { R.tap = null; resolve(true); }
      else if (t - t0 > timeoutMs) { R.tap = null; resolve(false); }
    };
  });
}

/** 由逐格量測結果算出建議（不套用） */
export function suggest(samples) { return balanceThresholds(R.config, R.calibration, samples); }

/* ================= 偵測（遊戲用） ================= */

export const conflictCount = () => R.conflicts;
export function resetDetector() { if (R.detector) R.detector.reset(); }

/* ================= 監測錄製 ================= */

export function startRecording() { R.recording = { t0: performance.now(), rows: [] }; }
export function stopRecording() {
  const rec = R.recording;
  R.recording = null;
  return rec ? monitorCsv(rec.rows) : null;
}
export const isRecording = () => !!R.recording;

export { POSITIONS };
