'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'ws/index.html'),'utf8');
function fn(name){const a=source.indexOf('function '+name+'(');assert.ok(a>=0,name);for(let b=source.indexOf('}',a);b>=0;b=source.indexOf('}',b+1)){const code=source.slice(a,b+1);try{new vm.Script(code);return code;}catch(_){}}throw Error(name);}
function context(){
 const c=vm.createContext({state:{},Date,Math,Map,AM_LOG_PRE:'amLog_',AM_LOG_DAYS:35,AM_OFF_LEAD:30,AM_OFF_GRACE:60,works:[],checks:{},amNxOn:()=>true,amTr2:(en,ne)=>en+' / '+ne,amIsOff:w=>w.off,amIsRep:()=>false,amRecheckMin:()=>0,amKindName:k=>k,amLogSince:()=>0,amRunActive:()=>[],amNxLongRuns:()=>[],amWorks:()=>c.works,_amChecksRead:()=>c.checks,amWorkSince:()=>0,amOffRecsOf:(w)=> (c.checks[w.id]||[]).map(r=>({t:Date.parse(r.at),by:r.by,wsScheduled:r.wsScheduled})),escapeHtml:s=>String(s),amNxSlot:x=>x.o||x.s?.slot,amNxSetAt:x=>x.o?.s||x.s?.slot?.s||NaN});
 for(const n of ['amTimeKey','amTimes','amIsTimed','amOffLead','amOffGrace','amHM','amLogDay','amLogDayMs','amNext3am','amOffCut','amOffSlots','amIsFreshLegacy','am5391Enabled','am5391Since','amApplyPatch','am5391TimeChange','am5391TimeSince','am5391Forgot','am5391Keep','am5391Toggle','am5391Cut','am5391Slots','am5391Rounds','am5391Missed','am5391Settle','am5391Html','amOffStatus','amNxWhen2'])vm.runInContext(fn(n),c);
 return c;
}
const at=t=>new Date('2026-11-13T'+t+':00').getTime(),run=(c,s)=>vm.runInContext(s,c);
test('next main time, not early opening, retires old round; single round stays to 3:00',()=>{
 const c=context();c.w={id:'test',off:true,times:['10:00','18:30'],lead:30,grace:60};c.works=[c.w];
 c.now=at('18:10');assert.equal(run(c,'amOffStatus(w,now).slot.s'),at('10:00'));assert.equal(run(c,'amOffStatus(w,now).st'),'fire');
 assert.equal(run(c,'am5391Missed(amLogDay(now),now).length'),0);
 c.now=at('18:30');assert.equal(run(c,'amOffStatus(w,now).slot.s'),at('18:30'));assert.equal(run(c,'am5391Missed(amLogDay(now),now).length'),1);
 c.w.times=['10:00'];c.now=at('23:59');assert.equal(run(c,'amOffStatus(w,now).st'),'fire');c.now=new Date('2026-11-14T03:00:00').getTime();assert.notEqual(run(c,'amOffStatus(w,now).st'),'fire');
});
test('freshness defaults without data migration; explicit false/true overrides; eventual completion',()=>{
 const c=context();c.w={id:'test',off:true,name:'見本の鮮度管理',times:['10:00','18:30'],grace:60};c.works=[c.w];c.now=at('19:40');const before=JSON.stringify([c.state,c.w]);
 assert.equal(run(c,'amOffStatus(w,now).st'),'fire');assert.equal(run(c,'amOffStatus(w,now).slot.s'),at('10:00'));assert.equal(JSON.stringify([c.state,c.w]),before);
 c.w.wsOverdueKeep=false;assert.equal(run(c,'am5391Missed(amLogDay(now),now).length'),1);c.w.wsOverdueKeep=true;assert.equal(run(c,'am5391Missed(amLogDay(now),now).length'),0);
 c.checks.test=[{at:new Date(c.now).toISOString(),by:'見本あ'}];assert.equal(run(c,'amOffStatus(w,now).st'),'done');
});
test('manager can change the effective default; non-manager cannot write',()=>{
 const c=context();c.w={id:'test',name:'見本の鮮度管理'};c.works=[c.w];c.amWorksEdit=()=>c.works;c.amSave=()=>{};c.renderMapView=()=>{};c.am539Settings=()=>{};c.isAdmin=false;
 const before=JSON.stringify(c.w);run(c,'am5391Toggle("test")');assert.equal(JSON.stringify(c.w),before);c.isAdmin=true;run(c,'am5391Toggle("test")');assert.equal(c.w.wsOverdueKeep,false);run(c,'am5391Toggle("test")');assert.equal(c.w.wsOverdueKeep,true);
});
test('finishing the old round in the early window never completes the next round',()=>{
 const c=context();c.w={id:'test',off:true,times:['10:00','18:30'],lead:30,grace:60};c.works=[c.w];c.now=at('18:15');c.checks.test=[{at:new Date(c.now).toISOString(),by:'見本あ',wsScheduled:at('10:00')}];
 assert.equal(run(c,'amOffStatus(w,now).st'),'soon');assert.equal(run(c,'amOffStatus(w,now).slot.s'),at('18:30'));c.now=at('18:30');assert.equal(run(c,'am5391Missed(amLogDay(now),now).length'),0);
});
test('protected round survives a week and finishes with the eventual record',()=>{
 const c=context();c.w={id:'test',off:true,name:'見本の鮮度管理',times:['10:00','18:30'],grace:60};c.works=[c.w];c.state.wsOverdueSince=at('03:00');c.now=at('19:40')+8*864e5;
 assert.equal(run(c,'amOffStatus(w,now).slot.s'),at('10:00'));c.checks.test=[{at:new Date(c.now).toISOString(),by:'見本あ'}];assert.equal(run(c,'amOffStatus(w,now).st'),'done');
});
test('append-only daily records, idempotent settlement, pure reads, old version excludes miss',()=>{
 const c=context();c.w={id:'test',off:true,name:'見本の点検',times:['10:00','18:30'],grace:60};c.works=[c.w];c.now=at('18:30');c.state.amLog_2026={keep:1};
 const before=JSON.stringify(c.state);run(c,'am5391Html(amLogDay(now),now)');assert.equal(JSON.stringify(c.state),before);
 run(c,'am5391Settle(now)');const after=JSON.stringify(c.state);run(c,'am5391Settle(now)');assert.equal(JSON.stringify(c.state),after);assert.deepEqual(c.state.amLog_2026,{keep:1});
 const r=Object.values(c.state['amLog_2026-11-13'])[0];assert.equal(r.miss,1);assert.equal(r.round,1);assert.equal(Date.parse(r.hiddenAt),at('18:30'));assert.equal(Date.parse(r.scheduled),at('10:00'));assert.match(run(c,'am5391Html(amLogDay(now),now)'),/間に合わなかった 1件/);
 c.w.name='変更後';assert.equal(Object.values(c.state['amLog_2026-11-13'])[0].name,'見本の点検');
 const old=require('node:child_process').execFileSync('git',['show','65efd8c:ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});const a=old.indexOf('function amLogRange('),b=old.indexOf('\n}',a)+2;vm.runInContext(fn('amLogKeys')+'\n'+old.slice(a,b),c);assert.equal(run(c,'amLogRange(now-864e5,now+1).length'),0);
});
test('main time and early availability stay distinct',()=>{
 const c=context();c.x={o:{s:at('18:30'),o:at('18:00'),e:at('19:30'),t:true},due:at('19:30'),k:'soon'};c.now=at('18:10');
 assert.equal(run(c,'amNxWhen2(x,now).t'),'18:30から');assert.equal(run(c,'amNxWhen2(x,now).s'),'18:00から押せます');c.x.lock=true;c.x.lockAt=at('18:00');assert.equal(run(c,'amNxWhen2(x,now).t'),'18:30から');
});
test('all inline scripts parse, LF and version, source and generated main agree',()=>{
 for(const file of ['ws/index.html','v2/ws/index.html','v2/wstest.html']){const s=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!s.includes('\r'));for(const m of s.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/src=/.test(m[1])&&(!/type=/.test(m[1])||/id="v2-main"/.test(m[1])))new vm.Script(m[2],{filename:file});}
 assert.match(source,/APP_VERSION = '5.39.3'/);
});

async function browser(){
  const http=require('node:http');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ws5391-'));
  const legacyTests=process.argv.includes('--legacy-tests'),baseline=process.argv.includes('--baseline'),oldFile=f=>require('node:child_process').execFileSync('git',['show','65efd8c:'+f],{cwd:root,encoding:'utf8',maxBuffer:8e6});
  const historical={};
  const versions={'wsold':'5.14','wsold515':'5.15','wsold517':'5.18','wsold519':'5.19','wsold522':'5.22','wsold523':'5.23','wsold524':'5.24','wsold525':'5.25','wsold526':'5.26','wsold5271':'5.27.1','wsold528':'5.28','wsold529':'5.29','wsold530':'5.30','wsold531':'5.31','wsold533':'5.33','wsold536':'5.36'};
  if(!process.argv.includes('--smoke')){
   const cp=require('node:child_process'),hs=cp.execFileSync('git',['log','--format=%H','--','v2/ws/index.html'],{cwd:root,encoding:'utf8'}).trim().split('\n');
   for(const h of hs){const html=cp.execFileSync('git',['show',h+':v2/ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6}),v=html.match(/const APP_VERSION\s*=\s*'([^']+)'/);if(v)for(const [dir,version] of Object.entries(versions))if(v[1]===version&&!historical[dir])historical[dir]=html;if(Object.keys(historical).length===Object.keys(versions).length)break;}
  }
  if(!process.argv.includes('--smoke')&&Object.keys(historical).length<Object.keys(versions).length){
   const cp=require('node:child_process'),hs=cp.execFileSync('git',['log','--format=%H','--','ws/index.html'],{cwd:root,encoding:'utf8'}).trim().split('\n');
   for(const h of hs){let html=cp.execFileSync('git',['show',h+':ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});const v=html.match(/const APP_VERSION\s*=\s*'([^']+)'/);if(v)for(const [dir,version] of Object.entries(versions))if(v[1]===version&&!historical[dir]){const at=html.lastIndexOf("<script>\n'use strict';");if(at<0)throw Error('Historical main script: '+version);html=html.slice(0,at)+'<script src="../core.js"></script><script src="../wsspec.js"></script><script src="../wsshim.js"></script><script type="text/plain" id="v2-main">'+html.slice(at+8);historical[dir]=html.replace('../autoupdate.js','../../autoupdate.js');}if(Object.keys(historical).length===Object.keys(versions).length)break;}
   if(Object.keys(historical).length!==Object.keys(versions).length)throw Error('Historical fixtures missing: '+Object.keys(versions).filter(k=>!historical[k]).join(','));
  }
  const server=http.createServer((req,res)=>{
    res.sendDate=false;
    const u=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
    if(!file.startsWith(root+path.sep)||u.pathname.includes('/docs/')||u.pathname.includes('/ff/')){res.writeHead(403).end();return;}
    try{const oldDir=u.pathname.match(/^\/v2\/(wsold[^/]*)\/index.html$/);let bytes=oldDir&&historical[oldDir[1]]?historical[oldDir[1]]:(baseline&&u.pathname==='/v2/ws/index.html'||(baseline||legacyTests)&&u.pathname==='/v2/wstest.html')?oldFile(u.pathname.slice(1)):fs.readFileSync(file);if(process.argv.includes('--smoke')&&u.pathname==='/v2/wstest.html'){const h=String(bytes);bytes='<div id="sum"></div><table id="rows"></table><script src="core.js"></script><script src="wsspec.js"></script><script>window.__baseResults={total:0,ng:0,rows:[]}</script>'+h.slice(h.lastIndexOf('<script>'));}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8');res.setHeader('Content-Security-Policy',"connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:");res.end(bytes);}catch(_){res.writeHead(404).end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  const exe=process.env.WS539_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const child=spawn(exe,['--no-sandbox','--headless=new','--disable-gpu','--disable-software-rasterizer','--in-process-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-pipe','--user-data-dir='+path.join(dir,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
  let seq=0,buf='',errors='',session;const pending=new Map();child.stderr.on('data',d=>errors+=d);
  const exited=new Promise(resolve=>{child.on('error',e=>resolve(e.message));child.on('exit',(code)=>resolve('exit '+code+' '+errors.slice(-1000)));});
  child.stdio[4].on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\0'))>=0){const part=buf.slice(0,i);buf=buf.slice(i+1);try{const m=JSON.parse(part);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}catch(_){}}});
  function send(method,params={},sid=session){return Promise.race([new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});child.stdio[3].write(JSON.stringify({id,method,params,...(sid?{sessionId:sid}:{})})+'\0');}),exited.then(e=>{throw Error(e);}),new Promise((_,reject)=>setTimeout(()=>reject(Error('CDP timeout '+method)),30000))]);}
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
  try{
    const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
    await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['http://*','https://*']});
    // The local origin is explicitly allowed through request interception.
    await send('Network.setBlockedURLs',{urls:['https://*','http://localhost/*']});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1024,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/v2/wstest.html'});
    if(process.argv.includes('--virtual'))await send('Emulation.setVirtualTimePolicy',{policy:'pauseIfNetworkFetchesPending',budget:3600000,maxVirtualTimeTaskStarvationCount:1000});
    const start=Date.now();let result;
    while(Date.now()-start<20*60000){if(process.argv.includes('--virtual'))await send('Emulation.setVirtualTimePolicy',{policy:'pauseIfNetworkFetchesPending',budget:3600000,maxVirtualTimeTaskStarvationCount:1000});result=await evaluate((baseline||legacyTests)?'window.__results?{existing:window.__results,ws539:{total:0,ng:0}}:null':'window.__results&&window.__ws539Results?{existing:window.__results,ws539:window.__ws539Results}:null');if(result)break;if(Math.floor((Date.now()-start)/1000)%30===0)console.log('BROWSER_PROGRESS',await evaluate('({count:document.getElementById("rows")?.children.length,last:document.getElementById("rows")?.lastElementChild?.textContent?.slice(0,120)})'));await new Promise(r=>setTimeout(r,1000));}
    if(process.argv.includes('--virtual'))await send('Emulation.setVirtualTimePolicy',{policy:'pause'});
    fs.writeFileSync(path.join(dir,'existing-results.json'),JSON.stringify(result||{error:'suite timeout'},null,2));console.log(baseline?'BASELINE_RESULTS':'BROWSER_RESULTS',JSON.stringify(result?{existing:{total:result.existing.total,ng:result.existing.ng},ws539:result.ws539}:null));
    assert.ok(result,'browser suite must finish');
    if(!baseline&&!legacyTests){
      const known=new Set(['97j1','97s1','97s2','5383-id','5384-layout','97z9']);
      assert.deepEqual(result.existing.rows.filter(r=>!r.ok&&!known.has(r.no||r.id)),[],'unexpected browser regression');
      assert.equal(result.ws539.ng,0,'5.39.1 browser checks');
    }
    if(result&&!baseline&&!legacyTests){
      const old=oldFile('ws/index.html'),start=old.indexOf('function amNxRender(');let legacy='';for(let end=old.indexOf('}',start);end>=0;end=old.indexOf('}',end+1)){try{new vm.Script(old.slice(start,end+1));legacy=old.slice(start,end+1);break;}catch(_){}}
      const geometry=[];
      for(const [width,height] of [[768,1024],[1024,768],[1280,1024]]){
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        geometry.push(await evaluate('(()=>{const f=window.__ws539Frame;f.style.maxWidth="none";f.style.width="'+width+'px";f.style.height="'+height+'px";const w=f.contentWindow;w.eval("state.amMap=JSON.parse(JSON.stringify(OMACHI_MAP));_amNx.ck=String();_amNx.sel=String();isAdmin=false;renderMapView()");const read=()=>["nxa-map","nxa-col"].map(id=>{const r=w.document.getElementById(id).getBoundingClientRect();return [r.x,r.y,r.width,r.height]});const current=read(),saved=w.amNxRender;w.eval('+JSON.stringify(legacy)+');w.eval("renderMapView()");const old=read();w.amNxRender=saved;w.eval("renderMapView()");return {width:'+width+',current,baseline:old,equal:JSON.stringify(current)===JSON.stringify(old),overflow:w.document.documentElement.scrollWidth-w.document.documentElement.clientWidth};})()'));
      }
      assert.ok(geometry.every(x=>x.equal&&x.overflow===0),JSON.stringify(geometry));console.log('GEOMETRY',JSON.stringify(geometry));fs.writeFileSync(path.join(dir,'geometry.json'),JSON.stringify(geometry,null,2));
    }
    if(result&&!baseline&&!legacyTests){
     for(const width of [390,768,1024,1280]){
      const height=width===390?844:1024;await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await evaluate('(()=>{document.documentElement.style.overflow="hidden";document.body.style.cssText="margin:0;padding:0;overflow:hidden";for(const x of document.body.children)x.style.display=x.id==="ws539-fixture"?"block":"none";const f=window.__ws539Frame;f.style.cssText="width:'+width+'px;height:'+height+'px;border:0";f.contentWindow.renderMapView();const c=f.contentDocument.getElementById("nxa-col");if(c)c.scrollTop=c.scrollHeight;})()');
      await new Promise(r=>setTimeout(r,250));const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'ws5391-'+width+'.png'),Buffer.from(shot.data,'base64'));
     }
    }
    console.log('ARTIFACTS',dir);
  }finally{child.kill();server.close();}
}
if(process.argv.includes('--browser'))browser().catch(e=>{console.error('BROWSER_UNAVAILABLE',e.message);process.exitCode=1;});test('two devices append distinct rounds; an offline 5.39.0 save preserves new fields and records',async()=>{
 const v=vm.createContext({window:{},console,setTimeout,clearTimeout,Date,Math,JSON,TextEncoder,crypto:require('node:crypto').webcrypto});
 for(const f of ['core.js','wsspec.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),v);
 const V=v.window.V2,cloud=new V.MemoryCloud(),stores=['A','B','old5390'].map(device=>new V.Store({backend:cloud.device(),space:'test5391',device,kv:new V.MemKV(),snapshot:false})),cols=await Promise.all(stores.map(s=>s.open('ws~synthetic','ws')));
 const settle=async()=>{for(let i=0;i<3;i++){await Promise.all(stores.map(s=>s.settle()));await new Promise(r=>setTimeout(r,30));}};
 cols[0].setState({amWorks:[{id:'test',times:['10:00','18:30'],wsOverdueKeep:false}],amLog_2026:{keep:1}});await settle();
 const old=cols[2].getState();stores.forEach(s=>s.be.setOnline(false));
 for(let i=0;i<2;i++){const st=cols[i].getState();st['wsTimeChange_test_'+i]={w:'test',changedAt:100+i,times:['09:00','13:00']};st['amLog_2026-11-13']={['wsMiss_test_'+i]:{w:'test',round:i+1,miss:1,wsMissed:1,scheduled:'2026-11-13T01:00:00Z',hiddenAt:'2026-11-13T09:30:00Z',at:'2026-11-13T09:30:00Z',by:''}};cols[i].setState(st);}
 old.amWorks[0].name='見本の変更';cols[2].setState(old);stores.forEach(s=>s.be.setOnline(true));await settle();
 for(const c of cols){const st=c.getState();assert.equal(Object.keys(st['amLog_2026-11-13']).length,2);assert.equal(st.amWorks[0].wsOverdueKeep,false);assert.equal(st.amWorks[0].name,'見本の変更');assert.equal(st.amLog_2026.keep,1);assert.equal(Object.keys(st).filter(k=>k.startsWith('wsTimeChange_')).length,2);}
 stores.forEach(s=>clearTimeout(s.flushT));
});


test('time changes exclude past rounds and retain future rounds; history is append only',()=>{
 const c=context();c.w={id:'test',off:true,times:['10:00','14:00'],grace:60};c.works=[c.w];c.state.wsOverdueSince=at('03:00')-864e5;c.changed=at('08:00');
 run(c,"am5391TimeChange(w,['09:00','13:00'],changed)");c.w.times=['09:00','13:00'];c.now=at('14:00');
 assert.equal(run(c,'am5391Missed(amLogDay(now-864e5),now).length'),0);assert.equal(run(c,'am5391Missed(amLogDay(now),now).length'),1);
 const before=JSON.stringify(c.state);run(c,"am5391TimeChange(w,['09:00','13:00'],now)");assert.equal(JSON.stringify(c.state),before);
 run(c,"am5391TimeChange(w,['10:00','14:00'],now)");assert.equal(Object.keys(c.state).filter(k=>k.startsWith('wsTimeChange_')).length,2);
});
test('forgotten round is excluded even when forget record is on next day',()=>{
 const c=context();c.w={id:'test',off:true,times:['10:00','14:00'],grace:60};c.works=[c.w];c.now=at('14:00');
 c.state['amLog_2026-11-14']={f1:{w:'test',s:new Date(at('10:10')).toISOString(),at:new Date(at('14:00')+864e5).toISOString(),nf:1,miss:1}};
 assert.equal(run(c,'am5391Missed(amLogDay(now),now).length'),0);run(c,'am5391Settle(now)');assert.equal(c.state['amLog_2026-11-13'],undefined);
});

test('saving changed times records boundary before work update; unchanged save adds nothing',()=>{
 const c=context();c.w={id:'test',off:true,times:['10:00','14:00']};c.rec={times:['09:00','13:00']};c.fo={set:c.rec,del:[]};
 run(c,'amApplyPatch(w,rec,null,fo,null)');assert.deepEqual(Array.from(c.w.times),['09:00','13:00']);
 const entries=Object.entries(c.state).filter(([k])=>k.startsWith('wsTimeChange_'));assert.equal(entries.length,1);assert.ok(entries[0][1].changedAt>0);
 const before=JSON.stringify(c.state);run(c,'amApplyPatch(w,rec,null,fo,null)');assert.equal(JSON.stringify(c.state),before);
});
