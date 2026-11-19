import json,urllib.request,pathlib,subprocess,re,html,hashlib
root=pathlib.Path(__file__).resolve().parent.parent; dest=root/'assets/bird-calls'; dest.mkdir(exist_ok=True)
mapping={'Passer montanus.ogg':'eurasian-tree-sparrow','Pycnonotus sinensis - Light-vented Bulbul XC258975.mp3':'light-vented-bulbul','Black-winged stilt (Himantopus himantopus himantopus).ogg':'black-winged-stilt','Periparus ater.ogg':'coal-tit','\u6591\u9d3f\u54a7\u53eb\u7684\u8072.ogg':'spotted-dove'}
raw=json.loads((root/'tools/audio-source-metadata.json').read_text(encoding='utf-8')); birds=json.loads((root/'data/birds.json').read_text(encoding='utf-8')); clips=[]
for page in raw['query']['pages'].values():
 title=page['title'][5:]; species=mapping[title]; info=page['imageinfo'][0]; meta=info['extmetadata']; url=info['url']; original=dest/(species+'.source'+pathlib.Path(title).suffix)
 if not original.exists():
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 BirdView/1.0'}),timeout=45) as response: original.write_bytes(response.read())
 wav=dest/(species+'.wav')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(original),'-t','12','-ac','1','-ar','32000','-af','lowpass=f=12000:p=2,lowpass=f=12000:p=2,highpass=f=100,loudnorm=I=-23:TP=-3:LRA=7,afade=t=in:d=0.12','-c:a','pcm_s16le',str(wav)],check=True)
 def clean(key): return html.unescape(re.sub('<[^>]+>','',meta.get(key,{}).get('value','')))
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(wav)]))
 clips.append(dict(species=species,zh=birds[species]['zh'],en=birds[species]['en'],sci=birds[species]['sci'],file='assets/bird-calls/'+wav.name,duration=duration,title=title,author=clean('Artist'),license=clean('LicenseShortName'),licenseUrl=clean('LicenseUrl'),sourcePage=info['descriptionurl'],downloadUrl=url,description=clean('ImageDescription'),retrieved='2026-10-11',originalSha256=hashlib.sha256(original.read_bytes()).hexdigest(),sha256=hashlib.sha256(wav.read_bytes()).hexdigest(),changes='First up to 12 seconds; mono PCM WAV at 32 kHz; cascaded 12 kHz low-pass, 100 Hz high-pass, loudness normalization (-23 LUFS), 120 ms fade-in. Same CC BY-SA license as source. Playback also uses a 12 kHz low-pass and fade-out.'))
manifest=dict(schemaVersion=1,note='Species-matched ambience; regional examples, not verified Taiwan-subspecies identification references.',clips=clips)
(dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(dest/'source-metadata.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2),encoding='utf-8')
print('Prepared',len(clips),'clips',sum((dest/pathlib.Path(c['file']).name).stat().st_size for c in clips),'bytes')
