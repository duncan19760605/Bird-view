// One-time migration helper. Acorn is a build-only parser in build/i18n-tools.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),acorn=require('../build/i18n-tools/acorn.cjs');
const keys=new Set(),hasHan=s=>/[\u3400-\u9fff]/u.test(s);
const files=['main','ui','dex','render','device','audio-core','audio-receiver','audio-setup'];
function children(n){return Object.entries(n).filter(([k])=>!['start','end','loc'].includes(k)).flatMap(([,v])=>Array.isArray(v)?v.filter(x=>x&&typeof x.type==='string'):v&&typeof v.type==='string'?[v]:[]).sort((a,b)=>a.start-b.start);}
function rewrite(n,s){
  if(n.type==='Literal'&&typeof n.value==='string'&&hasHan(n.value)){
    keys.add(n.value);return `t(${JSON.stringify(n.value)})`;
  }
  if(n.type==='TemplateLiteral'&&n.quasis.some(q=>hasHan(q.value.cooked||''))){
    const key=n.quasis.map((q,i)=>(q.value.cooked||'')+(i<n.expressions.length?`{${i}}`:'' )).join('');
    keys.add(key);return `t(${JSON.stringify(key)}${n.expressions.length?', ['+n.expressions.map(e=>rewrite(e,s)).join(', ')+']':''})`;
  }
  let cursor=n.start,out='';
  for(const c of children(n)){if(c.start<cursor)continue;out+=s.slice(cursor,c.start)+rewrite(c,s);cursor=c.end;}
  return out+s.slice(cursor,n.end);
}
for(const name of files){
  const file=path.join(root,'js',name+'.js'),s=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
  if(s.includes("from './i18n.js'"))throw new Error('Migration already applied: '+name);
  const tree=acorn.parse(s,{ecmaVersion:'latest',sourceType:'module'});
  const output="import { t } from './i18n.js';\n"+rewrite(tree,s);
  acorn.parse(output,{ecmaVersion:'latest',sourceType:'module'});fs.writeFileSync(file,output);
}
const birds=JSON.parse(fs.readFileSync(path.join(root,'data/birds.json'),'utf8'));
for(const bird of Object.values(birds))for(const k of ['zh','length','size','habitat','note'])if(bird[k]&&hasHan(bird[k]))keys.add(bird[k]);
for(const f of fs.readdirSync(path.join(root,'data/levels'))){
  if(!f.endsWith('.json'))continue;const l=JSON.parse(fs.readFileSync(path.join(root,'data/levels',f),'utf8'));
  for(const k of ['title','subtitle','intro','rewardText'])if(l[k]&&hasHan(l[k]))keys.add(l[k]);
  for(const b of l.birds)if(b.behavior)keys.add(b.behavior);
}
fs.mkdirSync(path.join(root,'data/locales'),{recursive:true});
fs.writeFileSync(path.join(root,'data/locales/source.json'),JSON.stringify([...keys],null,2)+'\n');
console.log('Extracted',keys.size,'source keys.');
