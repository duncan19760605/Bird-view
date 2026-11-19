import { CONFIG } from './config.js';
import { birdsInView, birdBox } from './capture.js';

/**
 * 停留倒數（第 2 關起）：只對關卡 JSON 中有 `stay`（秒）的鳥生效。
 *
 *   idle ──被視野涵蓋且放大到夠大──▶ watched（倒數 stay 秒，移開視野也不暫停）
 *   「夠大」= 鳥寬 / 視野寬 ≥ CONFIG.STAY_TRIGGER，所以 1X 廣角掃視不會驚動鳥
 *   watched ──時間到──▶ gone（淡出、不能拍）
 *   gone ──過 RETURN_AFTER 秒──▶ idle（回到原位，倒數補滿）
 */
export class Presence {
  constructor(level, camera, { onVisible, onLeave, onReturn, onFocus, isPaused }) {
    this.level = level;
    this.camera = camera;
    this.cb = { onVisible, onLeave, onReturn, onFocus, isPaused };
    this.state = new Map();
    for (const b of level.birds) {
      if (b.stay > 0) this.state.set(b, { phase: 'idle', remain: b.stay, back: 0 });
    }
    this.active = this.state.size > 0;
    this.last = performance.now();
    if (this.active) this.timer = setInterval(() => this.tick(), 100);
  }

  destroy() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /** 目前還在場上的鳥（給拍照判定用） */
  visibleBirds() {
    return this.level.birds.filter((b) => this.state.get(b)?.phase !== 'gone');
  }

  /** 鳥在鏡頭中是否大到算「正在觀察」 */
  observed(b) {
    return birdBox(b, this.camera.aspect).w / this.camera.fov.w >= CONFIG.STAY_TRIGGER;
  }

  tick() {
    const now = performance.now();
    const dt = Math.min(0.5, (now - this.last) / 1000);
    this.last = now;
    if (this.cb.isPaused?.()) return;

    const view = this.camera.rect();
    const inView = new Set(birdsInView(this.visibleBirds(), view, this.camera.aspect));

    for (const [b, s] of this.state) {
      if (s.phase === 'idle' && inView.has(b) && this.observed(b)) {
        s.phase = 'watched';
        s.remain = b.stay;
      }
      if (s.phase === 'watched') {
        s.remain -= dt;
        if (s.remain <= 0) {
          s.phase = 'gone';
          s.back = CONFIG.RETURN_AFTER;
          this.cb.onVisible(b, false);
          this.cb.onLeave(b);
        }
      } else if (s.phase === 'gone') {
        s.back -= dt;
        if (s.back <= 0) {
          s.phase = 'idle';
          s.remain = b.stay;
          this.cb.onVisible(b, true);
          this.cb.onReturn?.(b);
        }
      }
    }

    // 面板顯示：視野中倒數最急的那隻
    let focus = null;
    for (const b of inView) {
      const s = this.state.get(b);
      if (s?.phase === 'watched' && (!focus || s.remain < focus.remain)) {
        focus = { bird: b, remain: s.remain, total: b.stay };
      }
    }
    this.cb.onFocus(focus);
  }
}
