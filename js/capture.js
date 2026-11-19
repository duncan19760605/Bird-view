import { CONFIG } from './config.js';
import { isDigital } from './device.js';

/**
 * 鳥在正規化座標的方框。
 * inset 圖：畫面上為正方形；cutout 圖：依去背圖的高寬比 (bird.ar = h/w)。
 */
export function birdBox(bird, aspect) {
  const w = bird.scale;
  const h = bird.scale * aspect * (bird.art === 'cutout' ? bird.ar || 1 : 1);
  return { x0: bird.x - w / 2, y0: bird.y - h / 2, x1: bird.x + w / 2, y1: bird.y + h / 2, w, h };
}

/**
 * 鳥算不算「入鏡」：
 *  - 鳥框有 CAPTURE_COVERAGE（60%）以上在視野內；或
 *  - 高倍率下鳥比視野還大（望遠鏡 20X 拍近距離大鳥）：鳥身中心在視野內，且鳥佔滿視野一半以上
 */
function inFrame(box, view) {
  const iw = Math.min(box.x1, view.x1) - Math.max(box.x0, view.x0);
  const ih = Math.min(box.y1, view.y1) - Math.max(box.y0, view.y0);
  if (iw <= 0 || ih <= 0) return false;
  const inter = iw * ih;
  if (inter / (box.w * box.h) >= CONFIG.CAPTURE_COVERAGE) return true;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const centered = cx >= view.x0 && cx <= view.x1 && cy >= view.y0 && cy <= view.y1;
  return centered && inter / ((view.x1 - view.x0) * (view.y1 - view.y0)) >= CONFIG.FILL_COVERAGE;
}

/** 目前視野中「算入鏡」的鳥 */
export function birdsInView(birds, view, aspect) {
  return birds.filter((b) => inFrame(birdBox(b, aspect), view));
}

/**
 * 按下 9 的判定
 * 0 隻 → 風景照；1 隻 → 入圖鑑；2 隻以上 → 失敗（一張照片只能有一種鳥）
 */
export function shoot(camera, birds) {
  const view = camera.rect();
  const hits = birdsInView(birds, view, camera.aspect);
  const digital = isDigital(camera.device, camera.zoom);
  const shot = {
    at: Date.now(),
    cx: camera.cx, cy: camera.cy,
    zoom: camera.zoom, device: camera.device,
    resolution: digital ? 'low' : 'high',
    aspect: camera.aspect,
    view,
  };
  if (hits.length === 0) return { type: 'landscape', shot };
  if (hits.length > 1) return { type: 'multi', shot, hits };
  return { type: 'bird', shot, bird: hits[0] };
}
