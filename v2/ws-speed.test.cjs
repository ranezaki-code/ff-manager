'use strict';
// 架空の25人・120作業だけを使う。ブラウザーは1プロセスを共用する。
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../speed-records/run-'+Date.now());
fs.mkdirSync(out,{recursive:true});
let revision='ac802b4';
const versions=['3933277','65efd8c','ac802b4'];
const html=new Map(versions.map(v=>[v,cp.execFileSync('git',['show',v+':v2/ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6})]));
const historical={};
if(process.argv.includes('--suite')){
 const code=fs.readFileSync(path.join(__dirname,'ws5391.test.cjs'),'utf8');
 new Function('root','historical','require','process',code.slice(code.indexOf('  const versions='),code.indexOf('  const server=')))(root,historical,require,process);
}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/fixture'){res.setHeader('Content-Type','text/html');res.end('<script src="/v2/core.js"></script><script src="/v2/wsspec.js"></script>');return;}
 const old=u.pathname.match(/^\/v2\/(wsold[^/]*)\/index.html$/);
 if(old&&historical[old[1]]){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(historical[old[1]]);return;}
 const allowed=['/v2/ws/index.html','/v2/core.js','/v2/wsspec.js','/v2/wsshim.js','/v2/wstest.html','/autoupdate.js'];
 if(!allowed.includes(u.pathname)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',u.pathname.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8');
 res.setHeader('Content-Security-Policy',"connect-src 'self'; img-src 'self' data:; font-src 'self' data:");
 res.end(u.pathname==='/v2/ws/index.html'?(html.get(revision)||fs.readFileSync(path.join(root,'v2/ws/index.html'))):fs.readFileSync(path.join(root,u.pathname)));
});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port,profile=fs.mkdtempSync(path.join(out,'profile-'));
 const child=cp.spawn(process.env.WS539_BROWSER||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--no-sandbox','--headless=new','--disable-gpu','--disable-software-rasterizer','--in-process-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe'],windowsHide:true});
 let seq=0,buf='',sid,stderr='';const pending=new Map();child.stderr.on('data',d=>{stderr+=d;if(/\b1909\b/.test(String(d)))child.kill();});
 const dead=new Promise((_,reject)=>{child.on('error',reject);child.on('exit',code=>reject(Error('Browser exit '+code+' '+stderr)));});dead.catch(()=>{});
 child.stdio[4].on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\0'))>=0){const s=buf.slice(0,i);buf=buf.slice(i+1);const m=JSON.parse(s);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}});
 async function send(method,params={},session=sid){let timer;try{return await Promise.race([new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});child.stdio[3].write(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})})+'\0');}),dead,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('CDP timeout '+method+' '+stderr)),30000))]);}finally{clearTimeout(timer);}}
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
 const t=await send('Target.createTarget',{url:'about:blank'},null);sid=(await send('Target.attachToTarget',{targetId:t.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
 await send('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setCPUThrottlingRate',{rate:4});
 await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/fixture'});
 for(let i=0;i<100;i++){if(await ev('!!window.V2'))break;await new Promise(r=>setTimeout(r,50));}
 const results={cpu:4,repeats:10,versions:{}};
 for(revision of process.argv.includes('--after')?versions.concat('working'):versions){
 console.log('MEASURING',revision);
 await ev(`(async()=>{document.querySelector('iframe')?.remove();const f=document.createElement('iframe');f.style.cssText='width:768px;height:1024px;border:0;position:fixed;inset:0';document.body.append(f);await new Promise(r=>{f.onload=r;f.src='/v2/ws/index.html?embedded=1&mem=1&wait=1'});window.w=f.contentWindow;const store=new V2.Store({backend:new V2.MemoryCloud().device(),space:'speed',device:'synthetic',kv:new V2.MemKV(),snapshot:false});await w.__v2go({store,stores:[{id:'speed',name:'架空の店'}],current:'speed',state:JSON.stringify({staff:[],amUsed:true,amNx:{on:1,pre:{off:1}}})});for(let i=0;i<100&&!w.__v2ready;i++)await new Promise(r=>setTimeout(r,50));})()`);
 await ev('w.eval('+JSON.stringify('('+fixture.toString()+')()')+')');
 const rows={};
 for(const action of ['name','row','start','finish','team','side','time','map']){
 if(action==='time'){rows[action]={unavailable:true,reason:'時間帯の切り替えボタンを特定できない'};continue;}
 if(revision==='3933277'&&(action==='team'||action==='side')){rows[action]={unavailable:true};continue;}
 try{
 await ev('w.eval('+JSON.stringify('__prepare('+JSON.stringify(action)+')')+')');
 await send('Profiler.enable');await send('Performance.enable');
 const samples=[],dom=[],calls=[],metrics={};
 for(let i=0;i<10;i++){
 await ev('w.eval('+JSON.stringify('__prepare('+JSON.stringify(action)+')')+')');
 const before=(await send('Performance.getMetrics')).metrics;
 if(i===0)await send('Profiler.start');
 const r=await ev('w.eval('+JSON.stringify('__measure('+JSON.stringify(action)+')')+')');samples.push(r.ms);dom.push(r.dom);calls.push(r.calls);
 if(i===0){const p=await send('Profiler.stop');fs.writeFileSync(path.join(out,revision+'-'+action+'.cpuprofile'),JSON.stringify(p.profile));}
 const after=(await send('Performance.getMetrics')).metrics;
 for(const name of ['LayoutCount','RecalcStyleCount','LayoutDuration','ScriptDuration'])metrics[name]=(metrics[name]||0)+after.find(m=>m.name===name).value-before.find(m=>m.name===name).value;
 if(i===0)console.log('TARGET',action,r.target,'CALLS',JSON.stringify(r.calls));
 }
 samples.sort((a,b)=>a-b);rows[action]={median:(samples[4]+samples[5])/2,max:samples[9],samples,metrics,calls,dom};
 console.log(revision,action,rows[action].median.toFixed(1),rows[action].max.toFixed(1));
 }catch(e){rows[action]={error:e.message};console.error('MEASUREMENT_FAILED',revision,action,e.message);try{await send('Profiler.stop');}catch(_){} }
 }
 results.versions[revision]=rows;fs.writeFileSync(path.join(out,process.argv.includes('--after')?'after.json':'before.json'),JSON.stringify(results,null,2));
 }
 if(process.argv.includes('--after')){
 const checks=[];for(const [action,row] of Object.entries(results.versions.working)){
 if(row.unavailable){checks.push({action,unavailable:true,dom:false,speed:false});continue;}
 const old=results.versions.ac802b4[action],base=results.versions['3933277'][action].unavailable?results.versions['65efd8c'][action]:results.versions['3933277'][action];
 checks.push({action,dom:!row.error&&!old.error&&JSON.stringify(row.dom)===JSON.stringify(old.dom),limit:base.max,actual:row.max,speed:!row.error&&!base.error&&row.max<=base.max});
 }
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));console.log('CHECKS',JSON.stringify(checks));
 if(!checks.every(c=>c.dom&&c.speed))process.exitCode=1;
 }
 if(process.argv.includes('--suite')){
 revision='working';await send('Emulation.setCPUThrottlingRate',{rate:1});
 await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/v2/wstest.html'});
 if(process.argv.includes('--virtual'))await send('Emulation.setVirtualTimePolicy',{policy:'pauseIfNetworkFetchesPending',budget:3600000,maxVirtualTimeTaskStarvationCount:1000});
 const start=Date.now();let result,last=0;
 while(Date.now()-start<20*60000){
 if(process.argv.includes('--virtual'))await send('Emulation.setVirtualTimePolicy',{policy:'pauseIfNetworkFetchesPending',budget:3600000,maxVirtualTimeTaskStarvationCount:1000});
 result=await ev('window.__results&&window.__ws539Results?{existing:window.__results,ws539:window.__ws539Results}:null');
 if(result)break;
 if(Date.now()-last>30000){console.log('SUITE_PROGRESS',await ev('({count:document.getElementById("rows")?.children.length,last:document.getElementById("rows")?.lastElementChild?.textContent?.slice(0,140)})'));last=Date.now();}
 await new Promise(r=>setTimeout(r,1000));
 }
 fs.writeFileSync(path.join(out,'suite.json'),JSON.stringify(result||{error:'timeout'},null,2));
 console.log('SUITE_RESULTS',JSON.stringify(result?{existing:{total:result.existing.total,ng:result.existing.ng},ws539:{total:result.ws539.total,ng:result.ws539.ng}}:null));
 if(!result||result.existing.ng||result.ws539.ng)process.exitCode=1;
 }
 }finally{child.kill();server.close();}
}
function fixture(){
 const NativeDate=Date,now=new NativeDate('2026-11-13T12:20:00+09:00').getTime();window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 const names=Array.from({length:25},(_,i)=>'架空'+String(i+1).padStart(2,'0'));
 const works=Array.from({length:120},(_,i)=>({id:'speed'+i,name:(i%12===0||i===1?'見本の鮮度管理':'見本の作業')+i,kind:i%2?'点検':'清掃',icon:'🔍',zone:'blue',ctr:i%2?'out':'in',place:i%3?'off':undefined,sch:[1,1,1,1],sch7:[1,1,1,1,1,1,1],times:i%3?['10:00','12:00','18:30']:[],lead:30,grace:60,items:[],wsTraining:true,wsPermission:{rule:{ranks:[],duties:[],names:names.map(n=>'name:'+n)},allowed:names.map(n=>'name:'+n)}}));
 state={staff:names,amUsed:true,amNx:{on:1,pre:{off:1}},amWorks:works,amHere:Object.fromEntries(names.map((n,i)=>['h'+i,{n,at:new Date(now-3600000).toISOString()}])),areaChecks:{},wsOverdueSince:now-864e5,amRun:{}};
 state.amMap=JSON.parse(JSON.stringify(OMACHI_MAP));state.amMap.cells.forEach((c,i)=>c.works=[works[(i%40)*3].id]);
 for(let day=0;day<35;day++){const t=now-day*864e5;state['amLog_'+amLogDay(t)]=Object.fromEntries(Array.from({length:120},(_,i)=>['r'+i,{w:'speed'+i,by:names[i%25],at:new Date(t-7200000).toISOString(),s:new Date(t-7800000).toISOString(),min:10}]));}
 delete state['amLog_'+amLogDay(now)].r1;
 delete state['amLog_'+amLogDay(now)].r2;
 state['amLog_'+amLogDay(now)].miss={w:'speed2',name:works[2].name,miss:1,wsMissed:1,round:1,by:'',scheduled:new Date(now-140*60000).toISOString(),hiddenAt:new Date(now-20*60000).toISOString(),at:new Date(now-20*60000).toISOString()};
 const initial=JSON.stringify(state);let teamSeq=0;isAdmin=false;window.alert=()=>{};window.confirm=()=>true;
 sessionStorage.setItem('ws_am_me',names[0]);
 window.__prepare=async action=>{
 amCloseSheet();state=JSON.parse(initial);_amNx.sel='';_amNx.ck='';_amNx.wsSide='in';_amNx.sc=0;_amNx.tab=null;
 state.amRun={demo:{w:'speed0',by:names[0],s:new Date(now-300000).toISOString(),wsPeople:names.slice(0,action==='team'?2:3).map(n=>({n,s:new Date(now-300000).toISOString()}))}};
 renderMapView();
 if(action==='start'){state.amRun={};amNxPick('speed2',false);}
 if(action==='name'){amNxCkOpen('demo');}
 if(action==='finish'){amNxCkOpen('demo');_amNx.hold=0;}
 if(action==='team'){window.__teamKey='team'+(++teamSeq);state.amRun[__teamKey]=state.amRun.demo;delete state.amRun.demo;window.__v2.coll.setState(state);await window.__v2.store.settle();amNxCkOpen(__teamKey);am539TeamPick(__teamKey,'join');}
 if(action==='time'){isAdmin=true;amOpenWorks();}
 window.__target=action==='name'?document.querySelector('[onclick*="amNxFix"]'):action==='start'?document.querySelector('#am-sheet .nx-pk:not(:disabled)'):action==='row'?document.querySelector('.nxa-it[data-w="speed3"]')||document.querySelector('.nxa-it'):action==='finish'?document.querySelector('.nxa-fin'):action==='team'?null:action==='side'?document.querySelector('.ws539-tabs .out'):action==='time'?Array.from(document.querySelectorAll('#am-sheet [onclick]')).find(e=>e.getAttribute('onclick')==="amRgFilt('"+AM_BANDS[3].k+"')"):document.querySelector('#nxa-map [onclick]');
 isAdmin=false;
 _amfHold=0;_amNx.hold=0;
 };
 window.__calls={};for(const name of ['renderMapView','amNxRender','amOffStatus','am5391Rounds','am539RosterRead','amLogRange']){const read=window[name];if(typeof read==='function')window[name]=function(...a){__calls[name]=(__calls[name]||0)+1;return read.apply(this,a);};}
 window.__measure=async action=>{
 window.__calls={};
 const begin=performance.now();
 if(action==='team')await am539TeamChange(__teamKey,'join',names[2]);else{if(!__target)throw Error('Missing target '+action+' '+document.getElementById('map-view').textContent.slice(0,300));__target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const text=document.getElementById('map-view').textContent+(document.querySelector('#am-sheet.show')?.textContent||'');
 if(action==='start'&&!Object.values(state.amRun).some(r=>r.w==='speed2'))throw Error('Start did not start '+__target?.outerHTML+' '+document.body.textContent.slice(-1200));
 if(action==='finish'&&state.amRun.demo)throw Error('Finish did not finish');
 if(action==='team'&&am539People(state.amRun[__teamKey]).length!==3)throw Error('Third participant was not saved');
 return {ms:performance.now()-begin,dom:text,calls:__calls,target:__target?.outerHTML.slice(0,220)};
 };
}
if(process.argv.includes('--after')||process.argv.includes('--browser'))main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
