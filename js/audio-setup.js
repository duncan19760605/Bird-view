import { t } from './i18n.js';
/**
 * 收音 Setup 畫面。主要流程是「一鍵引導校正」（runGuided）：開啟收音 → 10 秒背景校正（站在 5 號）
 * → 逐格踩 1 2 3 4 6 7 8 9 → 自動套用通過的格子 → 失敗的格子可「只重踩失敗的格子」。
 * 「進階」區保留分步的 ①–④、頻道表（頻率、閾值模式：全域倍率／自訂倍率／手動功率）、匯出匯入與監測 CSV。
 */
import * as RX from './audio-receiver.js';
import { POSITIONS, POS_NAME, toDb } from './audio-core.js';

const $ = (id) => document.getElementById(id);
const FN = { 1: t("縮小"), 2: t("上移"), 3: t("退出"), 4: t("左移"), 6: t("右移"), 7: t("放大"), 8: t("下移"), 9: t("攝影") };
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const fdb = (p) => f1(toDb(p));

let testMode = false;
let samples = {};
let suggestion = null;
let applied = null;      // 最近一次套用的逐格結果（摘要表用）
let failed = [];
let busy = false;
let guided = false;      // 一鍵引導進行中
let aborted = false;     // 離開畫面：中止進行中的引導
let offs = [];

export function initSetup({ onBack, test = false }) {
  testMode = test;
  $('btnRxGuided').onclick = () => runGuided();
  $('btnRxRetry').onclick = () => runGuided({ only: failed });
  $('btnRxStart').onclick = () => toggleLive();
  $('btnRxCal').onclick = () => runBackground();
  $('btnRxSteps').onclick = () => runSteps();
  $('btnRxApply').onclick = () => applySuggestion();
  $('btnRxExport').onclick = () => download('birdview-audio-settings.json', RX.exportSettings(), 'application/json');
  $('btnRxImport').onclick = () => $('rxImportFile').click();
  $('rxImportFile').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const errs = RX.importSettings(await f.text());
    msg(errs.length ? t("匯入失敗：{0}", [errs.join('；')]) : t("已匯入設定，請重新做背景校正。"));
    renderTable();
  };
  $('btnRxRecord').onclick = () => {
    if (RX.isRecording()) {
      download(`birdview-audio-monitor.csv`, RX.stopRecording(), 'text/csv');
      $('btnRxRecord').textContent = t("開始監測錄製");
    } else {
      RX.startRecording();
      $('btnRxRecord').textContent = t("停止並匯出 CSV");
    }
  };
  $('btnRxReset').onclick = () => { RX.resetConfig(); samples = {}; suggestion = null; applied = null; failed = []; renderTable(); renderSummary(); msg(t("已恢復參考音檔的預設頻率與全域倍率 4，請重新校正。")); };
  $('btnRxBack').onclick = () => { leaveSetup(); onBack(); };
  $('rxGlobal').onchange = (e) => change((c) => { c.multiplier = +e.target.value; });
  $('rxBand').onchange = (e) => change((c) => { c.bandwidth = +e.target.value; });
  $('rxFft').onchange = (e) => change((c) => { c.fftSize = +e.target.value; });
  $('rxRelease').onchange = (e) => change((c) => { c.releaseMs = +e.target.value; });
}

export async function openSetup({ guided: startGuided = false } = {}) {
  await RX.init();
  aborted = false;
  samples = {};
  suggestion = null;
  applied = null;
  failed = [];
  $('btnRxRetry').hidden = true;
  renderPad();
  renderTable();
  await fillDevices();
  offs.push(RX.on('frame', onFrame));
  offs.push(RX.on('input', onInput));
  offs.push(RX.on('status', renderStatus));
  offs.push(RX.on('lost', (e) => msg(t("校正已失效：{0}", [e.reason]))));
  renderStatus(RX.getStatus());
  renderSummary();
  msg(RX.calibrationValid()
    ? t("收音中且校正有效。可直接踩踏測試，或按「一鍵引導校正」重新校正。")
    : t("按「一鍵引導校正」（或按 9）開始：約 1 分鐘，依畫面提示站在 5 號、再逐格踩踏。"));
  if (startGuided) runGuided();
}

/** 設定畫面的九宮格按鍵（鍵盤／觸控）：9 = 一鍵引導校正；3 由 main.js 處理（返回） */
export function setupKey(k) {
  if (k === '9' && !busy && !guided) runGuided();
}

