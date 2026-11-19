"""Build-time translation of public game strings; never called by the game.

Uses a resumable cache. HTML and numbered interpolation tokens are checked before
acceptance. Editorial corrections are maintained separately in overrides.json.
No save data, microphone data, credentials or source expressions are sent.
"""
from pathlib import Path
import concurrent.futures, html, json, re, time, urllib.parse, urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data/locales'
sources = json.loads((OUT/'source.json').read_text(encoding='utf-8'))
MARKER = re.compile(r'ZXQ\s*(\d+)\s*XZ', re.I)

def protect(source):
    tags = []
    def replace(match):
        tags.append(match.group()); return f' BVHTML{len(tags)-1}TOKEN '
    return re.sub(r'<[^>]*>', replace, source), tags

def restore(text, tags):
    text = re.sub(r'\{\s*(\d+)\s*\}', r'{\1}', text)
    for i, tag in enumerate(tags):
        pattern = rf'\s*BVHTML\s*{i}\s*TOKEN\s*'
        if not re.search(pattern, text, re.I): raise ValueError('Missing HTML token')
        text = re.sub(pattern, lambda _:tag, text, flags=re.I)
    if '<' in re.sub(r'<[^>]*>', '', text): raise ValueError('Unexpected markup')
    return text

def translate_batch(language, batch):
    prepared = [protect(source) for source in batch]
    query = '\n'.join(f'ZXQ{i:04d}XZ {text}' for i,(text,_) in enumerate(prepared))
    url = 'https://translate.googleapis.com/translate_a/single?' + urllib.parse.urlencode(
        dict(client='gtx', sl='zh-TW', tl=language, dt='t', q=query))
    last = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent':'BirdViewLocalization/1.0'})
            with urllib.request.urlopen(request, timeout=40) as response: result = json.load(response)
            text = ''.join(piece[0] or '' for piece in result[0])
            markers = list(MARKER.finditer(text))
            if len(markers) != len(batch): raise ValueError('Translation marker count changed')
            translated = {}
            for i, marker in enumerate(markers):
                index = int(marker.group(1))
                if index != i: raise ValueError('Translation marker order changed')
                value = text[marker.end():markers[i+1].start() if i+1<len(markers) else len(text)].strip()
                value = restore(value, prepared[i][1])
                if sorted(re.findall(r'\{\d+\}', value)) != sorted(re.findall(r'\{\d+\}', batch[i])):
                    raise ValueError('Interpolation placeholders changed')
                if re.findall(r'<[^>]*>', value) != re.findall(r'<[^>]*>', batch[i]):
                    raise ValueError('HTML structure changed')
                if not value: raise ValueError('Empty translation')
                translated[batch[i]] = value
            return language, translated, None
        except Exception as exc:
            last = exc
            if attempt < 2: time.sleep(1+attempt)
    if len(batch)>1:
        values = {}; errors=[]
        for source in batch:
            _, partial, error = translate_batch(language, [source]); values.update(partial)
            if error: errors.append(error)
        return language, values, '; '.join(errors) if errors else None
    return language, {}, f'{language}: {batch[0][:55]}: {last}'

def batches(items):
    current=[]; size=0
    for item in items:
        count=len(urllib.parse.quote(protect(item)[0]))+30
        if current and size+count>6500:
            yield current;current=[];size=0
        current.append(item);size+=count
    if current: yield current

if __name__=='__main__':
    catalogs={};jobs=[];errors=[]
    for language in ['en','ja','ko']:
        cache=OUT/(language+'.json')
        catalogs[language]=json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else {}
        for batch in batches([s for s in sources if s not in catalogs[language]]):jobs.append((language,batch))
    print(f'Translating {len(jobs)} batches for {len(sources)} source strings.',flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        pending=[pool.submit(translate_batch,*job) for job in jobs]
        for i,future in enumerate(concurrent.futures.as_completed(pending)):
            language,translated,error=future.result();catalogs[language].update(translated)
            (OUT/(language+'.json')).write_text(json.dumps(catalogs[language],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            if error:errors.append(error)
            if (i+1)%10==0 or error:print(f'{i+1}/{len(jobs)} batches; '+', '.join(f'{k}: {len(v)}' for k,v in catalogs.items())+(f'; {error}' if error else ''),flush=True)
    (OUT/'translation-status.json').write_text(json.dumps(dict(sourceCount=len(sources),counts={k:len(v) for k,v in catalogs.items()},errors=errors),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Translation pass complete.',flush=True)
    raise SystemExit(bool(errors))
