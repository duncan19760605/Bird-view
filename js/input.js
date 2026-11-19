/**
 * 九宮格輸入：鍵盤（主鍵盤數字 + 數字鍵盤）、畫面上的九宮格按鈕，以及麥克風聽到的地墊頻率（js/audio-receiver.js）
 *   2/8 上/下（沿用手機鍵盤語意）、4/6 左/右、7/1 放大/縮小、9 攝影、3 退出、5 休息（無功能）
 *   1＋7 同時 → 虛擬鍵 '1+7'（切換裝置）：1/7 先暫存 CONFIG.CHORD_MS，期間另一顆也到達、
 *   或另一顆正被按住，就合成 '1+7'；地墊的 {1,7} 衝突由 main.js 呼叫 pressSwap()
 */
import { CONFIG } from './config.js';

const CODES = {
  Digit1: '1', Numpad1: '1', Digit2: '2', Numpad2: '2', Digit3: '3', Numpad3: '3',
  Digit4: '4', Numpad4: '4', Digit5: '5', Numpad5: '5', Digit6: '6', Numpad6: '6',
  Digit7: '7', Numpad7: '7', Digit8: '8', Numpad8: '8', Digit9: '9', Numpad9: '9',
  ArrowUp: '2', ArrowDown: '8', ArrowLeft: '4', ArrowRight: '6',
  Equal: '7', NumpadAdd: '7', Minus: '1', NumpadSubtract: '1',
  Space: '9', Escape: '3',
};
const PARTNER = { 1: '7', 7: '1' };
export const SWAP = '1+7';

let handlerRef = null;
let pending = null;              // 暫存中的 1 或 7：{ k, timer }
const held = new Map();          // 按住中：鍵盤 code / 觸控 'p'+pointerId → 鍵

const isHeld = (k) => [...held.values()].includes(k);
const emit = (k) => { if (handlerRef) handlerRef(k); };

function cancelPending() {
  if (pending) clearTimeout(pending.timer);
  pending = null;
}

/** 送出暫存的 1/7（時間窗到了，或後面來了別的鍵） */
function flush() {
  if (!pending) return;
  const { k } = pending;
  cancelPending();
  emit(k);
}

/** 鍵盤、九宮格按鈕、麥克風（地墊）共用的送出路徑 */
export function press(k) {
  hit(k);
  const partner = PARTNER[k];
  if (!partner) { flush(); emit(k); return; }
  if ((pending && pending.k === partner) || isHeld(partner)) { pressSwap(); return; }
  flush();                       // 同一顆連按：先送出前一次
  pending = { k, timer: setTimeout(flush, CONFIG.CHORD_MS) };
}

/** 1＋7 同時：取消暫存中的 1/7（不先縮放），送出切換裝置 */
export function pressSwap() {
  cancelPending();
  hit('1');
  hit('7');
  emit(SWAP);
}

export function initInput(handler) {
  handlerRef = handler;
  addEventListener('keydown', (e) => {
    const k = CODES[e.code];
    if (!k) return;
    if (e.repeat && (k === '9' || k === '3' || k === '5')) return;
    e.preventDefault();
    if (e.repeat && PARTNER[k] && isHeld(PARTNER[k])) return;   // 1＋7 按住不重複切換
    held.set(e.code, k);
    press(k);
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  // 九宮格按鈕：pointerdown 才能兩指同時按 1 與 7（click 在多點觸控時不可靠）
  const pad = document.getElementById('keypad');
  pad.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch {}
    held.set(`p${e.pointerId}`, btn.dataset.k);
    press(btn.dataset.k);
  });
  const up = (e) => held.delete(`p${e.pointerId}`);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
}

function hit(k) {
  const btn = document.querySelector(`.key[data-k="${k}"]`);
  if (!btn) return;
  btn.classList.add('hit');
  setTimeout(() => btn.classList.remove('hit'), 110);
}