export function leaveSetup() {
  aborted = true;
  RX.cancelMeasure();
  for (const off of offs) off();
  offs = [];
  if (RX.isRecording()) RX.stopRecording();
}

/* ================= 動作 ================= */

async function fillDevices() {
  const sel = $('rxDevice');
  const list = await RX.listDevices();
  const cur = RX.getConfig().deviceId;
  sel.innerHTML = t("<option value=\"\">系統預設麥克風</option>") +
    list.map((d, i) => `<option value="${d.deviceId}">${d.label || t("麥克風 {0}", [i + 1])}</option>`).join('');
  sel.value = list.some((d) => d.deviceId === cur) ? cur : '';
  sel.onchange = () => { if (RX.isLive()) startLive(); };
}

async function toggleLive() {
  if (RX.isLive()) { RX.stop(); renderButtons(); return; }
  await startLive();
}

async function startLive() {
  try {
    if (testMode) {
      await RX.playTestInput([{ url: 'audio-protocol/environment.wav', loop: true }]);
      $('rxRate').textContent = t("測試音檔輸入 · {0} Hz", [RX.sampleRate()]);
    } else {
      const info = await RX.start({ deviceId: $('rxDevice').value });
      $('rxRate').textContent = t("{0} · AudioContext {1} Hz · 裝置 {2}", [info.label || t("麥克風"), info.sampleRate, info.trackRate ? info.trackRate + ' Hz' : t("未確認")]);
      await fillDevices();
    }
    msg(t("收音中。請保持地墊未踩踏，按「背景校正」。"));
  } catch (e) {
    msg(t("無法開啟麥克風：{0}", [e.message || e.name]));
  }
  renderButtons();
}

/** 回傳是否校正成功 */
async function runBackground() {
  if (busy) return false;
  if (!RX.isLive()) await startLive();
  if (!RX.isLive()) return false;
  busy = true; renderButtons();
  highlight(5, 'env');
  let ok = false;
  try {
    await RX.calibrate((p) => { $('rxBar').style.width = `${p * 100}%`; msg(t("背景校正中，請站在 5 號休息區不要踩踏… {0} 秒", [Math.ceil((1 - p) * 10)])); });
    msg(guided ? t("背景校正完成，接著逐格踩踏…") : t("背景校正完成。接著按「逐格踩踏檢查」，依提示踩 1 2 3 4 6 7 8 9。"));
    ok = true;
  } catch (e) { msg(t("校正失敗：{0}", [e.message])); }
  highlight(null);
  busy = false; renderButtons(); renderTable();
  return ok;
}

/** 逐格量測；positions 是全部格子時重新開始，只量部分格子時併入既有結果。回傳是否得到建議 */
async function runSteps(positions = POSITIONS) {
  if (busy || !RX.calibrationValid()) return false;
  busy = true; renderButtons();
  if (positions.length === POSITIONS.length) {
    samples = {};
    for (const c of document.querySelectorAll('#rxPad .cal-cell')) c.classList.remove('done', 'fail');
  }
  for (const pos of positions) {
    if (aborted) break;
    highlight(pos, 'now');
    msg(t("請踩 {0} 號（{1}）…", [pos, POS_NAME[pos]]));
    if (testMode) RX.playTestInput([{ url: `audio-protocol/button-0${pos}.wav`, at: 0.4 }], { keep: true });
    const r = await RX.measurePosition(pos, {
      onState: (s) => {
        if (s.phase === 'wait') msg(s.heard ? t("聽到的是 {0} 號，請踩 {1} 號（{2}）", [s.heard, pos, POS_NAME[pos]]) : t("請踩 {0} 號（{1}）…", [pos, POS_NAME[pos]]));
        else if (s.phase === 'measure') msg(t("量測 {0} 號中…", [pos]));
        else msg(t("{0} 號完成，請回到 5 號休息區…", [pos]));
      },
    });
    samples[pos] = r.ok ? r : null;
    markCell(pos, r.ok ? 'done' : 'fail');
    if (!RX.calibrationValid()) { msg(t("校正在檢查途中失效，請重新做背景校正。")); break; }
  }
  highlight(null);
  suggestion = RX.calibrationValid() && !aborted ? RX.suggest(samples) : null;
  if (suggestion) for (const p of POSITIONS) if (p in samples) markCell(p, suggestion[p].ok ? 'done' : 'fail');
  const bad = POSITIONS.filter((p) => suggestion && !suggestion[p].ok);
  const rel = suggestion ? t("踩踏中訊號最長下陷 {0} ms（{1} 號），建議放開確認 {2} ms。", [suggestion._longestDip, suggestion._dipFrom ?? '—', suggestion._releaseMs]) : '';
  msg(!suggestion ? '' : bad.length
    ? t("檢查完成：{0} 無法可靠區分，其餘可套用。{1}", [bad.map((p) => t("{0} 號（{1}）", [p, suggestion[p].reason])).join('、'), rel])
    : t("檢查完成：8 格都能與背景及其他格分開。{0}按「套用建議」使用新的閾值。", [rel]));
  busy = false; renderButtons(); renderTable();
  return !!suggestion;
}

