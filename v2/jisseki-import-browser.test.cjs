// Local synthetic fixtures only. Browser profile is removed in finally.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'ff-import-test-'));
const server=http.createServer((req,res)=>{
  const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  res.setHeader('Content-Security-Policy',"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self'");
  res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html; charset=utf-8':'text/plain');
  fs.readFile(p,(e,b)=>{res.statusCode=e?404:200;res.end(e?'missing':b);});
});
let browser,socket,seq=0,pending=new Map();
function cmd(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},30000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params,sessionId}));});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(sessionId,expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function wait(sessionId,expression,ms=600000){const end=Date.now()+ms;while(Date.now()<end){const r=await evaluate(sessionId,expression);if(r)return r;await sleep(400);}throw Error('timeout: '+expression);}
async function page(url){const {targetId}=await cmd('Target.createTarget',{url:'about:blank'});const {sessionId}=await cmd('Target.attachToTarget',{targetId,flatten:true});await cmd('Page.enable',{},sessionId);await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const nav=await cmd('Page.navigate',{url},sessionId);if(nav.errorText)throw Error(nav.errorText);return {sessionId,targetId};}
(async()=>{
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
    console.log('test process',process.pid,'profile',path.basename(profile));
    browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--disable-renderer-backgrounding','--disable-background-timer-throttling','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});
    let stderr='',spawnError;browser.on('error',e=>{spawnError=e;});browser.stderr.on('data',d=>{stderr+=d;});
    const portFile=path.join(profile,'DevToolsActivePort');
    for(let i=0;i<100&&!fs.existsSync(portFile);i++){if(spawnError)throw spawnError;if(browser.exitCode!==null)throw Error('Browser exited '+browser.exitCode+' '+stderr.slice(0,1000));await sleep(100);}
    if(!fs.existsSync(portFile))throw Error('Browser startup timeout '+stderr.slice(0,1000));
    const [port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
    socket=new WebSocket('ws://127.0.0.1:'+port+endpoint);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
    for(const file of (process.argv.length>2?process.argv.slice(2):['test','fftest','ffcompare'])){
      assert.ok(['test','fftest','ffcompare'].includes(file));
      const p=await page(origin+'/v2/'+file+'.html'),sid=p.sessionId;
      if(file==='ffcompare'){await wait(sid,"!!document.getElementById('go-sample')");await evaluate(sid,"document.getElementById('go-sample').click()");}
      const result=await wait(sid,'window.__results');
      console.log(file,JSON.stringify({total:result.total,fail:result.ng??result.badRows,diffs:result.diffs}));
      if(result.rows&&Array.isArray(result.rows))console.log('failed rows',JSON.stringify(result.rows.filter(r=>!r.ok)));
      assert.equal(result.ng??result.badRows,0);if(file==='ffcompare')assert.equal(result.diffs,0);
      if(file==='ffcompare'){
        await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false},sid);
        const ui=await evaluate(sid,`(async()=>{
          const f=document.getElementById('fn');f.style.width='390px';const w=f.contentWindow;
          w.eval('S.PM=[{id:"synthetic",name:"Synthetic item",category:"ホットFF",cost:1,stdPrice:2,shopPrice:2,disc:1,minCount:1,tags:"",order:1,enabled:true,timeStart:7,timeEnd:22}];S.ji={synthetic:{teika:4,nebiki:1,haiki:0}};S.activeWeek="2026.11.3";S.weekStart="2026-11-03";S.weeks={};syncActiveWeek()');
          w.document.querySelectorAll('.tab-panel').forEach(e=>e.style.display='block');
          w.openJiImport();const el=w.document.getElementById('ji-import-modal'),r=el.getBoundingClientRect();
          const centered=Math.abs(r.x+r.width/2-w.document.documentElement.clientWidth/2)<2&&Math.abs(r.y+r.height/2-w.innerHeight/2)<2;
          w.jiImportRead(JSON.stringify({kind:'ff-jisseki',v:1,items:[{name:w.eval('S.PM[0].name'),teika:2,nebiki:1,haiki:0}]}));
          const buttons=[...el.querySelectorAll('button')],targets=buttons.every(b=>b.getBoundingClientRect().height>=44);
          const apply=buttons.find(b=>b.getAttribute('onclick')==='jiImportApply()'),close=buttons.find(b=>b.getAttribute('onclick')==='closeJiImport()');
          const colors=w.getComputedStyle(apply).backgroundColor!==w.getComputedStyle(close).backgroundColor;
          w.closeJiImport();const actions=[...w.document.querySelectorAll('#ji-import-actions button')];
          const oneLine=actions.length===4&&actions.every(b=>w.getComputedStyle(b).whiteSpace==='nowrap')&&actions.at(-1).getBoundingClientRect().right<=390;
          return {centered,targets,colors,oneLine,geometry:{rect:r.toJSON(),width:w.innerWidth,height:w.innerHeight}};
        })()`);console.log('UI390',JSON.stringify(ui));assert.ok(ui.centered&&ui.targets&&ui.colors&&ui.oneLine);
        const recovery=await evaluate(sid,`(async()=>{
          const source=document.getElementById('fn').contentWindow,V2=source.V2,st=source.eval('JSON.stringify(_ffSaveObj())');
          const store=new V2.Store({backend:new V2.MemoryCloud().device(),space:'IMPORT_TEST',device:'synthetic',kv:new V2.MemKV(),snapshot:false});
          const c=await store.open('ff~test','ff');c.setState(JSON.parse(st));await store.settle();
          window.V2APP={store:()=>store,stores:()=>[{id:'test',name:'Synthetic'}],storeId:()=> 'test',openStore:async()=>c};
          const load=async()=>{const f=document.createElement('iframe');document.body.appendChild(f);await new Promise(r=>{f.onload=r;f.src='ff/index.html?embedded=1';});for(let i=0;i<200&&!f.contentWindow.__v2ready;i++)await new Promise(r=>setTimeout(r,30));f.contentWindow.alert=()=>{};f.contentWindow.confirm=()=>true;return f;};
          let f=await load(),w=f.contentWindow;const name=w.eval('S.PM[0].name');
          for(let i=0;i<10;i++){w.openJiImport();w.jiImportRead(JSON.stringify({kind:'ff-jisseki',v:1,items:[{name,teika:114+i,nebiki:12,haiki:3}]}));w.document.getElementById('ji-import-anyway').checked=true;w.jiImportApply();await store.settle();}
          const imported=w.eval('S.ji[S.PM[0].id].teika')===123;f.remove();f=await load();w=f.contentWindow;
          const reopened=w.eval('S.ji[S.PM[0].id].teika')===123;w.openRecoveryModal();await w.renderRecoveryList();
          const idx=w.eval('_recItems.findIndex(x=>x.prefix==="pre_import")');
          const backups=w.eval('_recItems.map((x,i)=>({x,i})).filter(r=>r.x.prefix==="pre_import")');
          const values=[];for(const r of backups){w.restoreWeekFromRecovery(r.i,w.eval('S.activeWeek'));values.push(w.eval('S.ji[S.PM[0].id].teika'));}
          const restored=JSON.stringify(values.sort((a,b)=>a-b))===JSON.stringify([120,121,122]);f.remove();return {imported,reopened,listed:idx>=0,three:backups.length===3,restored};
        })()`);console.log('recovery',JSON.stringify(recovery));assert.ok(Object.values(recovery).every(Boolean));
      }
      await cmd('Target.closeTarget',{targetId:p.targetId});
    }
  }finally{
    if(browser&&browser.pid&&browser.exitCode===null){const exited=new Promise(r=>browser.once('exit',r));if(socket)try{await cmd('Browser.close');}catch{}await Promise.race([exited,sleep(5000)]);if(browser.exitCode===null){browser.kill();await exited;}}
    if(socket)socket.close();
    await new Promise(r=>server.close(r));
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep));
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:300});
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
