/** Offline MIDI, species-matched field recordings, and synthesized fallback ambience. */
import { playBirdCall, stopBirdCalls } from "./bird-calls.js";
let natureGeneration = 0;
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const STORE = 'bird-view.sound.v1';
let ctx, master, musicBus, natureBus, musicTimer, natureTimer, activeLevel = null;
// 音量 0–100；bus 增益 = 基準 ×(音量/60)²，聽感較接近線性。v0.4.6 起基準為 v0.3 的 3 倍（60% = 原音量 ×3）
const BASE = { music: .54, nature: .48 };
const DEFAULT_VOL = 60;
let prefs = load();

/** 舊版存的是 { music, nature } 開關：關 → 音量 0 */
function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch {}
  const vol = (v, on) => (Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : on === false ? 0 : DEFAULT_VOL);
  return { musicVol: vol(raw.musicVol, raw.music), natureVol: vol(raw.natureVol, raw.nature) };
}
function save() {
  // 保留舊欄位，讓 v0.3 讀到時仍能正確開關
  try { localStorage.setItem(STORE, JSON.stringify({ ...prefs, music: prefs.musicVol > 0, nature: prefs.natureVol > 0 })); } catch {}
}
const on = (kind) => prefs[`${kind}Vol`] > 0;
const gainOf = (kind) => (on(kind) ? BASE[kind] * (prefs[`${kind}Vol`] / DEFAULT_VOL) ** 2 : .0001);
function ensure() {
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    master = ctx.createGain(); master.gain.value = .42; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = gainOf('music'); musicBus.connect(master);
    natureBus = ctx.createGain(); natureBus.gain.value = gainOf('nature'); natureBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
export const soundPrefs = () => ({ ...prefs });
const busOf = (kind) => (kind === 'music' ? musicBus : natureBus);

/** 調整音量（0–100）。從 0 調回來時重新開始播放，調到 0 停止排程。 */
export function setVolume(kind, v) {
  const was = on(kind);
  prefs[`${kind}Vol`] = Math.max(0, Math.min(100, Math.round(+v || 0)));
  save();
  const bus = busOf(kind);
  if (bus && activeLevel) bus.gain.setTargetAtTime(gainOf(kind), ctx.currentTime, .03);
  if (was !== on(kind)) (kind === 'music' ? restartMusic : restartNature)();
}

/** 選單試聽（約 1 秒）：選單沒有背景聲音，調整音量時讓玩家聽到大小 */
export function previewSound(kind) {
  if (!on(kind) || !ensure()) return;
  const bus = busOf(kind);
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(gainOf(kind), ctx.currentTime);
  const t0 = ctx.currentTime + .03;
  if (kind === 'music') [72, 76, 79, 84].forEach((n, i) => tone(t0 + i * .16, .5, n, 100));
  else chirpBurst(t0, 1);
  // 不在關卡中時試聽完淡出
  if (!activeLevel) bus.gain.setTargetAtTime(.0001, t0 + 1.1, .08);
}
export function unlockAudio() { ensure(); }

function readVlq(a, p) { let n=0,b; do { b=a[p.i++]; n=(n<<7)|(b&127); } while (b&128); return n; }
function parseMidi(bytes) {
  const a=new Uint8Array(bytes),dv=new DataView(bytes),division=dv.getUint16(12);
  let i=14,tempo=500000,tick=0,status=0; const notes=[],open=new Map();
  if (String.fromCharCode(...a.slice(i,i+4))!=='MTrk') return {notes:[],duration:8};
  const end=i+8+dv.getUint32(i+4); i+=8;
  while(i<end){
    const p={i}; tick+=readVlq(a,p); i=p.i;
    if(a[i]>=128) status=a[i++];
    if(status===0xff){const type=a[i++],q={i},len=readVlq(a,q);i=q.i;if(type===0x51&&len===3)tempo=(a[i]<<16)|(a[i+1]<<8)|a[i+2];i+=len;continue;}
    const kind=status&0xf0;if(kind===0xc0||kind===0xd0){i++;continue;}
    const note=a[i++],vel=a[i++],key=`${status&15}:${note}`;
    if(kind===0x90&&vel)open.set(key,{tick,note,vel});else if(kind===0x80||kind===0x90){const n=open.get(key);if(n){notes.push({...n,end:tick});open.delete(key);}}
  }
  const s=tempo/1e6/division;
  return {notes:notes.map(n=>({t:n.tick*s,d:Math.max(.08,(n.end-n.tick)*s),note:n.note,vel:n.vel})),duration:Math.max(4,tick*s)};
}
function tone(at,duration,midi,velocity){
  const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
  o.type='triangle';o.frequency.value=440*2**((midi-69)/12);f.type='lowpass';f.frequency.value=1600;
  const peak=.032*velocity/127;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(peak,at+.035);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
  o.connect(f).connect(g).connect(musicBus);o.start(at);o.stop(at+duration+.03);
}
async function startMusic(level){
  clearTimeout(musicTimer);if(!on('music')||!level||!ensure())return;
  try{
    const midi=parseMidi(await fetch(`assets/music/level${String(level).padStart(2,'0')}.mid`).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();}));
    const schedule=()=>{if(!on('music')||activeLevel!==level)return;const t0=ctx.currentTime+.08;midi.notes.forEach(n=>tone(t0+n.t,n.d*.92,n.note,n.vel));musicTimer=setTimeout(schedule,Math.max(1000,midi.duration*1000));};schedule();
  }catch(e){console.warn('[BirdView] MIDI load failed',e);}
}