/**
 * 一鍵引導校正：開啟收音 → 背景校正 → 逐格踩踏 → 自動套用通過的格子。
 * only：只重踩這些格子（併入上次的量測結果後重新計算建議並套用）。
 */
async function runGuided({ only = null } = {}) {
  if (busy || guided) return;
  guided = true;
  $('btnRxRetry').hidden = true;
  renderButtons();
  try {
    if (!RX.isLive()) await startLive();
    if (aborted || !RX.isLive()) return;
    if ((!only || !RX.calibrationValid()) && !(await runBackground())) return;
    if (aborted) return;
    if (!(await runSteps(only || POSITIONS)) || aborted) return;
    const fails = POSITIONS.filter((p) => !suggestion[p].ok);
    const reasons = Object.fromEntries(fails.map((p) => [p, suggestion[p].reason]));
    await applySuggestion();
    if (aborted) return;
    failed = fails;
    $('btnRxRetry').hidden = !failed.length;
    msg(failed.length
      ? t("完成：{0}/8 格已套用。{1} 未通過，維持原本的閾值；可按「只重踩失敗的格子」。", [POSITIONS.length - failed.length, failed.map((p) => t("{0} 號（{1}）", [p, reasons[p]])).join('、')])
      : t("完成：8 格都已套用。試踩任一格，亮起表示可用；按 3 返回選單。"));
  } finally {
    guided = false;
    renderButtons();
    renderSummary();
  }
}

/** 套用建議：頻率偏移超過半頻寬的格子改用實測頻率（需重新背景校正），閾值改為自訂倍率 */
async function applySuggestion() {
  if (!suggestion) return;
  const cfg = RX.getConfig();
  const shift = POSITIONS.filter((p) => suggestion[p].ok && Math.abs(suggestion[p].freqOffset) > cfg.bandwidth / 2);
  const errs = RX.updateConfig((c) => {
    for (const ch of c.channels) {
      const s = suggestion[ch.position];
      if (!s || !s.ok) continue;
      if (shift.includes(ch.position)) ch.frequency = s.peakHz;
      // 倍率在 0.1–1000 內用自訂倍率；超出範圍改用手動功率，避免被截斷
      if (s.multiplier >= 0.1 && s.multiplier <= 1000) { ch.thresholdMode = 'custom'; ch.multiplier = +s.multiplier.toFixed(2); }
      else { ch.thresholdMode = 'manual'; ch.manual = +s.threshold.toPrecision(4); }
    }
    c.releaseMs = suggestion._releaseMs;
  });
  if (errs.length) { msg(t("無法套用：{0}", [errs.join('；')])); return; }
  applied = suggestion;
  suggestion = null;
  renderTable();
  renderSummary();
  if (shift.length) {
    msg(t("已改用 {0} 號的實測頻率，需要重新背景校正…", [shift.join('、')]));
    await runBackground();
  } else msg(t("已套用各格閾值。現在可以踩踏測試：命中的格子會亮起。"));
}

function change(mut) {
  const errs = RX.updateConfig(mut);
  if (errs.length) msg(t("設定無效：{0}", [errs.join('；')]));
  renderTable();
}

/* ================= 畫面 ================= */

function msg(t) { $('rxMsg').textContent = t; }

function renderStatus(s) {
  const map = { idle: t("未收音"), live: t("收音中（未校正）"), calibrating: t("背景校正中"), ready: t("收音中 · 校正有效"), error: t("錯誤") };
  $('rxStatus').textContent = `${map[s.status] || s.status}${s.message && s.status === 'error' ? `：${s.message}` : ''}`;
  $('rxStatus').dataset.s = s.status;
  renderButtons();
}

