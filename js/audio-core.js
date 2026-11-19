import { t } from './i18n.js';
/**
 * 九宮格地墊超聲波接收：純邏輯（沒有 Web Audio、沒有 DOM），規則依 motionpad-audio-receiver：
 *   - 頻道：位置 1–4、6–9（5 號休息區永遠不是頻道、不產生事件），頻率不可重疊、不得超過 Nyquist
 *   - 帶內功率：[ceil((f−w)·N/sr), floor((f+w)·N/sr)] 的 10^(dB/10) 線性平均；-Infinity → 0；NaN/+Infinity 無效
 *   - 背景校正：10 秒矩形時間加權積分，所有頻道平均需 > 0；取樣間隔 > 250 ms 即失效
 *   - 閾值：manual → 手動功率；custom → 背景 × 該頻道倍率；global → 背景 × 全域倍率（預設 4，線性功率）
 *   - 偵測器：locked →(p < T·0.6 持續 80ms)→ armed →(p > T 持續 40ms)→ trigger；多頻同時超標 → conflict
 */

export const SCHEMA_VERSION = 2;
export const POSITIONS = [1, 2, 3, 4, 6, 7, 8, 9];
export const CELL = { 1: 'NW', 2: 'N', 3: 'NE', 4: 'W', 6: 'E', 7: 'SW', 8: 'S', 9: 'SE' };
export const POS_NAME = { 1: t("左上"), 2: t("上"), 3: t("右上"), 4: t("左"), 5: t("休息區"), 6: t("右"), 7: t("左下"), 8: t("下"), 9: t("右下") };
export const CALIBRATION_MS = 10000;
export const MAX_GAP_MS = 250;

/** 預設設定；頻率由 audio-protocol/protocol.json（參考音檔分析）帶入 */
export function defaultConfig(refKeys = {}) {
  return {
    version: SCHEMA_VERSION,
    deviceId: '',
    fftSize: 4096,
    bandwidth: 40,
    smoothing: 0,
    multiplier: 4,
    confirmMs: 40,
    releaseRatio: 0.6,
    releaseMs: 80,
    channels: POSITIONS.map((p) => ({
      id: `ch${POSITIONS.indexOf(p) + 1}`,
      position: p,
      frequency: refKeys[p] ?? null,
      thresholdMode: 'global',
      multiplier: 4,
      manual: null,
    })),
  };
}

/** 檢查設定；回傳錯誤訊息陣列（空陣列 = 有效） */
export function validate(config, sampleRate = 48000) {
  const err = [];
  if (!config || config.version !== SCHEMA_VERSION) return [t("設定版本不符")];
  if (![2048, 4096, 8192].includes(config.fftSize)) err.push(t("fftSize 必須是 2048／4096／8192"));
  if (!(config.bandwidth >= 5 && config.bandwidth <= 200)) err.push(t("半頻寬必須在 5–200 Hz"));
  if (!(config.multiplier >= 0.1 && config.multiplier <= 1000)) err.push(t("全域倍率必須在 0.1–1000"));
  if (!(config.confirmMs >= 0 && config.confirmMs <= 2000)) err.push(t("confirmMs 必須在 0–2000"));
  if (!(config.releaseRatio >= 0.01 && config.releaseRatio <= 0.99)) err.push(t("releaseRatio 必須在 0.01–0.99"));
  if (!(config.releaseMs >= 0 && config.releaseMs <= 2000)) err.push(t("releaseMs 必須在 0–2000"));
  const seen = new Set();
  const nyq = sampleRate / 2;
  const active = [];
  for (const c of config.channels || []) {
    if (!/^ch[1-8]$/.test(c.id)) err.push(t("頻道代號錯誤：{0}", [c.id]));
    if (c.position === 5) err.push(t("5 號是休息區，不能設定頻道"));
    if (seen.has(c.position)) err.push(t("{0} 號重複", [c.position]));
    seen.add(c.position);
    if (c.frequency == null) { err.push(t("{0} 號（{1}）沒有頻率", [c.position, POS_NAME[c.position]])); continue; }
    if (!(c.frequency > 0)) err.push(t("{0} 號頻率無效", [c.position]));
    else if (c.frequency + config.bandwidth >= nyq) err.push(t("{0} 號 {1} Hz 超過取樣率 {2} 的上限", [c.position, c.frequency, sampleRate]));
    if (c.thresholdMode === 'custom' && !(c.multiplier >= 0.1 && c.multiplier <= 1000)) err.push(t("{0} 號自訂倍率必須在 0.1–1000", [c.position]));
    if (c.thresholdMode === 'manual' && !(c.manual > 0 && isFinite(c.manual))) err.push(t("{0} 號手動閾值必須是正數", [c.position]));
    active.push(c);
  }
  active.sort((a, b) => a.frequency - b.frequency);
  for (let i = 1; i < active.length; i++) {
    if (active[i].frequency - active[i - 1].frequency <= 2 * config.bandwidth)
      err.push(t("{0} 號與 {1} 號頻率重疊", [active[i - 1].position, active[i].position]));
  }
  return err;
}

