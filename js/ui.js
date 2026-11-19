import { t } from './i18n.js';
const $ = (id) => document.getElementById(id);
let toastTimer = null;

export function showScreen(name) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== `screen-${name}`;
}

export function toast(msg, kind = '', ms = 1800) {
  const t = $('toast');
  t.className = `toast ${kind}`;
  t.innerHTML = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
export const hideToast = () => { $('toast').hidden = true; };

/** actions: [{label, value, ghost}] → Promise<value> */
export function modal(title, bodyHtml, actions = [{ label: t("好"), value: true }]) {
  return new Promise((resolve) => {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    const bar = $('modalActions');
    bar.innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'btn' + (a.ghost ? ' ghost' : '');
      if (a.ghost) b.style.color = 'var(--ink)', b.style.borderColor = 'var(--line)';
      b.textContent = a.label;
      b.onclick = () => { $('modal').hidden = true; resolve(a.value); };
      bar.appendChild(b);
    }
    $('modal').hidden = false;
    // 預設焦點放在最後一個（主要）按鈕，方便用 9 確認
    focusModalBtn(actions.length - 1);
  });
}

export const modalOpen = () => !$('modal').hidden;

function focusModalBtn(i) {
  const btns = [...$('modalActions').querySelectorAll('button')];
  btns.forEach((b, j) => b.classList.toggle('kfocus', j === i));
}

/** 對話框開著時的九宮格操作：4/6 換按鈕、9 確認、3 選第一個（通常是取消/留下） */
export function modalKey(k) {
  const btns = [...$('modalActions').querySelectorAll('button')];
  if (!btns.length) return;
  let i = btns.findIndex((b) => b.classList.contains('kfocus'));
  if (i < 0) i = btns.length - 1;
  if (k === '4' || k === '2') focusModalBtn(Math.max(0, i - 1));
  else if (k === '6' || k === '8') focusModalBtn(Math.min(btns.length - 1, i + 1));
  else if (k === '9') btns[i].click();
  else if (k === '3') btns[0].click();
}

/** 由一張照片的裁切參數，產生底圖的 CSS background 樣式（縮圖容器需為正方形才不變形） */
export function shotThumbStyle(shot) {
  const vw = shot.view.x1 - shot.view.x0;
  const vh = shot.view.y1 - shot.view.y0;
  const sizeW = 100 / vw;
  const sizeH = 100 / vh;
  const posX = vw >= 1 ? 50 : (shot.view.x0 / (1 - vw)) * 100;
  const posY = vh >= 1 ? 50 : (shot.view.y0 / (1 - vh)) * 100;
  return `background-image:url('${shot.scene}');background-size:${sizeW}% ${sizeH}%;` +
         `background-position:${posX}% ${posY}%;` +
         (shot.resolution === 'low' ? 'filter:blur(.7px) saturate(.92);' : '');
}

/** 照片裡的鳥（與鏡頭內同一套座標換算） */
export function shotBirdHtml(shot) {
  if (!shot.birdBox) return '';
  const vw = shot.view.x1 - shot.view.x0;
  const vh = shot.view.y1 - shot.view.y0;
  const b = shot.birdBox;
  const st = `left:${((b.x0 - shot.view.x0) / vw) * 100}%;top:${((b.y0 - shot.view.y0) / vh) * 100}%;` +
             `width:${(b.w / vw) * 100}%;height:${(b.h / vh) * 100}%;`;
  const cls = 'bird shot-bird' + (shot.birdCutout ? ' cutout' : '') + (shot.birdFlip ? ' flip' : '');
  return shot.birdArt
    ? `<div class="${cls}" style="${st}"><img src="${shot.birdArt}" alt=""></div>`
    : `<div class="${cls} missing" style="${st}"></div>`;
}
