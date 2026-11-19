/**
 * 風格素材解析：優先使用選定風格（realistic / pencil）的圖，
 * 檔案不存在時自動退回 realistic，並讓畫面套用程式化的鉛筆濾鏡。
 */
const cache = new Map();
export const missing = new Set();
let usedFallback = false;

export const usedPencilFallback = () => usedFallback;
export const resetFallbackFlag = () => { usedFallback = false; };

export function candidates(rel, style) {
  const list = [`assets/${style}/${rel}`];
  if (style !== 'realistic') list.push(`assets/realistic/${rel}`);
  return list;
}

function tryLoad(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ url, w: img.naturalWidth || 1600, h: img.naturalHeight || 1200 });
    img.onerror = () => res(null);
    img.src = url;
  });
  cache.set(url, p);
  return p;
}

/** 回傳第一個載得到的圖；全部失敗回 null */
export async function resolveImage(rel, style) {
  const urls = candidates(rel, style);
  for (let i = 0; i < urls.length; i++) {
    const r = await tryLoad(urls[i]);
    if (r) { if (i > 0) usedFallback = true; return r; }
  }
  missing.add(`assets/${style}/${rel}`);
  return null;
}
