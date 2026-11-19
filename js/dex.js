import { t, getLocale } from './i18n.js';
import { P } from './progress.js';
import { birdInfo, birds } from './level.js';
import { modal, shotThumbStyle, shotBirdHtml } from './ui.js';
import { fmt, DEVICES } from './device.js';

const $ = (id) => document.getElementById(id);
let tab = 'birds';
let speciesList = [];   // 可玩關卡中出現的鳥種（依出場順序）

export function initDex(onBack, species) {
  speciesList = species || [];
  document.querySelector('#screen-dex .tabs').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    tab = c.dataset.tab;
    for (const x of document.querySelectorAll('#screen-dex .chip')) x.classList.toggle('active', x === c);
    renderDex();
  });
  $('dexBody').addEventListener('click', (e) => {
    const card = e.target.closest('.dex-card[data-species]');
    if (card) showDetail(card.dataset.species);
  });
  $('btnDexBack').onclick = onBack;
}

export function renderDex() {
  $('dexBody').innerHTML = tab === 'birds' ? birdsHtml() : landscapeHtml();
}

function birdsHtml() {
  const all = speciesList.length ? speciesList : Object.keys(birds());
  const dex = P.dexAll;
  if (!all.length) return t("<p class=\"dex-empty\">尚未載入鳥類資料。</p>");
  const cards = all.map((s) => {
    const info = birdInfo(s);
    const rec = dex[s];
    if (!rec) {
      return t("<div class=\"dex-card locked\"><div class=\"thumb\"></div>\n        <div class=\"meta\"><b>？？？</b><span>尚未記錄</span></div></div>");
    }
    return `<div class="dex-card" data-species="${s}">
      <div class="thumb" style="${shotThumbStyle(rec)}">${shotBirdHtml(rec)}
        <span class="res ${rec.resolution === 'low' ? 'low' : ''}">${rec.resolution === 'low' ? t("低解析") : t("高解析")}</span>
      </div>
      <div class="meta"><b>${info.displayName}</b><span>${info.en}</span><br><i>${info.sci}</i></div>
    </div>`;
  }).join('');
  const got = Object.keys(dex).length;
  return t("<p class=\"dex-empty\" style=\"padding:0 0 1.2cqh\">已記錄 {0} / {1} 種</p>\n    <div class=\"dex-grid\">{2}</div>", [got, all.length, cards]);
}

function landscapeHtml() {
  const ls = P.landscapes;
  if (!ls.length) return t("<p class=\"dex-empty\">還沒有風景照。在沒有鳥的位置按 9 就會存到這裡。</p>");
  return `<div class="dex-grid">${ls.map((s) => t("\n    <div class=\"dex-card\"><div class=\"thumb\" style=\"{0}\">\n      <span class=\"res {1}\">{2}</span>\n    </div>\n    <div class=\"meta\"><b>第 {3} 關</b><span>{4}</span><br>\n    <i>{5} {6}X</i></div></div>", [shotThumbStyle(s), s.resolution === 'low' ? 'low' : '', s.resolution === 'low' ? t("低解析") : t("高解析"), s.levelId, new Date(s.at).toLocaleString(getLocale()), DEVICES[s.device].name, fmt(s.zoom)])).join('')}</div>`;
}

function showDetail(species) {
  const info = birdInfo(species);
  const rec = P.dexEntry(species);
  const rows = [
    [t("學名"), info.sci], [t("英文名"), info.en], [t("體長"), info.length], [t("體型"), info.size],
    [t("棲位"), info.habitat], [t("建議倍率"), info.suggestZoom],
    [t("拍攝關卡"), t("第 {0} 關", [rec.levelId])],
    [t("拍攝裝置"), `${DEVICES[rec.device].name} ${fmt(rec.zoom)}X`],
    [t("影像品質"), rec.resolution === 'low' ? t("數位變焦 · 低解析") : t("光學變焦 · 高解析")],
    [t("拍攝時間"), new Date(rec.at).toLocaleString(getLocale())],
  ].filter(([, v]) => v);

  const credit = info.source === 'ai-generated'
    ? t("AI 數位生成影像")
    : [info.photographer && t("攝影：{0}", [info.photographer]), info.license, info.gps && `GPS：${info.gps}`, info.exif]
        .filter(Boolean).join('　·　') || t("授權資訊待補");

  modal(info.displayName, `<div class="detail">
    <div class="shot" style="${shotThumbStyle(rec)}">${shotBirdHtml(rec)}</div>
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="credit">${info.note ? info.note + '<br>' : ''}${credit}</div>
  </div>`, [{ label: t("關閉"), value: true }]);
}
