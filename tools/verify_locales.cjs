/** Exercise language settings and localized gameplay in a real Electron renderer. */
const {app,BrowserWindow,protocol,net,session}=require('electron');
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs','verification','locales');
fs.mkdirSync(out,{recursive:true});
app.setPath('userData',path.join(root,'build','i18n-verification-profile'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(name,ok,extra={})=>checks.push({name,ok:!!ok,...extra});
async function until(win,expr){for(let n=0;n<120;n++){if(await win.webContents.executeJavaScript(expr))return true;await wait(50);}return false;}
async function reload(win){const done=new Promise(r=>win.webContents.once('did-finish-load',r));win.reload();await done;await until(win,`document.querySelectorAll('.level-card').length===10`);}
async function key(win,keyCode){win.webContents.sendInputEvent({type:'keyDown',keyCode});win.webContents.sendInputEvent({type:'keyUp',keyCode});await wait(120);}
app.whenReady().then(async()=>{
  let win;const errors=[],remote=[],permissions=[];
  try{
    protocol.handle('app',request=>{
      const url=new URL(request.url),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
      if(!fs.existsSync(file))return new Response('Missing',{status:404});
      return net.fetch(pathToFileURL(file).toString());
    });
    session.defaultSession.setPermissionRequestHandler((_wc,p,cb)=>{permissions.push(p);cb(false);});
    session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
      if(/^https?:/.test(details.url))remote.push(details.url);callback({cancel:false});
    });
    win=new BrowserWindow({show:false,width:1600,height:900,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});
    win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
    await win.loadURL('app://birdview-locales/index.html');
    await until(win,`document.querySelectorAll('.level-card').length===10`);
    await win.webContents.executeJavaScript(`localStorage.clear()`);await reload(win);
    check('fresh install defaults to Traditional Chinese',await win.webContents.executeJavaScript(`document.documentElement.lang==='zh-Hant'`));
    await win.webContents.executeJavaScript(`(async()=>{
      const {P}=await import('./js/progress.js');
      P.addBird('eurasian-tree-sparrow',{at:1700000000000,device:'phone',zoom:1,resolution:'high',view:{x0:.2,y0:.2,x1:.5,y1:.5}},1,'assets/realistic/scenes/park.png','realistic');
      localStorage.setItem('bird-view.control','keyboard');
    })()`);
    const progress=await win.webContents.executeJavaScript(`localStorage.getItem('bird-view.progress.v1')`);
    for(const locale of ['zh-Hant','en','ja','zh-Hans','ko']){
      await win.webContents.executeJavaScript(`document.getElementById('btnSettings').click()`);
      check(`${locale}: settings offer all five native names`,await win.webContents.executeJavaScript(`document.querySelectorAll('[data-locale]').length===5&&!document.getElementById('screen-settings').hidden`));
      const current=await win.webContents.executeJavaScript(`document.documentElement.lang`);
      if(current!==locale){
        const loaded=new Promise(r=>win.webContents.once('did-finish-load',r));
        await win.webContents.executeJavaScript(`document.querySelector('[data-locale="${locale}"]').click()`);await loaded;
        await until(win,`document.querySelectorAll('.level-card').length===10`);
      }else await win.webContents.executeJavaScript(`document.querySelector('[data-locale="${locale}"]').click()`);
      check(`${locale}: applies and saves language`,await win.webContents.executeJavaScript(`document.documentElement.lang==='${locale}'&&localStorage.getItem('bird-view.locale')==='${locale}'`)||locale==='zh-Hant');
      check(`${locale}: switching preserves progress`,progress===await win.webContents.executeJavaScript(`localStorage.getItem('bird-view.progress.v1')`));
      await reload(win);
      check(`${locale}: persists after reload`,await win.webContents.executeJavaScript(`document.documentElement.lang==='${locale}'`));
      const content=await win.webContents.executeJavaScript(`(async()=>{
        const {t}=await import('./js/i18n.js'),{loadAllLevels,loadBirdDb,birdInfo}=await import('./js/level.js');
        const {DEVICES}=await import('./js/device.js'),{defaultConfig,validate}=await import('./js/audio-core.js');
        const data=await loadBirdDb(),levels=await loadAllLevels();
        return {title:document.title,expectedTitle:t('走，賞鳥趣'),settings:document.getElementById('btnSettings').textContent,
          expectedSettings:t('設定（1）'),level:document.querySelector('.level-card .t').textContent,expectedLevel:levels[0].title,
          allBirdNames:Object.values(data).every(b=>b.displayName&&b.habitat&&b.note),count:Object.keys(data).length,
          expectedBird:birdInfo('eurasian-tree-sparrow').displayName,scope:DEVICES.scope.name,
          validation:validate(defaultConfig({1:18000,2:18810,3:19500,4:20000,6:21000,7:21500,8:22000,9:22990})).length,
          interpolation:t('第 {0} 關',[3]),untranslated:t('__missing_key__')};
      })()`);
      check(`${locale}: static and dynamic menu text`,content.title===content.expectedTitle&&content.settings===content.expectedSettings&&content.level===content.expectedLevel,{title:content.title});
      check(`${locale}: 111 localized bird records`,content.count===111&&content.allBirdNames);
      check(`${locale}: placeholders and safe fallback`,!content.interpolation.includes('{0}')&&content.untranslated==='__missing_key__');
      check(`${locale}: receiver protocol unchanged`,content.validation===0);
      await wait(150);fs.writeFileSync(path.join(out,locale+'-menu.png'),(await win.webContents.capturePage()).toPNG());
      await key(win,'1');await wait(350);
      check(`${locale}: keypad opens settings`,await win.webContents.executeJavaScript(`!document.getElementById('screen-settings').hidden`));
      await wait(150);fs.writeFileSync(path.join(out,locale+'-settings.png'),(await win.webContents.capturePage()).toPNG());
      await key(win,'6');check(`${locale}: keypad navigates languages`,await win.webContents.executeJavaScript(`document.querySelectorAll('.language-choice.kfocus').length===1`));
      await key(win,'3');check(`${locale}: keypad exits settings`,await win.webContents.executeJavaScript(`!document.getElementById('screen-menu').hidden`));
      await win.webContents.executeJavaScript(`document.querySelector('.level-card').click()`);
      check(`${locale}: playable localized level`,await until(win,`document.getElementById('hudTop').textContent.includes(${JSON.stringify(content.expectedLevel)})`));
      check(`${locale}: translated HUD and device`,await win.webContents.executeJavaScript(`(async()=>{const {t}=await import('./js/i18n.js');return document.getElementById('hudTop').textContent.includes(t('已記錄 {0} / {1} 種',[1,5]))&&document.getElementById('rDevice').textContent.includes(t('手機'))})()`));
      const xy=await win.webContents.executeJavaScript(`document.getElementById('rXY').textContent`);await key(win,'6');
      check(`${locale}: gameplay input still works`,xy!==await win.webContents.executeJavaScript(`document.getElementById('rXY').textContent`));
      await key(win,'3');check(`${locale}: exit dialog localized`,await win.webContents.executeJavaScript(`(async()=>{const{t}=await import('./js/i18n.js');return document.getElementById('modalTitle').textContent===t('退出關卡')})()`));
      await key(win,'9');await win.webContents.executeJavaScript(`document.getElementById('btnDex').click()`);
      check(`${locale}: collection uses localized bird name`,await win.webContents.executeJavaScript(`document.querySelector('.dex-card[data-species="eurasian-tree-sparrow"] .meta b').textContent===${JSON.stringify(content.expectedBird)}`));
      await win.webContents.executeJavaScript(`document.querySelector('.dex-card[data-species="eurasian-tree-sparrow"]').click()`);
      check(`${locale}: localized bird detail`,await win.webContents.executeJavaScript(`(async()=>{const{t}=await import('./js/i18n.js');return document.getElementById('modalBody').textContent.includes(t('學名'))&&!/\{\d+\}/.test(document.getElementById('modalBody').textContent)})()`));
      await key(win,'3');await key(win,'3');
      await win.webContents.executeJavaScript(`document.getElementById('btnCal').click()`);
      check(`${locale}: microphone setup translated`,await until(win,`document.getElementById('rxSummary').querySelectorAll('tbody tr').length===8`));
      check(`${locale}: calibration status translated`,await win.webContents.executeJavaScript(`(async()=>{const{t}=await import('./js/i18n.js');return document.getElementById('rxStatus').textContent===t('未收音')&&document.getElementById('btnRxGuided').textContent===t('一鍵引導校正（9）')})()`));
      await wait(150);fs.writeFileSync(path.join(out,locale+'-calibration.png'),(await win.webContents.capturePage()).toPNG());
      await key(win,'3');
      // Entering a level records a date; use the current save for the next language.
      await win.webContents.executeJavaScript(`localStorage.setItem('bird-view.progress.v1',${JSON.stringify(progress)})`);
      await reload(win);
    }
    check('settings do not request microphone permission',permissions.length===0,{permissions});
    check('runtime uses no external network services',remote.length===0,{remote});
    await win.loadURL('app://birdview-locales/index.html?lang=not-supported');
    await until(win,`document.querySelectorAll('.level-card').length===10`);
    check('unsupported URL language safely uses saved locale',await win.webContents.executeJavaScript(`document.documentElement.lang==='ko'`));
    check('no renderer errors',errors.length===0,{errors});
  }catch(error){check('unexpected verification error',false,{error:String(error.stack||error)});}
  finally{
    const result={date:'2026-11-07',ok:checks.every(c=>c.ok),checks,hardwareAcceptance:'UNTESTED'};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
    if(win)win.destroy();app.exit(result.ok?0:1);
  }
});
