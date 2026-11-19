import { t } from './i18n.js';
import { birdBox } from './capture.js';
import { isDigital, zoomLabel, fmt, DEVICES } from './device.js';
import { birdInfo } from './level.js';

const $ = (id) => document.getElementById(id);

export class Renderer {
  constructor() {
    this.scene = $('scene');
    this.sceneImg = $('sceneImg');
    this.birdLayer = $('birdLayer');
    this.reticle = $('reticle');
    this.lens = $('lens');
    this.lensView = $('lensView');
    this.lensBirds = $('lensBirds');
    this.els = [];           // { bird, eyeEl, lensEl }
    this.level = null;
    this.assets = null;
    addEventListener('resize', () => this.draw());
  }

  mount(level, assets, camera) {
    this.level = level;
    this.assets = assets;
    this.camera = camera;
    this.scene.style.setProperty('--scene-aspect', String(assets.aspect));
    this.sceneImg.src = assets.sceneUrl || '';
    this.lensView.style.backgroundImage = assets.sceneUrl ? `url("${assets.sceneUrl}")` : 'none';

    this.birdLayer.innerHTML = '';
    this.lensBirds.innerHTML = '';
    this.els = level.birds.map((b) => {
      const url = assets.birdUrls[b.species];
      const eyeEl = makeBird(url, b, assets.aspect, 'eye');
      const lensEl = makeBird(url, b, assets.aspect, 'lens');
      this.birdLayer.appendChild(eyeEl);
      this.lensBirds.appendChild(lensEl);
      return { bird: b, eyeEl, lensEl };
    });
    this.draw();
  }

  draw() {
    const c = this.camera;
    if (!c || !this.level) return;
    const f = c.fov;
    const rect = c.rect();

    // 左側游標
    this.reticle.style.left = `${rect.x0 * 100}%`;
    this.reticle.style.top = `${rect.y0 * 100}%`;
    this.reticle.style.width = `${f.w * 100}%`;
    this.reticle.style.height = `${f.h * 100}%`;

    // 右側鏡頭
    const L = this.lens.clientWidth || 1;
    const bgW = L / f.w;
    const bgH = bgW / c.aspect;
    this.lensView.style.backgroundSize = `${bgW}px ${bgH}px`;
    this.lensView.style.backgroundPosition = `${-rect.x0 * bgW}px ${-rect.y0 * bgH}px`;

    const digital = isDigital(c.device, c.zoom);
    this.lens.classList.toggle('digital', digital);
    this.lens.classList.toggle('zoomed', c.zoom > DEVICES[c.device].min + 1e-6);

    for (const e of this.els) {
      const box = birdBox(e.bird, c.aspect);
      e.lensEl.style.left = `${(box.x0 - rect.x0) * bgW}px`;
      e.lensEl.style.top = `${(box.y0 - rect.y0) * bgH}px`;
      e.lensEl.style.width = `${box.w * bgW}px`;
      e.lensEl.style.height = `${box.h * bgH}px`;
    }
  }

  /** 停留倒數結束時讓鳥淡出、回來時淡入（左側與鏡頭內同步） */
  setBirdVisible(bird, visible) {
    const e = this.els.find((x) => x.bird === bird);
    if (!e) return;
    e.eyeEl.classList.toggle('gone', !visible);
    e.lensEl.classList.toggle('gone', !visible);
  }

  /** 右側面板的停留倒數條 */
  setStay(focus, info) {
    const box = $('stay');
    if (!focus) { box.hidden = true; return; }
    box.hidden = false;
    $('stayName').textContent = info.displayName;
    $('stayAct').textContent = focus.bird.behavior || '';
    $('stayTime').textContent = t("{0} 秒", [Math.max(0, focus.remain).toFixed(1)]);
    const pct = Math.max(0, focus.remain) / focus.total;
    const bar = $('stayBar');
    bar.style.width = `${pct * 100}%`;
    bar.classList.toggle('urgent', pct < 0.35);
  }

  setHud({ level, camera, found, required, canSwap }) {
    const c = camera;
    $('hudTop').innerHTML =
      t("<div>第 {0} 關 · {1}</div>", [level.id, level.title]) +
      t("<div style=\"font-weight:600;opacity:.85\">已記錄 {0} / {1} 種</div>", [found, required]);
    $('hudHint').textContent = level.intro || '';
    $('rDevice').innerHTML = DEVICES[c.device].name + (canSwap ? t("<small> · 1+7 換裝置</small>") : '');
    $('rZoom').textContent = `${fmt(c.zoom)}X`;
    const digital = isDigital(c.device, c.zoom);
    $('rRes').textContent = `${zoomLabel(c.device, c.zoom)}｜${digital ? t("低解析") : t("高解析")}`;
    $('rRes').style.color = digital ? 'var(--danger)' : 'var(--green)';
    $('rProgress').textContent = t("{0} / {1} 種", [found, required]);
    const g = c.gridPos();
    $('rXY').textContent = t("格點 {0},{1} / 20", [g.gx, g.gy]);
  }

  flash() {
    const f = $('flash');
    f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }
}

function makeBird(url, b, aspect, where) {
  const el = document.createElement('div');
  el.className = 'bird' + (b.art === 'cutout' ? ' cutout' : '') + (b.flip ? ' flip' : '');
  el.title = birdInfo(b.species).displayName;
  if (url) {
    const img = document.createElement('img');
    img.src = url; img.alt = '';
    el.appendChild(img);
  } else {
    el.classList.add('missing');
  }
  if (where === 'eye') {
    const box = birdBox(b, aspect);
    el.style.left = `${box.x0 * 100}%`;
    el.style.top = `${box.y0 * 100}%`;
    el.style.width = `${box.w * 100}%`;
    el.style.height = `${box.h * 100}%`;
  }
  return el;
}