/** 校正簽章：裝置、FFT、頻寬與每個頻道的 [id, position, frequency] */
export function signature(config) {
  return JSON.stringify([config.deviceId || '', config.fftSize, config.bandwidth,
    config.channels.map((c) => [c.id, c.position, c.frequency])]);
}

export function bandBins(f, w, fftSize, sampleRate) {
  return [Math.ceil((f - w) * fftSize / sampleRate), Math.floor((f + w) * fftSize / sampleRate)];
}

/** 帶內線性相對功率；遇到 NaN/+Infinity 回傳 NaN（無效） */
export function bandPower(frameDb, f, w, fftSize, sampleRate) {
  const [b0, b1] = bandBins(f, w, fftSize, sampleRate);
  let sum = 0, n = 0;
  for (let i = Math.max(0, b0); i <= Math.min(frameDb.length - 1, b1); i++) {
    const d = frameDb[i];
    if (d === -Infinity) { n++; continue; }
    if (!Number.isFinite(d)) return NaN;
    sum += Math.pow(10, d / 10);
    n++;
  }
  return n ? sum / n : 0;
}

export const toDb = (p) => (p > 0 ? 10 * Math.log10(p) : -Infinity);

/** 在 f±searchHz 內找峰值頻率（拋物線內插）；回傳 { hz, db } */
export function peakNear(frameDb, f, searchHz, fftSize, sampleRate) {
  const binHz = sampleRate / fftSize;
  const b0 = Math.max(1, Math.ceil((f - searchHz) / binHz));
  const b1 = Math.min(frameDb.length - 2, Math.floor((f + searchHz) / binHz));
  let bi = b0;
  for (let i = b0; i <= b1; i++) if (frameDb[i] > frameDb[bi]) bi = i;
  const a = frameDb[bi - 1], b = frameDb[bi], c = frameDb[bi + 1];
  const den = a - 2 * b + c;
  const d = Number.isFinite(den) && den !== 0 ? 0.5 * (a - c) / den : 0;
  return { hz: (bi + Math.max(-0.5, Math.min(0.5, d))) * binHz, db: b };
}

/**
 * 背景校正：先等暖機 warmupMs（分析窗 fftSize/sampleRate 填滿），再做 10 秒矩形時間加權積分（以上一個取樣值代表該區間）。
 * 環境中常有短暫的敲擊、拍手等突波：高於該頻道中位數 SPIKE_RATIO（+12 dB）且持續 < SUSTAIN_MS 的時段不計入背景平均
 * （原始平均另存 rawMeans）；同樣的高訊號持續 ≥ SUSTAIN_MS 表示期間有人踩踏或音場改變，校正失效。
 */
