/** Offline, species-matched field recordings. Credits: assets/bird-calls/manifest.json. */
import { loadLevel } from './level.js';
let manifestPromise;
const buffers = new Map(), playing = new Set();
const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
};
export async function callsForLevel(level) {
  if (!manifestPromise) manifestPromise = getJson('assets/bird-calls/manifest.json').catch(e => { manifestPromise = null; throw e; });
  const [manifest, data] = await Promise.all([manifestPromise, loadLevel(level)]);
  const species = new Set(data.birds.map(b => b.species));
  return manifest.clips.filter(c => species.has(c.species));
}
export function stopBirdCalls() {
  for (const source of playing) { try { source.stop(); } catch {} }
  playing.clear();
}
/** Returns seconds scheduled; 0 means cancelled. Throws on loading/decoding failure. */
export async function playBirdCall(ctx, bus, level, isCurrent) {
  const calls = await callsForLevel(level);
  if (!calls.length) throw new Error(`No bird recording for level ${level}`);
  const clip = calls[Math.floor(Math.random() * calls.length)];
  if (!buffers.has(clip.file)) {
    const pending = fetch(clip.file).then(r => {
      if (!r.ok) throw new Error(`${clip.file}: ${r.status}`);
      return r.arrayBuffer();
    }).then(bytes => ctx.decodeAudioData(bytes)).catch(e => { buffers.delete(clip.file); throw e; });
    buffers.set(clip.file, pending);
  }
  const buffer = await buffers.get(clip.file);
  if (!isCurrent()) return 0; // Loading may finish after exit, mute, or a level change.
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 12000; filter.Q.value = .707;
  const at = ctx.currentTime + .03, duration = Math.min(12, buffer.duration);
  gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.7, at + Math.min(.12, duration / 4));
  gain.gain.setValueAtTime(.7, at + Math.max(duration / 2, duration - .3)); gain.gain.linearRampToValueAtTime(0, at + duration);
  source.connect(filter).connect(gain).connect(bus); playing.add(source);
  source.onended = () => { playing.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.start(at, 0, duration);
  return duration + .03;
}