function renderButtons() {
  const live = RX.isLive(), valid = RX.calibrationValid(), lock = busy || guided;
  $('btnRxStart').textContent = live ? t("停止收音") : t("① 開啟收音");
  $('btnRxGuided').disabled = lock;
  $('btnRxGuided').textContent = guided ? t("引導校正中…") : t("一鍵引導校正（9）");
  $('btnRxRetry').disabled = lock;
  $('btnRxCal').disabled = lock || !live;
  $('btnRxSteps').disabled = lock || !valid;
  $('btnRxApply').disabled = lock || !suggestion;
  $('btnRxStart').disabled = lock;
  $('rxDevice').disabled = lock || testMode;
}

/** 右側摘要：每一格的檢查結果與目前使用的閾值 */
const MODE = { global: t("預設（背景 × 全域倍率）"), custom: t("已校正（自訂倍率）"), manual: t("已校正（手動閾值）") };
function renderSummary() {
  const cfg = RX.getConfig();
  if (!cfg) return;
  const res = suggestion || applied;
  const rows = cfg.channels.map((c) => {
    const r = res && res[c.position];
    const result = !r ? '<span class="dim">—</span>'
      : r.ok ? t("<span class=\"ok\">✓ 通過</span>") : `<span class="bad">✗ ${r.reason}</span>`;
    const snr = r && r.ok ? `${f1(r.snrDb)} dB` : '—';
    const margin = r && r.ok ? `${f1(r.marginDb)} dB` : '—';
    return `<tr><td><b>${c.position}</b> ${POS_NAME[c.position]}・${FN[c.position]}</td><td>${result}</td><td>${snr}</td><td>${margin}</td><td>${MODE[c.thresholdMode]}</td></tr>`;
  }).join('');
  const calibrated = cfg.channels.filter((c) => c.thresholdMode !== 'global').length;
  $('rxSummary').innerHTML =
    t("<p class=\"hint\">{0}訊雜比（SNR）越高越穩；餘裕低於 3 dB 的格子容易漏判或誤觸。</p>", [calibrated ? t("{0}/8 格已有校正閾值。", [calibrated]) : t("各格仍是預設閾值，建議做一次一鍵引導校正。")]) +
    t("<table><thead><tr><th>格子</th><th>檢查結果</th><th>SNR</th><th>餘裕</th><th>目前閾值</th></tr></thead><tbody>{0}</tbody></table>", [rows]);
}

function renderPad() {
  $('rxPad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) =>
    `<div class="cal-cell${k === 5 ? ' rest' : ''}" data-k="${k}"><b>${k}</b><small>${k === 5 ? t("休息區") : FN[k]}</small><i></i></div>`).join('');
}
function highlight(k, cls = 'now') {
  for (const c of document.querySelectorAll('#rxPad .cal-cell')) {
    c.classList.toggle('now', cls === 'now' && c.dataset.k === String(k));
    c.classList.toggle('env', cls === 'env' && c.dataset.k === String(k));
  }
}
function markCell(k, cls) {
  const c = document.querySelector(`#rxPad .cal-cell[data-k="${k}"]`);
  if (!c) return;
  c.classList.remove('done', 'fail');
  c.classList.add(cls);
}

function onInput(ev) {
  if (ev.conflict) { msg(t("衝突：{0} 號同時超標（不觸發）", [ev.positions.join('、')])); return; }
  const c = document.querySelector(`#rxPad .cal-cell[data-k="${ev.position}"]`);
  if (!c) return;
  c.classList.add('hit');
  setTimeout(() => c.classList.remove('hit'), 400);
}

