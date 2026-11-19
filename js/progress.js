const KEY = 'bird-view.progress.v1';

const empty = () => ({
  dex: {},          // species -> 最佳的一張照片 { resolution, at, levelId, zoom, device, view, scene, style, ... }
  captures: {},     // levelId -> [species...]：每關各自拍到哪些鳥（跨關重複的鳥種各關分開算）
  landscapes: [],   // { at, levelId, cx, cy, zoom, device, resolution, view, scene, style }
  playDates: {},    // levelId -> ["YYYY-MM-DD", ...]
  scope: false,     // 是否已獲得單筒望遠鏡
  style: 'realistic',
});

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = Object.assign(empty(), JSON.parse(raw));
    // 舊存檔沒有 captures：由圖鑑紀錄的 levelId 重建
    if (!JSON.parse(raw).captures) {
      for (const [s, rec] of Object.entries(d.dex)) {
        const arr = (d.captures[rec.levelId] ||= []);
        if (!arr.includes(s)) arr.push(s);
      }
    }
    return d;
  } catch { return empty(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export const P = {
  get all() { return data; },
  get style() { return data.style; },
  setStyle(s) { data.style = s; save(); },
  get hasScope() { return data.scope; },
  grantScope() { data.scope = true; save(); },

  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  recordPlay(levelId) {
    const t = this.todayStr();
    const arr = (data.playDates[levelId] ||= []);
    if (!arr.includes(t)) { arr.push(t); arr.sort(); save(); }
  },

  playDates(levelId) { return data.playDates[levelId] || []; },

  /** 是否有「連續 n 天」的遊玩紀錄 */
  hasConsecutiveDays(levelId, n) {
    const dates = this.playDates(levelId);
    if (dates.length < n) return false;
    let run = 1;
    for (let i = 1; i < dates.length; i++) {
      run = isNextDay(dates[i - 1], dates[i]) ? run + 1 : 1;
      if (run >= n) return true;
    }
    return n <= 1;
  },

  /** 該關已記錄的鳥種 */
  speciesInLevel(levelId) {
    return data.captures[levelId] || [];
  },

  dexEntry(s) { return data.dex[s] || null; },
  get dexAll() { return data.dex; },
  get landscapes() { return data.landscapes; },

  /**
   * 記錄一張鳥照：
   *  - 該關的鳥種清單一律加入（第 1 關拍過的麻雀，在第 2 關再拍也算第 2 關的一種）
   *  - 圖鑑照片只在「新種」或「畫質升級（數位 → 光學）」時覆寫
   */
  addBird(species, shot, levelId, scene, style) {
    const prev = data.dex[species];
    const rec = { ...shot, levelId, scene, style };
    const better = !prev || (prev.resolution === 'low' && rec.resolution === 'high');
    if (better) data.dex[species] = rec;
    const inLevel = (data.captures[levelId] ||= []);
    const newInLevel = !inLevel.includes(species);
    if (newInLevel) inLevel.push(species);
    save();
    return { isNew: !prev, upgraded: !!prev && better, newInLevel };
  },

  addLandscape(shot, levelId, scene, style) {
    data.landscapes.unshift({ ...shot, levelId, scene, style });
    data.landscapes = data.landscapes.slice(0, 60);
    save();
  },

  /** 關卡是否已通過（達標 or 連續 3 天） */
  isCleared(level) {
    const byCount = this.speciesInLevel(level.id).length >= level.requiredSpecies;
    const byDays = this.hasConsecutiveDays(level.id, level.consecutiveDaysUnlock || 3);
    return { cleared: byCount || byDays, byCount, byDays };
  },

  isUnlocked(level, levels) {
    if (level.id === 1) return true;
    const prev = levels.find((l) => l.id === level.id - 1);
    if (!prev) return false;
    return this.isCleared(prev).cleared;
  },

  reset() { data = empty(); save(); },
};

function isNextDay(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000) === 1;
}
