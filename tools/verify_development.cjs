// Real Electron UI checks, using an isolated profile and a loopback-only server.
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), http = require('http');
const root=path.resolve(__dirname,'..'), out=path.join(root,'docs','verification');
fs.mkdirSync(out,{recursive:true});
app.setPath('userData',path.join(out,'ui-profile'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[],check=(name,ok,extra={})=>results.push({name,ok:!!ok,...extra});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  let target=file;try{if(fs.statSync(target).isDirectory())target=path.join(target,'index.html');}catch{}
  const mime={'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.wav':'audio/wav'};
  fs.readFile(target,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(e?'Missing':data);});
});
async function until(win,expression){for(let n=0;n<80;n++){if(await win.webContents.executeJavaScript(expression))return true;await sleep(100);}return false;}
async function key(win,k){win.webContents.sendInputEvent({type:'keyDown',keyCode:k});win.webContents.sendInputEvent({type:'keyUp',keyCode:k});await sleep(100);}
app.whenReady().then(async()=>{
  let win;
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const port=server.address().port;
    win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{contextIsolation:true,sandbox:true,backgroundThrottling:false}});
    const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
    await win.loadFile(path.join(root,'bird-view-development.html'));
    check('offline Mermaid 3 diagrams',await until(win,`document.querySelectorAll('.mermaid svg').length===3`));
    check('default Traditional Chinese',await win.webContents.executeJavaScript(`document.documentElement.lang==='zh-Hant'&&getComputedStyle(document.querySelector('h1 .en')).display==='none'`));
    fs.writeFileSync(path.join(out,'development-zh.png'),(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`document.querySelector('[data-lang="en"]').click()`);
    check('English switch rerenders diagrams',await until(win,`document.documentElement.lang==='en'&&document.querySelectorAll('.mermaid svg').length===3&&document.querySelector('#flow').textContent.includes('Keyboard')`));
    check('English hides Chinese text',await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('h1 .zh')).display==='none'`));
    fs.writeFileSync(path.join(out,'development-en.png'),(await win.webContents.capturePage()).toPNG());
    const reloaded=new Promise(r=>win.webContents.once('did-finish-load',r));win.reload();await reloaded;
    check('language preference persists',await until(win,`document.documentElement.lang==='en'&&document.querySelectorAll('.mermaid svg').length===3`));
    win.setSize(430,900);await sleep(200);
    check('mobile has no page overflow',await win.webContents.executeJavaScript(`document.documentElement.scrollWidth<=innerWidth`));
    await win.webContents.executeJavaScript(`document.querySelector('[data-lang="zh"]').click()`);
    await until(win,`document.documentElement.lang==='zh-Hant'&&document.querySelectorAll('.mermaid svg').length===3&&document.querySelector('#flow').textContent.includes('鍵盤')`);
    await sleep(150);
    fs.writeFileSync(path.join(out,'development-mobile.png'),(await win.webContents.capturePage()).toPNG());
    win.setSize(1440,1000);await win.webContents.executeJavaScript(`document.documentElement.style.scrollBehavior='auto';document.getElementById('architecture').scrollIntoView({behavior:'instant'})`);await sleep(400);
    fs.writeFileSync(path.join(out,'development-architecture.png'),(await win.webContents.capturePage()).toPNG());
    win.setSize(1100,900);
    await win.loadURL(`http://127.0.0.1:${port}/MotionPad-STEM-Agent/examples/stem-observer/`);
    await win.webContents.executeJavaScript(`localStorage.removeItem('stem-observer.collection')`);
    const demoLoaded=new Promise(r=>win.webContents.once('did-finish-load',r));win.reload();await demoLoaded;
    check('portable demo renders both views',await until(win,`document.querySelectorAll('#world circle,#lens circle').length===2`));
    const before=await win.webContents.executeJavaScript(`document.getElementById('hud').textContent`);
    await key(win,'9');check('single target capture collects square',await win.webContents.executeJavaScript(`document.getElementById('collection').textContent.includes('square')`));
    await key(win,'4');check('keyboard moves camera',before!==await win.webContents.executeJavaScript(`document.getElementById('hud').textContent`));
    await key(win,'7');await sleep(350);check('zoom uses buffered input',await win.webContents.executeJavaScript(`document.getElementById('hud').textContent.includes('2X')`));
    win.webContents.sendInputEvent({type:'keyDown',keyCode:'1'});win.webContents.sendInputEvent({type:'keyDown',keyCode:'7'});
    win.webContents.sendInputEvent({type:'keyUp',keyCode:'7'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'1'});await sleep(350);
    check('1+7 chord switches to scope',await win.webContents.executeJavaScript(`document.getElementById('hud').textContent.includes('scope')&&document.getElementById('hud').textContent.includes('10X')`));
    await key(win,'3');check('foot-compatible exit',await win.webContents.executeJavaScript(`document.getElementById('message').textContent.includes('Exited')`));
    await key(win,'9');check('9 restarts from menu',await win.webContents.executeJavaScript(`document.getElementById('message').textContent.includes('Started')`));
    check('portable protocol resolves',await win.webContents.executeJavaScript(`fetch('audio-protocol/protocol.json').then(r=>r.json()).then(j=>j.keys['5']===null)`));
    await key(win,'1');await key(win,'7');await sleep(350);
    await win.webContents.executeJavaScript(`document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,0)`);await sleep(300);
    fs.writeFileSync(path.join(out,'stem-demo.png'),(await win.webContents.capturePage()).toPNG());
    check('no renderer console errors',errors.length===0,{errors});
  }catch(e){check('unexpected UI error',false,{error:String(e.stack||e)});}
  finally{
    const result={ok:results.every(r=>r.ok),checks:results,physicalHardware:'UNTESTED'};
    fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
    if(win)win.destroy();server.close();app.exit(result.ok?0:1);
  }
});