export const SPIKE_RATIO = 16;
export const MIN_BACKGROUND = 1e-15;   // -150 dB：低於任何實體麥克風的底噪，視為數位無聲（該頻率被濾掉、收不到）
export const SUSTAIN_MS = 300;
export class Calibration {
  constructor(config, durationMs = CALIBRATION_MS, warmupMs = 0) {
    this.ids = config.channels.filter((c) => c.frequency != null).map((c) => c.id);
    this.pos = Object.fromEntries(config.channels.map((c) => [c.id, c.position]));
    this.sig = signature(config);
    this.durationMs = durationMs;
    this.warmupMs = warmupMs;
    this.sums = Object.fromEntries(this.ids.map((id) => [id, 0]));
    this.parts = Object.fromEntries(this.ids.map((id) => [id, []]));   // [dt, power]
    this.elapsed = 0;
    this.firstT = null;
    this.lastT = null;
    this.lastP = null;
    this.error = null;
  }
  /** powers: { id: 線性功率 }；回傳 true 表示完成（成功或失敗看 this.error） */
  add(t, powers) {
    if (this.error || this.done) return true;
    for (const id of this.ids) {
      if (!Number.isFinite(powers[id])) { this.error = t("收音出現無效值，請重新校正"); return true; }
    }
    if (this.firstT == null) this.firstT = t;
    if (t - this.firstT < this.warmupMs) return false;
    if (this.lastT != null) {
      const gap = t - this.lastT;
      if (gap > MAX_GAP_MS) { this.error = t("取樣中斷超過 {0}ms，請重新校正", [MAX_GAP_MS]); return true; }
      const dt = Math.min(gap, this.durationMs - this.elapsed);
      for (const id of this.ids) {
        this.sums[id] += this.lastP[id] * dt;
        this.parts[id].push([dt, this.lastP[id]]);
      }
      this.elapsed += dt;
    }
    this.lastT = t;
    this.lastP = powers;
    if (this.elapsed >= this.durationMs) this.finish();
    return this.done || !!this.error;
  }
  finish() {
    this.rawMeans = Object.fromEntries(this.ids.map((id) => [id, this.sums[id] / this.durationMs]));
    this.means = {};
    this.transientMs = {};
    const unstable = [];
    for (const id of this.ids) {
      const parts = this.parts[id];
      const sorted = parts.map(([, p]) => p).sort((x, y) => x - y);
      const limit = sorted[sorted.length >> 1] * SPIKE_RATIO;
      let run = 0, longest = 0, keepSum = 0, keepMs = 0, skipMs = 0;
      for (const [dt, p] of parts) {
        if (p > limit) { run += dt; skipMs += dt; longest = Math.max(longest, run); }
        else { run = 0; keepSum += p * dt; keepMs += dt; }
      }
      if (longest >= SUSTAIN_MS) unstable.push(this.pos[id]);
      this.means[id] = keepMs > 0 ? keepSum / keepMs : this.rawMeans[id];
      this.transientMs[id] = Math.round(skipMs);
    }
    this.parts = null;
    this.done = true;
    const silent = this.ids.filter((id) => !(this.means[id] > MIN_BACKGROUND));
    if (silent.length === this.ids.length) this.error = t("背景功率為 0（沒有收到聲音），請確認麥克風");
    else if (silent.length)
      this.error = t("{0} 號的頻率在這支麥克風收不到任何聲音（可能被濾掉或取樣率不足），請改用其他麥克風或調整該格頻率", [silent.map((id) => this.pos[id]).join('、')]);
    else if (unstable.length)
      this.error = t("背景不穩定（{0} 號在校正期間持續有訊號，可能有人踩踏），請離開地墊後重新校正", [unstable.join('、')]);
  }
  get progress() { return Math.min(1, this.elapsed / this.durationMs); }
  result() {
    return {
      signature: this.sig, at: new Date().toISOString(), durationMs: this.durationMs,
      means: this.means, rawMeans: this.rawMeans, transientMs: this.transientMs,
    };
  }
}

/** 各頻道閾值（線性功率） */
export function thresholds(config, calibration) {
  const out = {};
  for (const c of config.channels) {
    if (c.frequency == null) continue;
    const B = calibration && calibration.means ? calibration.means[c.id] : NaN;
    if (c.thresholdMode === 'manual' && c.manual > 0) out[c.id] = c.manual;
    else out[c.id] = B * (c.thresholdMode === 'custom' ? c.multiplier : config.multiplier);
  }
  return out;
}

/**
 * 偵測器狀態機。step(t, powers) 回傳事件陣列：
 *   { type: 'trigger', ids:[id], position, cell } | { type: 'release', ids } | { type: 'conflict', ids, positions }
 */
export class Detector {
  constructor(config, thr) {
    this.cfg = config;
    this.thr = thr;
    this.ch = config.channels.filter((c) => c.frequency != null)
      .map((c) => ({ id: c.id, position: c.position, state: 'locked', since: null }));
  }
  reset() { for (const c of this.ch) { c.state = 'locked'; c.since = null; } }
  step(t, powers) {
    const { confirmMs, releaseRatio, releaseMs } = this.cfg;
    const ev = [];
    for (const c of this.ch) {
      const p = powers[c.id], T = this.thr[c.id];
      if (!Number.isFinite(p) || !(T > 0)) { c.state = 'invalid'; c.since = null; continue; }
      c.p = p; c.T = T;
      if (c.state === 'invalid') c.state = 'locked';
      if (c.state === 'locked' || c.state === 'conflict') {
        if (p < T * releaseRatio) {
          if (c.since == null) c.since = t;
          if (t - c.since >= releaseMs) { c.state = 'armed'; c.since = null; ev.push({ type: 'release', ids: [c.id] }); }
        } else c.since = null;
      } else if (c.state === 'armed') {
        if (p > T) { c.state = 'confirming'; c.since = t; }
      } else if (c.state === 'confirming') {
        if (!(p > T)) { c.state = 'armed'; c.since = null; }   // 短脈衝取消
      }
    }
    // 確認時間到：只有一個頻道超標才觸發，多頻同時超標 → conflict
    const ready = this.ch.filter((c) => c.state === 'confirming' && t - c.since >= confirmMs);
    if (ready.length) {
      const over = this.ch.filter((c) => c.state !== 'invalid' && c.p > c.T);
      if (over.length > 1) {
        for (const c of over) { c.state = 'conflict'; c.since = null; }
        ev.push({ type: 'conflict', ids: over.map((c) => c.id), positions: over.map((c) => c.position) });
      } else {
        const c = ready[0];
        c.state = 'locked'; c.since = null;          // 按住不重複：要先放開才能再觸發
        ev.push({ type: 'trigger', ids: [c.id], position: c.position, cell: CELL[c.position] });
      }
    }
    return ev;
  }
  states() { return Object.fromEntries(this.ch.map((c) => [c.id, c.state])); }
}

