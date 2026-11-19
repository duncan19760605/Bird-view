import { resolveImage, resetFallbackFlag, usedPencilFallback, missing } from './assets.js';
import { t } from './i18n.js';

let birdDb = null;
const levelCache = new Map();

export async function loadBirdDb() {
  if (!birdDb) {
    const raw = await fetch('data/birds.json', { cache: 'no-cache' }).then((r) => r.json());
    birdDb = Object.fromEntries(Object.entries(raw).map(([id, bird]) => [id, {
      ...bird, displayName: t(bird.zh), length: t(bird.length), size: t(bird.size),
      habitat: t(bird.habitat), note: t(bird.note),
    }]));
  }
  return birdDb;
}
export const birds = () => birdDb || {};
export const birdInfo = (species) => (birdDb && birdDb[species]) || { zh: species, displayName: species, en: species, sci: '' };

export async function loadLevel(id) {
  const k = String(id);
  if (!levelCache.has(k)) {
    levelCache.set(k, fetch(`data/levels/level${String(id).padStart(2, '0')}.json`, { cache: 'no-cache' }).then((r) => r.json()).then(level => ({
      ...level, title: t(level.title), subtitle: t(level.subtitle), intro: t(level.intro), rewardText: t(level.rewardText),
      birds: level.birds.map(bird => ({ ...bird, behavior: t(bird.behavior) })),
    })));
  }
  return levelCache.get(k);
}

export async function loadAllLevels() {
  const ids = Array.from({ length: 10 }, (_, i) => i + 1);
  return Promise.all(ids.map(loadLevel));
}

/** 載入關卡所需的圖片，回傳可直接用的 URL 與場景比例 */
export async function prepareLevel(level, style) {
  resetFallbackFlag();
  await loadBirdDb();
  const scene = await resolveImage(level.scene, style);
  const birdUrls = {};
  for (const b of level.birds) {
    const r = await resolveImage(`${level.birdDir || 'birds'}/${b.species}.png`, style);
    birdUrls[b.species] = r ? r.url : null;
    b.ar = r ? r.h / r.w : 1;
  }
  if (missing.size) console.warn('[走，賞鳥趣] 缺少素材：', [...missing]);
  return {
    sceneUrl: scene ? scene.url : null,
    aspect: scene ? scene.w / scene.h : 4 / 3,
    birdUrls,
    pencilFallback: usedPencilFallback(),
  };
}
