import { t } from './i18n.js';
import { CONFIG } from './config.js';

export const DEVICES = {
  phone: {
    key: 'phone', name: t("手機"),
    opticalMax: 3,            // 3X 光學
    steps: [1, 2, 3, 6],      // 有段式：1/2/3 光學，6 = 3X 光學 x 2X 數位
    min: 1, max: 6, fine: 0.25,
  },
  scope: {
    key: 'scope', name: t("單筒望遠鏡"),
    opticalMax: 20,           // 10–20X 全部是光學
    steps: [10, 15, 20],
    min: 10, max: 20, fine: 0.5,
  },
};

export function isDigital(deviceKey, zoom) {
  return zoom > DEVICES[deviceKey].opticalMax + 1e-6;
}

export function zoomLabel(deviceKey, zoom) {
  const d = DEVICES[deviceKey];
  if (!isDigital(deviceKey, zoom)) return t("光學 {0}X", [fmt(zoom)]);
  return t("光學 {0}X × 數位 {1}X", [fmt(d.opticalMax), fmt(zoom / d.opticalMax)]);
}

export const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 依關卡模式計算下一個倍率 */
export function nextZoom(deviceKey, zoom, dir, mode) {
  const d = DEVICES[deviceKey];
  if (mode === 'continuous') {
    return clamp(round2(zoom + dir * d.fine), d.min, d.max);
  }
  const i = d.steps.findIndex((v) => Math.abs(v - zoom) < 1e-6);
  const idx = i < 0 ? nearestIndex(d.steps, zoom) : i;
  return d.steps[clamp(idx + dir, 0, d.steps.length - 1)];
}

export function defaultZoom(deviceKey) { return DEVICES[deviceKey].min; }

const nearestIndex = (arr, v) =>
  arr.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(arr[best] - v) ? i : best), 0);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round2 = (v) => Math.round(v * 100) / 100;

/** 視野大小（正規化座標）。aspect = 場景寬/高，使視野在畫面上是正方形 */
export function fovOf(zoom, aspect) {
  const w = CONFIG.BASE_FOV / zoom;
  return { w, h: w * aspect };
}

/**
 * 位移步距（正規化座標）
 *  - 1X（最廣角）：全幅剛好 CONFIG.BASE_STEPS(20) 步
 *  - 放大後：一個視野橫跨 CONFIG.SUB_STEPS(3) 步 → 上下左右形成 3x3 移動
 */
export function stepOf(zoom, axisFov, minZoom) {
  if (zoom <= minZoom + 1e-6) return (1 - axisFov) / CONFIG.BASE_STEPS;
  return axisFov / CONFIG.SUB_STEPS;
}
