'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'ws/index.html'),'utf8');
function fn(name,s=source){const a=s.indexOf('function '+name+'(');assert.ok(a>=0,name);for(let b=s.indexOf('}',a);b>=0;b=s.indexOf('}',b+1)){try{new vm.Script(s.slice(a,b+1));return s.slice(a,b+1);}catch(_){}}throw Error(name);}
const baseline=cp.execFileSync('git',['show','f799c63:ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});
function setup(s){
 const code=fs.readFileSync(path.join(__dirname,'ws-settle-equivalence.test.cjs'),'utf8');
 const body=code.slice(code.indexOf('const spec='),code.indexOf("test('real settlement"));
 const x=new Function('fs','path','vm','fn','__dirname','latest',body+'return setup(latest,34);')(fs,path,vm,fn,__dirname,s);
 if(s===source)vm.runInContext(fn('am5393Plan'),x.c);
 return x;
}
test('incremental settlement stays byte-identical across saves, sync, undo, settings, deadlines and clock rollback',()=>{
 const a=setup(baseline),b=setup(source);
 const steps=[
  '', '',
  'now+=3600000',
  'state.amRun={};amRunActive=()=>[]',
  "state['amLog_'+amLogDay(now-20*864e5)].remote={w:'synthetic2',at:new Date(now-20*864e5).toISOString(),by:'synthetic-0'}",
  "delete state['amLog_'+amLogDay(now-20*864e5)].remote",
  "checks.synthetic2=[{at:new Date(now).toISOString(),by:'synthetic-0'}]",
  'checks.synthetic2=[]',
  'works[2].wsOverdueKeep=true', 'works[2].wsOverdueKeep=false',
  'state.wsOverdueSince=now-40*864e5',
  "works[2].times=['02:30','03:00','18:30']",
  'now=new Date(2026,10,14,2,59).getTime()',
  'now+=60000','now+=60000','now-=3*864e5',
  "state['amLog_'+amLogDay(now-4*864e5)].forgot={w:'synthetic2',s:new Date(now-4*864e5).toISOString(),at:new Date(now).toISOString(),nf:1,miss:1}",
  "state['amLog_'+amLogDay(now-4*864e5)].forgot.u=1"
 ];
 for(const step of steps){for(const x of [a,b]){vm.runInContext(step,x.c);vm.runInContext('result=am5391Settle(now)',x.c);}assert.equal(b.c.result,a.c.result,step);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state),step);}
});
test('settled days are skipped on repeated saves and only due days are revisited',()=>{
 const x=setup(source),c=x.c;let visits=0;const missed=c.am5391Missed;c.am5391Missed=(...a)=>{visits++;return missed(...a);};
 vm.runInContext('am5391Settle(now)',c);assert.ok(visits>=34);visits=0;
 vm.runInContext('am5391Settle(now)',c);assert.equal(visits,0);
 vm.runInContext('now+=60000;am5391Settle(now)',c);assert.equal(visits,0);
 vm.runInContext('now+=864e5;am5391Settle(now)',c);assert.ok(visits>0&&visits<=2);
});
test('incremental saves preserve every localStorage byte and add no synchronized metadata',()=>{
 const a=setup(baseline),b=setup(source);
 for(let i=0;i<3;i++){
  for(const x of [a,b])vm.runInContext('amSave(false)',x.c);
  assert.deepEqual(b.writes,a.writes);
  assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));
 }
});
test('a new cutoff in the same day is settled; failed settlement never advances the memo',()=>{
 const a=setup(baseline),b=setup(source);
 for(const expression of ['now=new Date(2026,10,13,18,29).getTime()','now+=60000','now+=60000']){
  for(const x of [a,b])vm.runInContext(expression+';result=am5391Settle(now)',x.c);
  assert.equal(b.c.result,a.c.result);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));
 }
 const c=b.c,read=c.am5391Rounds,missed=c.am5391Missed;
 c.am5391Missed=()=>{throw Error('synthetic');};
 assert.throws(()=>vm.runInContext('now+=864e5;am5391Settle(now)',c),/synthetic/);
 assert.equal(c.am5391Rounds,read);c.am5391Missed=missed;
 vm.runInContext('now+=864e5;am5391Settle(now)',a.c);vm.runInContext('am5391Settle(now)',c);
 assert.equal(JSON.stringify(c.state),JSON.stringify(a.c.state));
});
test('changing an active mark to an after-work mark rechecks its old round',()=>{
 const a=setup(baseline),b=setup(source);
 for(const x of [a,b])vm.runInContext("amRunActive=()=>[{w:'synthetic2',s:new Date(2026,10,13,13,50).getTime(),sa:state.syntheticSa}];am5391Settle(now);state.syntheticSa='after';result=am5391Settle(now)",x.c);
 assert.ok(a.c.result>0);assert.equal(b.c.result,a.c.result);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));
});
test('renaming a custom freshness kind invalidates the effective keep default',()=>{
 const a=setup(baseline),b=setup(source);
 for(const x of [a,b])vm.runInContext("works[2].kind='custom';state.amTags={custom:{n:'鮮度'}};amKindName=k=>k==='custom'?state.amTags.custom.n:k;am5391Settle(now);state.amTags.custom.n='点検';result=am5391Settle(now)",x.c);
 assert.ok(a.c.result>0);assert.equal(b.c.result,a.c.result);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));
});
test('missing generated records are restored byte-for-byte; changed inputs and changed missed rows are rechecked',()=>{
 const a=setup(baseline),b=setup(source);
 for(const step of [
  "windowInitial=JSON.stringify(state);am5391Settle(now);state=JSON.parse(windowInitial)",
  "Object.keys(state).filter(k=>k.startsWith('amLog_')).forEach(k=>state[k]=Object.fromEntries(Object.entries(state[k]).reverse()))",
  'state=JSON.parse(windowInitial)',
  "checks.synthetic2=[{at:new Date(now-6*3600000).toISOString(),by:'synthetic-0'}];state=JSON.parse(windowInitial)",
  "checks.synthetic2=[];Object.values(state).forEach(v=>{if(v&&typeof v==='object')Object.values(v).forEach(r=>{if(r&&r.wsMissed===1){r.nf=1;r.s=r.scheduled;}})})",
  "Object.values(state).forEach(v=>{if(v&&typeof v==='object')Object.keys(v).forEach(k=>{if(v[k]&&v[k].wsMissed===1)delete v[k];})})"
 ]){
  for(const x of [a,b])vm.runInContext(step+';result=am5391Settle(now)',x.c);
  assert.equal(b.c.result,a.c.result,step);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state),step);
 }
});
test('legacy archived records carrying their own id retain exact alias and payload behavior',()=>{
 const a=setup(baseline),b=setup(source);
 for(const step of [
  "key='amLog_'+amLogDay(now);state[key].legacy={id:'alias',w:'foreign',name:'before',wsMissed:1,miss:1,scheduled:new Date(now-6e6).toISOString(),hiddenAt:new Date(now-3e6).toISOString()}",
  "delete state[key].alias;state[key].legacy.name='after'",
  "state[key].legacy.id='nextAlias'",
  "delete state[key].nextAlias;futureKey='amLog_'+amLogDay(now+864e5);state[futureKey]={foreignForgot:{w:'foreign',nf:1,miss:1,s:state[key].legacy.scheduled,at:state[key].legacy.hiddenAt}}",
  'state[futureKey].foreignForgot.u=1'
 ]){for(const x of [a,b])vm.runInContext(step+';result=am5391Settle(now)',x.c);assert.equal(b.c.result,a.c.result);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));}
});
test('empty legacy work entries stay ignored during settlement',()=>{
 const a=setup(baseline),b=setup(source);
 for(const x of [a,b]){x.c.works.push(null);vm.runInContext('result=am5391Settle(now)',x.c);}
 assert.equal(b.c.result,a.c.result);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));
});
test('the device memo stays within 35 days while old saved records remain untouched',()=>{
 const x=setup(source),c=x.c;c.works=[c.works[2]];c.state.amWorks=c.works;
 vm.runInContext('am5391Settle(now)',c);const oldKey='amLog_'+c.amLogDay(c.now-33*864e5),oldRows=JSON.stringify(c.state[oldKey]);
 assert.ok(Object.keys(c.state[oldKey]).some(k=>k.startsWith('wsMiss_')));
 for(let i=0;i<40;i++){
  vm.runInContext('now+=864e5;am5391Settle(now)',c);
  const first=c.amLogDay(c.now-34*864e5),last=c.amLogDay(c.now);
  for(const out of c.am5393Plan.memo.generated.values())assert.ok(out.day>=first&&out.day<=last);
 }
 assert.equal(JSON.stringify(c.state[oldKey]),oldRows);
});
test('the empty-overwrite guard and exact writes match 5.39.2 for empty, populated and corrupt stored data',()=>{
 const values=[{},null,{staff:['synthetic-0']},{amUsed:true},{amWorks:[]},{tasks:{day:[{id:'synthetic'}]}}],stored=['','{',JSON.stringify({pad:'x'.repeat(300)}),JSON.stringify({staff:['synthetic-1'],pad:'x'.repeat(300)})];
 for(const state of values)for(const raw of stored)for(const quota of [false,true]){
  const run=s=>{const writes=[],info={textContent:''};let trims=0,attempts=0;const c=vm.createContext({state,Date:class extends Date{constructor(...a){super(...(a.length?a:[0]));}},STORAGE_KEY:'synthetic',document:{getElementById:()=>info},console:{warn(){},error(){}},localStorage:{getItem:()=>raw,setItem:(k,v)=>{writes.push([k,v]);if(quota&&attempts++===0)throw Error('synthetic quota');}},_wsTrimAllIfNeeded:()=>trims++});for(const n of ['_wsLooksEmpty','_wsHasMeaningfulExisting','saveState'])vm.runInContext(fn(n,s),c);vm.runInContext('saveState()',c);return {writes,info:info.textContent,trims};};
  assert.deepEqual(run(source),run(baseline));
 }
});
test('duplicate late-night slots recheck their real completion window after an undo',()=>{
 const a=setup(baseline),b=setup(source);
 for(const x of [a,b])vm.runInContext("works=[{id:'synthetic2',name:'synthetic',off:true,times:['23:00','23:00'],lead:30,grace:60}];state.amWorks=works;now=new Date(2026,10,14,12).getTime();key='amLog_'+amLogDay(now);state[key]={remote:{w:'synthetic2',at:new Date(now-2*3600000).toISOString(),s:new Date(now-2*3600000-600000).toISOString(),by:'synthetic-0'}};am5391Settle(now);delete state[key].remote;result=am5391Settle(now)",x.c);
 assert.ok(a.c.result>0);assert.equal(b.c.result,a.c.result);assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));
});
if(process.env.WS5393_RESULTS)test('CPU x4 response stays near 5.39.0 and does not grow with store age',()=>{
 const r=JSON.parse(fs.readFileSync(process.env.WS5393_RESULTS,'utf8'));
 for(const action of ['start','finish','team'])for(const age of [0,20,34]){
  const row=r.versions['working@'+age][action],base=r.versions['65efd8c@'+age][action],first=r.versions['working@0'][action];
  assert.ok(!row.error&&!base.error,action);
  assert.equal(row.samples.length,10);assert.ok(row.median<=250,action+' '+age+' median '+row.median);
  assert.ok(row.median<=base.median+35,action+' '+age+' compared with 5.39.0');
  assert.ok(row.median<=first.median+35,action+' '+age+' compared with day 0');
 }
});
function tesFixture(age){
 let initial=JSON.parse(window.__steadyHistory||__spInit);initial.wsOverdueSince=__spNow-age*864e5;state=initial;
 __spInit=JSON.stringify(state);
 window.__calls={};
 window.__prepare=async action=>{const p=JSON.parse(__spPrep(action));await __v2.store.settle();await new Promise(r=>setTimeout(r,1100));window.__target=document.querySelector(p.sel);if(!__target)throw Error('Missing target '+action);};
 window.__measure=async action=>{
  const begin=performance.now();__target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  if(action==='team'){for(let i=0;i<100&&am539People(state.amRun[__DK]).length!==3;i++)await new Promise(r=>setTimeout(r,10));if(am539People(state.amRun[__DK]).length!==3)throw Error('Third participant was not saved');}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  if(action==='start'&&!Object.values(state.amRun).some(r=>r.w==='sp4'))throw Error('Start did not start');
  if(action==='finish'&&state.amRun[__DK])throw Error('Finish did not finish');
  return {ms:performance.now()-begin,dom:document.getElementById('map-view').textContent,calls:__calls,target:__target.outerHTML.slice(0,160)};
 };
}
if(process.argv.includes('--browser')){
 // Reuse the existing single-process runner, historical pages and full WS suite.
 let runner=fs.readFileSync(path.join(__dirname,'ws-speed.test.cjs'),'utf8');
 runner=runner.replace(" const u=new URL(req.url,'http://localhost');"," res.sendDate=false;res.setHeader('Cache-Control','no-store');const u=new URL(req.url,'http://localhost');");
 runner=runner.replace("const allowed=['/v2/ws/index.html'","const allowed=['/v2/index.html','/v2/ws/index.html'").replace("img-src 'self' data:;","img-src 'self' data: blob:;");
 runner=runner.replace('await new Promise(r=>setTimeout(r,1000));',"await new Promise(r=>setTimeout(r,process.argv.includes('--virtual')?20:1000));");
 runner=runner.replace("revision='working';await send('Emulation.setCPUThrottlingRate'","revision='working';await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await send('Emulation.setCPUThrottlingRate'");
 runner=runner.replace("await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/v2/wstest.html'});",`const wsSuiteOffset=new Date(2026,10,13,10).getTime()-Date.now();await send('Page.addScriptToEvaluateOnNewDocument',{source:'(function(){const RD=Date,off='+wsSuiteOffset+';function FD(...args){if(!new.target)return new RD(RD.now()+off).toString();return Reflect.construct(RD,args.length?args:[RD.now()+off],new.target);}FD.prototype=RD.prototype;Object.setPrototypeOf(FD,RD);FD.now=()=>RD.now()+off;window.Date=FD;})();'});await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/v2/wstest.html'});`);
 runner=runner.replace("const versions=['3933277','65efd8c','ac802b4'];","const versions=['65efd8c','f799c63'];");
 runner=runner.replace("process.argv.includes('--after')?versions.concat('working'):versions","process.argv.includes('--equivalence-only')?[]:['65efd8c','f799c63','working'].flatMap(v=>[0,20,34].map(d=>v+'@'+d))");
 runner=runner.replace("console.log('MEASURING',revision);",`const previousTarget=(await send('Target.getTargetInfo')).targetInfo.targetId;const freshTarget=await send('Target.createTarget',{url:'about:blank'},null);sid=(await send('Target.attachToTarget',{targetId:freshTarget.targetId,flatten:true},null)).sessionId;await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});await send('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});await send('Emulation.setCPUThrottlingRate',{rate:4});await send('Target.closeTarget',{targetId:previousTarget},null);await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/fixture'});for(let i=0;i<100;i++){if(await ev('!!window.V2'))break;await new Promise(r=>setTimeout(r,50));}if(sharedHistory){const input=JSON.parse(sharedHistory);input.wsOverdueSince=new Date(2026,10,13,14,20).getTime()-Number(revision.split('@')[1])*864e5;await ev('window.__speedSeed='+JSON.stringify(input)+';1');}console.log('MEASURING',revision);`);
 runner=runner.replace('state:JSON.stringify({staff:[],amUsed:true,amNx:{on:1,pre:{off:1}}})','state:JSON.stringify(window.__speedSeed||{staff:[],amUsed:true,amNx:{on:1,pre:{off:1}}})');
 runner=runner.replace("await ev('w.eval('+JSON.stringify('('+fixture.toString()+')()')+')');", "await ev('w.eval('+JSON.stringify('('+fixture.toString()+')('+revision.split('@')[1]+')')+')');");
 runner=runner.replace("await ev('w.eval('+JSON.stringify('('+fixture.toString()+')('+revision.split('@')[1]+')')+')');", "await ev('w.__RD=w.Date;w.eval('+JSON.stringify(fs.readFileSync(path.resolve(root,'../speed-records/prompt11-tools/eqlib.js'),'utf8'))+');w.eval('+JSON.stringify(fs.readFileSync(path.resolve(root,'../speed-records/prompt11-tools/splib.js'),'utf8'))+');w.__steadyHistory='+JSON.stringify(sharedHistory)+';w.eval('+JSON.stringify('('+tesFixture.toString()+')('+revision.split('@')[1]+')')+')');if(sharedHistory)await ev('(async()=>{w.amSave(false);await w.__v2.store.settle();return 1})()');");
 runner=runner.replace("html.get(revision)||", "html.get(revision.split('@')[0])||");
 runner=runner.replace('function fixture(){','function fixture(age){');
 runner=runner.replace('wsOverdueSince:now-864e5','wsOverdueSince:now-age*864e5');
 runner=runner.replace("renderMapView();\n if(action==='start')","if(typeof am5391Settle==='function')am5391Settle(now);renderMapView();\n if(action==='start')");
 runner=runner.replace("['name','row','start','finish','team','side','time','map']","['start','finish','team']");
 runner=runner.replace("'suite.json'", "'suite5393.json'");
 if(process.argv.includes('--control'))runner=runner.replace('}finally{child.kill();server.close();}', `}finally{
  console.log('CONTROL_READY',out);let lastCommand=null;
  for(;;){await new Promise(r=>setTimeout(r,500));const file=path.join(out,'command.json');if(!fs.existsSync(file))continue;const command=JSON.parse(fs.readFileSync(file,'utf8'));if(command.id===lastCommand)continue;lastCommand=command.id;if(command.code==='exit')break;try{const result=await eval('(async()=>{'+command.code+'})()');fs.writeFileSync(path.join(out,'command-'+command.id+'.json'),JSON.stringify({result}));console.log('CONTROL_DONE',command.id);}catch(e){console.error('CONTROL_FAILED',command.id,e.message);fs.writeFileSync(path.join(out,'command-'+command.id+'.json'),JSON.stringify({error:e.stack}));}}
  child.kill();server.close();}`);
 runner=runner.replace("const results={cpu:4,repeats:10,versions:{}};", `
 if(!process.argv.includes('--speed-only')){
 await send('Emulation.setCPUThrottlingRate',{rate:1});
 await send('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
 const comparisons=process.env.WS5393_BASELINE?[JSON.parse(fs.readFileSync(process.env.WS5393_BASELINE,'utf8'))]:[];
 for(revision of process.env.WS5393_BASELINE?['working']:['f799c63','working']){
  await ev(\`(async()=>{document.querySelector('iframe')?.remove();const f=document.createElement('iframe');f.style.cssText='position:fixed;inset:0;width:1024px;height:768px;border:0';document.body.append(f);await new Promise(r=>{f.onload=r;f.src='/v2/ws/index.html?embedded=1&mem=1&wait=1'});window.w=f.contentWindow;const store=new V2.Store({backend:new V2.MemoryCloud().device(),space:'equivalence',device:'synthetic',kv:new V2.MemKV(),snapshot:false});await w.__v2go({store,stores:[{id:'eq',name:'架空の店'}],current:'eq',state:JSON.stringify({staff:[],amUsed:true,amNx:{on:1,pre:{off:1}}})});})()\`);
  await new Promise(r=>setTimeout(r,1500));
  assert.equal(await ev('w.eval("APP_VERSION")'),revision==='working'?'5.39.3':'5.39.2');
  const eqlib=fs.readFileSync(path.resolve(root,'../speed-records/prompt11-tools/eqlib.js'),'utf8').replace('row.map = fp(mv.innerHTML);','row.map = fp(mv.innerHTML); row.mapRaw=mv.innerHTML;');
  await ev('w.eval('+JSON.stringify(eqlib)+')');
  const data=[];
  for(let seed=1;seed<=80;seed++){
   data.push(await ev('w.__probe('+seed+',new w.Date(2026,10,13,14).getTime(),'+JSON.stringify([[0,2,59],[0,3,0],[0,3,1],[0,9,59],[0,10,29],[0,11,1],[0,14,0],[0,18,45],[0,23,59],[1,2,31],[1,10,30],[3,12,0]].map(([d,h,m])=>new Date(2026,10,13+d,h,m).getTime()))+',true)'));
   if(seed%10===0)console.log('EQUIVALENCE',revision,seed);
  }
  comparisons.push(data);fs.writeFileSync(path.join(out,revision+'-equivalence.json'),JSON.stringify(data));
 }
 if(JSON.stringify(comparisons[1])!==JSON.stringify(comparisons[0])){console.error('EQUIVALENCE_FAILED: inspect external equivalence JSON');process.exitCode=1;}else console.log('EQUIVALENCE_PASS',960);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setCPUThrottlingRate',{rate:4});
 const results={cpu:4,repeats:10,versions:{}};
 // 普段の連続保存は、全ての版に同じ35日分の締め済み記録を渡す。--cold は履歴再投入の検査。
 let sharedHistory=null;
 if(!process.argv.includes('--cold')&&!process.argv.includes('--equivalence-only')){
  revision='f799c63';
  await ev(\`(async()=>{document.querySelector('iframe')?.remove();const f=document.createElement('iframe');document.body.append(f);await new Promise(r=>{f.onload=r;f.src='/v2/ws/index.html?embedded=1&mem=1&wait=1'});window.w=f.contentWindow;const store=new V2.Store({backend:new V2.MemoryCloud().device(),space:'history',device:'synthetic',kv:new V2.MemKV(),snapshot:false});await w.__v2go({store,stores:[{id:'history',name:'架空の店'}],current:'history',state:JSON.stringify({staff:[],amUsed:true,amNx:{on:1,pre:{off:1}}})});})()\`);
  await ev('w.__RD=w.Date;w.eval('+JSON.stringify(fs.readFileSync(path.resolve(root,'../speed-records/prompt11-tools/eqlib.js'),'utf8'))+');w.eval('+JSON.stringify(fs.readFileSync(path.resolve(root,'../speed-records/prompt11-tools/splib.js'),'utf8'))+');1');
  sharedHistory=await ev('w.eval("state=JSON.parse(__spInit);state.wsOverdueSince=__spNow-34*864e5;am5391Settle(__spNow);amLogPrune();JSON.stringify(state)")');
  fs.writeFileSync(path.join(out,'steady-history.json'),sharedHistory);
 }
 results.mode=sharedHistory?'settled-history':'cold-replay';`);
 new Function('require','__dirname','process','tesFixture',runner)(require,__dirname,process,tesFixture);
}
