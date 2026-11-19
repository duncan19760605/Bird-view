// Executes in the real Electron renderer. No physical-mat acceptance claims.
(async () => {
  const log=[], check=(name,ok,extra={})=>log.push({name,ok:!!ok,...extra});
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async fn=>{for(let i=0;i<80;i++){if(fn())return true;await sleep(50);}return false;};
  const originalFetch=window.fetch.bind(window), key='bird-view.sound.v1', before=localStorage.getItem(key);
  const proto=AudioContext.prototype, create=proto.createBufferSource, oscillator=proto.createOscillator;
  const started=[],stopped=[];let oscillators=0;
  proto.createBufferSource=function(){const s=create.call(this),start=s.start.bind(s),stop=s.stop.bind(s);
    s.start=(...args)=>{started.push(s);return start(...args);};s.stop=(...args)=>{stopped.push(s);return stop(...args);};return s;};
  proto.createOscillator=function(){oscillators++;return oscillator.call(this);};
  const sound=await import('./js/soundscape.js'), calls=await import('./js/bird-calls.js');
  const previousPrefs=sound.soundPrefs();let decodeContext;
  try{
    sound.setVolume('music',0);sound.setVolume('nature',60);
    const manifest=await originalFetch('assets/bird-calls/manifest.json').then(r=>r.json());
    decodeContext=new AudioContext();
    for(const clip of manifest.clips){
      const buffer=await decodeContext.decodeAudioData(await originalFetch(clip.file).then(r=>r.arrayBuffer()));
      check('decode '+clip.species,buffer.numberOfChannels===1&&buffer.sampleRate===decodeContext.sampleRate&&buffer.duration>0&&buffer.duration<=12.01,{duration:buffer.duration});
    }
    for(let id=1;id<=10;id++){
      const level=await originalFetch(`data/levels/level${String(id).padStart(2,'0')}.json`).then(r=>r.json());
      const eligible=await calls.callsForLevel(id),species=new Set(level.birds.map(b=>b.species));
      check('species coverage level '+id,eligible.length>0&&eligible.every(c=>species.has(c.species)));
    }
    let release,intercepted=false;
    const gate=new Promise(r=>release=r);
    window.fetch=async(url,...args)=>{if(String(url).startsWith('assets/bird-calls/')&&String(url).endsWith('.wav')){intercepted=true;await gate;}return originalFetch(url,...args);};
    sound.enterSoundscape(1);
    check('recording fetch started',await until(()=>intercepted));
    sound.leaveSoundscape();const count=started.length;release();await sleep(800);
    check('exit during loading prevents stale playback',started.length===count);
    window.fetch=originalFetch;
    sound.enterSoundscape(6);check('recording plays in forest level',await until(()=>started.length>count));
    const active=started.at(-1);sound.setVolume('nature',0);
    check('mute stops active recording',stopped.includes(active));
    sound.setVolume('nature',60);const beforeSwitch=started.length;
    sound.enterSoundscape(3);sound.enterSoundscape(8);
    check('rapid switch starts new level',await until(()=>started.length>beforeSwitch));
    await sleep(300);check('rapid switch has one new recording',started.length===beforeSwitch+1);
    const last=started.at(-1);sound.leaveSoundscape();check('leave stops recording',stopped.includes(last));
    const oscillatorBefore=oscillators;
    window.fetch=(url,...args)=>String(url).includes('black-winged-stilt.wav')?Promise.resolve(new Response('missing',{status:404})):originalFetch(url,...args);
    sound.enterSoundscape(3);
    check('missing file uses synthesized fallback',await until(()=>oscillators>oscillatorBefore));
    sound.leaveSoundscape();
  }catch(e){check('unexpected error',false,{error:String(e.stack||e)});}
  finally{
    window.fetch=originalFetch;proto.createBufferSource=create;proto.createOscillator=oscillator;
    sound.leaveSoundscape();sound.setVolume('music',previousPrefs.musicVol);sound.setVolume('nature',previousPrefs.natureVol);
    if(before===null)localStorage.removeItem(key);else localStorage.setItem(key,before);
    if(decodeContext)await decodeContext.close();
  }
  return {ok:log.every(x=>x.ok),checks:log,hardwareAcceptance:'UNTESTED'};
})()
