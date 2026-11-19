import { DEVICES, fovOf, stepOf, nextZoom, clamp } from './device.js';

/** 視野游標：位置、倍率、裝置 */
export class Camera {
  constructor({ aspect = 4 / 3, device = 'phone', zoomMode = 'stepped' } = {}) {
    this.aspect = aspect;
    this.device = device;
    this.zoomMode = zoomMode;
    this.zoom = DEVICES[device].min;
    this.cx = 0.5;
    this.cy = 0.5;
  }
  get fov() { return fovOf(this.zoom, this.aspect); }
  get minZoom() { return DEVICES[this.device].min; }

  step(axis) {
    const f = this.fov;
    return stepOf(this.zoom, axis === 'x' ? f.w : f.h, this.minZoom);
  }

  move(dx, dy) {
    if (dx) this.cx += dx * this.step('x');
    if (dy) this.cy += dy * this.step('y');
    this.clampPos();
  }

  setZoom(dir) {
    const before = this.zoom;
    this.zoom = nextZoom(this.device, this.zoom, dir, this.zoomMode);
    if (this.zoom !== before) this.clampPos();
    return this.zoom !== before;
  }

  setDevice(key) {
    this.device = key;
    this.zoom = DEVICES[key].min;
    this.clampPos();
  }

  clampPos() {
    const f = this.fov;
    const hw = Math.min(f.w, 1) / 2;
    const hh = Math.min(f.h, 1) / 2;
    this.cx = clamp(this.cx, hw, 1 - hw);
    this.cy = clamp(this.cy, hh, 1 - hh);
  }

  /** 目前視野矩形（正規化） */
  rect() {
    const f = this.fov;
    return { x0: this.cx - f.w / 2, y0: this.cy - f.h / 2, x1: this.cx + f.w / 2, y1: this.cy + f.h / 2 };
  }

  /** 目前在 20x20 格點上的大約位置，給操作提示用 */
  gridPos() {
    const f = this.fov;
    const gx = (1 - f.w) <= 0 ? 0 : Math.round((this.cx - f.w / 2) / ((1 - f.w) / 20));
    const gy = (1 - f.h) <= 0 ? 0 : Math.round((this.cy - f.h / 2) / ((1 - f.h) / 20));
    return { gx, gy };
  }
}