function renderTable() {
  const cfg = RX.getConfig();
  if (!cfg) return;
  $('rxGlobal').value = cfg.multiplier;
  $('rxBand').value = cfg.bandwidth;
  $('rxFft').value = cfg.fftSize;
  $('rxRelease').value = cfg.releaseMs;
  const rows = cfg.channels.map((c) => {
    const s = suggestion && suggestion[c.position];
    const sug = !s ? '' : s.ok
      ? t("<div class=\"sug\">實測 {0} Hz（{1}{2}）· 訊號 {3}（P10 {4}）· SNR {5} dB · 餘裕 {6} dB · 下陷 {7} ms → 閾值 {8} dB</div>", [s.peakHz, s.freqOffset >= 0 ? '+' : '', Math.round(s.freqOffset), f1(s.signalDb), f1(s.p10Db), f1(s.snrDb), f1(s.marginDb), s.dipMs, f1(toDb(s.threshold))])
      : `<div class="sug bad">${s.reason}</div>`;
    return t("<tr data-id=\"{0}\">\n      <td><b>{1}</b> {2}</td>\n      <td><input type=\"number\" class=\"rx-f\" value=\"{3}\" step=\"5\"> {4}</td>\n      <td><select class=\"rx-m\">\n        <option value=\"global\"{5}>全域倍率</option>\n        <option value=\"custom\"{6}>自訂倍率</option>\n        <option value=\"manual\"{7}>手動閾值</option></select></td>\n      <td><input type=\"number\" class=\"rx-v\" step=\"0.1\" title=\"{8}\" value=\"{9}\"{10}>{11}</td>\n      <td class=\"lv-db\">—</td><td class=\"lv-bg\">—</td><td class=\"lv-th\">—</td><td class=\"lv-r\">—</td><td class=\"lv-pk\">—</td><td class=\"lv-st\">—</td>\n    </tr>", [c.id, c.position, POS_NAME[c.position], c.frequency ?? '', sug, c.thresholdMode === 'global' ? ' selected' : '', c.thresholdMode === 'custom' ? ' selected' : '', c.thresholdMode === 'manual' ? ' selected' : '', c.thresholdMode === 'manual' ? t("手動閾值（dB，內部存為線性功率）") : t("倍率（線性功率）"), c.thresholdMode === 'manual' ? (c.manual > 0 ? f1(toDb(c.manual)) : '') : c.thresholdMode === 'custom' ? c.multiplier : cfg.multiplier, c.thresholdMode === 'global' ? ' disabled' : '', c.thresholdMode === 'manual' ? ' dB' : ' ×']);
  }).join('');
  $('rxTable').innerHTML = t("<table><thead><tr><th>位置</th><th>頻率 Hz</th><th>閾值模式</th><th>倍率／手動 dB</th><th>功率 dB</th><th>背景 dB</th><th>閾值 dB</th><th>比值</th><th>峰值 Hz</th><th>狀態</th></tr></thead><tbody>{0}</tbody></table>", [rows]);
  for (const tr of $('rxTable').querySelectorAll('tr[data-id]')) {
    const id = tr.dataset.id;
    tr.querySelector('.rx-f').onchange = (e) => change((c) => { c.channels.find((x) => x.id === id).frequency = e.target.value === '' ? null : +e.target.value; });
    tr.querySelector('.rx-m').onchange = (e) => change((c) => {
      const ch = c.channels.find((x) => x.id === id);
      ch.thresholdMode = e.target.value;
      if (ch.thresholdMode === 'manual' && !(ch.manual > 0)) {
        const cal = RX.getCalibration();
        ch.manual = cal ? cal.means[id] * c.multiplier : 1e-9;
      }
    });
    tr.querySelector('.rx-v').onchange = (e) => change((c) => {
      const ch = c.channels.find((x) => x.id === id);
      if (ch.thresholdMode === 'manual') ch.manual = Math.pow(10, +e.target.value / 10); else ch.multiplier = +e.target.value;
    });
  }
}

const ST = { locked: t("鎖定"), armed: t("待命"), confirming: t("確認中"), conflict: t("衝突"), invalid: t("無效"), calibrating: t("校正中"), uncalibrated: t("未校正") };
function onFrame({ rows, conflicts }) {
  for (const r of rows) {
    const tr = document.querySelector(`#rxTable tr[data-id="${r.id}"]`);
    if (!tr) continue;
    tr.querySelector('.lv-db').textContent = f1(r.db);
    tr.querySelector('.lv-bg').textContent = r.background ? fdb(r.background) : '—';
    tr.querySelector('.lv-th').textContent = r.threshold ? fdb(r.threshold) : '—';
    tr.querySelector('.lv-r').textContent = r.ratio != null ? r.ratio.toFixed(2) : '—';
    tr.querySelector('.lv-pk').textContent = r.peakHz;
    tr.querySelector('.lv-st').textContent = ST[r.state] || r.state;
    tr.classList.toggle('over', r.ratio > 1);
    const bar = document.querySelector(`#rxPad .cal-cell[data-k="${r.position}"] i`);
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, (r.ratio || 0) / 2)) * 100}%`;
  }
  $('rxConflicts').textContent = t("衝突事件 {0} 次", [conflicts]);
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