/**
 * 逐格踩踏檢查（校正後）：由各格的實測訊號、串擾與訊號起伏，算出能把該格與背景／其他格分開的閾值。
 *   samples[pos] = { signal: 該格頻道在整次踩踏中的功率中位數, p10, peakHz, cross: {id: 其他頻道的功率 P95},
 *                    series: [[ms, power], ...] 整次踩踏的功率序列 }
 *   下限 = max(背景 × 全域倍率, 其他格踩踏時造成的最大串擾 × 2)；上限 = 該格訊號中位數
 *   建議閾值 = 上下限的幾何平均（dB 中點）；下限 ≥ 上限時標記無法區分
 * 踩踏中的訊號會短暫下陷：量出每格踩踏「中途」低於 閾值 × releaseRatio 的最長時間，
 * 建議的 releaseMs 要比它長，避免一次踩踏被判成多次（res._releaseMs）。
 */
export function balanceThresholds(config, calibration, samples) {
  const res = {};
  let longestDip = 0, dipFrom = null;
  for (const c of config.channels) {
    const s = samples[c.position];
    const B = calibration.means[c.id];
    if (!s || !(s.signal > 0)) { res[c.position] = { ok: false, reason: t("沒有量到訊號") }; continue; }
    let cross = 0, crossFrom = null;
    for (const [pos, o] of Object.entries(samples)) {
      if (+pos === c.position || !o || !o.cross) continue;
      if (o.cross[c.id] > cross) { cross = o.cross[c.id]; crossFrom = +pos; }
    }
    const low = Math.max(B * config.multiplier, cross * 2);
    const high = s.signal;
    const ok = low < high;
    const T = ok ? Math.sqrt(low * high) : low;
    const dip = longestInnerDip(s.series || [], T * config.releaseRatio);
    if (ok && dip > longestDip) { longestDip = dip; dipFrom = c.position; }
    res[c.position] = {
      ok,
      signalDb: toDb(s.signal), p10Db: toDb(s.p10), backgroundDb: toDb(B), crossDb: toDb(cross), crossFrom,
      snrDb: toDb(s.signal) - toDb(B),
      marginDb: toDb(high) - toDb(low),
      threshold: T, multiplier: T / B, dipMs: Math.round(dip),
      peakHz: s.peakHz, freqOffset: s.peakHz - c.frequency,
      reason: ok ? '' : (cross * 2 >= B * config.multiplier && crossFrom ? t("與 {0} 號的串擾太接近", [crossFrom]) : t("訊號與背景太接近")),
    };
  }
  res._releaseMs = Math.min(2000, Math.max(80, Math.ceil((longestDip * 1.5 + 40) / 10) * 10));
  res._dipFrom = dipFrom;
  res._longestDip = Math.round(longestDip);
  return res;
}

/** 踩踏中途（不含最後放開）功率低於 level 的最長連續時間（ms） */
function longestInnerDip(series, level) {
  let last = -1;
  for (let i = series.length - 1; i >= 0; i--) if (series[i][1] >= level) { last = i; break; }
  const first = series.findIndex(([, p]) => p >= level);
  if (first < 0 || last <= first) return 0;
  let best = 0, start = null;
  for (let i = first; i <= last; i++) {
    const [t, p] = series[i];
    if (p < level) { if (start == null) start = series[i - 1][0]; }
    else if (start != null) { best = Math.max(best, t - start); start = null; }
  }
  return best;
}

const CSV_COLS = ['timeMs', 'kind', 'id', 'position', 'frequencyHz', 'power', 'db', 'background', 'threshold', 'ratio', 'peakHz', 'state'];
/** 監測 CSV：12 欄、UTF-8 BOM ＋ CRLF */
export function monitorCsv(rows) {
  const esc = (v) => (v == null ? '' : typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(6) : '') : String(v));
  return '﻿' + [CSV_COLS.join(','), ...rows.map((r) => CSV_COLS.map((k) => esc(r[k])).join(','))].join('\r\n') + '\r\n';
}
