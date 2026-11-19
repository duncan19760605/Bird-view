"""Resolve local bird names through scientific-name Wikipedia/Wikidata links."""
from pathlib import Path
import json, urllib.parse, urllib.request

ROOT = Path(__file__).resolve().parent.parent
birds=json.loads((ROOT/'data/birds.json').read_text(encoding='utf-8'))
def request(base, **params):
    url=base+'?'+urllib.parse.urlencode(dict(format='json',**params))
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BirdViewLocalization/1.0'}),timeout=35) as r:
        return json.load(r)

records={};names=list(birds)
for offset in range(0,len(names),40):
    group=names[offset:offset+40]
    data=request('https://en.wikipedia.org/w/api.php',action='query',prop='pageprops',redirects=1,titles='|'.join(birds[k]['sci'] for k in group))
    query=data['query'];aliases={r['from']:r['to'] for r in query.get('redirects',[])}
    aliases.update({r['from']:r['to'] for r in query.get('normalized',[])})
    pages={p['title']:p for p in query['pages'].values()}
    for key in group:
        title=birds[key]['sci'];seen=set()
        while title in aliases and title not in seen:seen.add(title);title=aliases[title]
        page=pages.get(title,{})
        records[key]=dict(scientificName=birds[key]['sci'],englishName=birds[key]['en'],wikiTitle=title,
            sourcePage='https://en.wikipedia.org/wiki/'+urllib.parse.quote(title.replace(' ','_')),
            wikidata=page.get('pageprops',{}).get('wikibase_item'),labels={})
    print('Resolved',offset+len(group),'scientific names',flush=True)
ids=list(dict.fromkeys(r['wikidata'] for r in records.values() if r['wikidata']))
for offset in range(0,len(ids),40):
    data=request('https://www.wikidata.org/w/api.php',action='wbgetentities',props='labels',languages='ja|ko|zh-cn',ids='|'.join(ids[offset:offset+40]))
    for record in records.values():
        if record['wikidata'] in data['entities']:
            record['labels']={lang:v['value'] for lang,v in data['entities'][record['wikidata']].get('labels',{}).items()}
target=ROOT/'data/locales/bird-name-sources.json'
target.write_text(json.dumps(dict(retrieved='2026-11-07',source='Wikipedia scientific-name redirects and Wikidata labels; labels are CC0',birds=records),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Recorded names:',{lang:sum(lang in r['labels'] for r in records.values()) for lang in ['ja','ko','zh-cn']})