const HABITAT=[[1700,2500,.16],[1450,2300,.22],[1850,2900,.18],[1200,2050,.26],[950,1750,.30],[2100,3300,.20],[1350,2400,.25],[2350,3650,.17],[1550,2750,.23],[1050,1950,.29]];
function chirpBurst(now,level){
  const [lo,hi,spacing]=HABITAT[(level-1)%HABITAT.length],count=2+(level%3);
  for(let i=0;i<count;i++){const o=ctx.createOscillator(),g=ctx.createGain(),at=now+i*spacing;o.type=i%2?'sine':'triangle';o.frequency.setValueAtTime(lo+Math.random()*350,at);o.frequency.exponentialRampToValueAtTime(hi+Math.random()*500,at+.11);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.035,at+.025);g.gain.exponentialRampToValueAtTime(.0001,at+.18);o.connect(g).connect(natureBus);o.start(at);o.stop(at+.2);}
}
async function chirp(level, generation){
  const current = () => generation === natureGeneration && on('nature') && activeLevel === level;
  if(!current() || !ensure()) return;
  let duration = .8;
  try { duration = await playBirdCall(ctx, natureBus, level, current); }
  catch(e) { if(current()) { console.warn('[BirdView] Bird recording unavailable; using synthesis', e); chirpBurst(ctx.currentTime+.03,level); } }
  if(current()) natureTimer=setTimeout(()=>chirp(level,generation),duration*1000+2800+Math.random()*5200);
}
function restartNature(){
  clearTimeout(natureTimer); stopBirdCalls(); const generation=++natureGeneration;
  if(activeLevel&&on('nature')) { const level=activeLevel; natureTimer=setTimeout(()=>chirp(level,generation),500); }
}
function restartMusic(){clearTimeout(musicTimer);if(activeLevel)startMusic(activeLevel);}
export function enterSoundscape(level){activeLevel=level;if(!ensure())return;musicBus.gain.cancelScheduledValues(ctx.currentTime);natureBus.gain.cancelScheduledValues(ctx.currentTime);musicBus.gain.setTargetAtTime(gainOf('music'),ctx.currentTime,.03);natureBus.gain.setTargetAtTime(gainOf('nature'),ctx.currentTime,.03);restartMusic();restartNature();}
export function leaveSoundscape(){activeLevel=null; ++natureGeneration; stopBirdCalls();clearTimeout(musicTimer);clearTimeout(natureTimer);if(ctx){musicBus.gain.setTargetAtTime(.0001,ctx.currentTime,.03);natureBus.gain.setTargetAtTime(.0001,ctx.currentTime,.03);}}
