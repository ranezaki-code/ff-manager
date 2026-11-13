'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'ws/index.html'),'utf8');
const old=cp.execFileSync('git',['show','ac802b4:ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});
function fn(name,s=source){const a=s.indexOf('function '+name+'(');assert.ok(a>=0,name);for(let b=s.indexOf('}',a);b>=0;b=s.indexOf('}',b+1)){try{new vm.Script(s.slice(a,b+1));return s.slice(a,b+1);}catch(_){}}throw Error(name);}
const reads=['amLogRange','amOffStatus','amOffRecsOf','am5391Rounds','am5391TimeSince','am539Crew','am539Duty','am539AllowedIds','am539Learn','am539Tracked','amOffSlots','amLogDay'];
test('drawing cache ends with each frame, separates argument identities, restores nested frames and exceptions',()=>{
 const c=vm.createContext({Map,Symbol,_am5392Forgot:null});vm.runInContext(fn('am5392Memo')+fn('am5392SlotsMemo')+fn('am5392DayMemo')+fn('am5392ReadFrame'),c);
 let n=0;const read=()=>++n;reads.forEach(name=>c[name]=read);
 const a={},b={};c.a=a;c.b=b;
 assert.equal(vm.runInContext('am5392ReadFrame(()=>{am539Crew(a);return am539Crew(a)})',c),1);
 assert.equal(vm.runInContext('am5392ReadFrame(()=>am539Crew(a))',c),2);
 assert.equal(vm.runInContext('am5392ReadFrame(()=>{am539Crew(a);return am539Crew(b)})',c),4);
 c.fail=()=>{throw Error('synthetic');};assert.throws(()=>vm.runInContext('am5392ReadFrame(()=>am5392ReadFrame(fail))',c),/synthetic/);
 reads.forEach(name=>assert.equal(c[name],read,name));
});
test('35-day settlement keeps exact records and reduces shared range reads from 4200 to 35',()=>{
 function run(s,fail=false){let calls=0;const c=vm.createContext({state:{unrelated:{keep:1}},Date,Map,AM_LOG_DAYS:35,AM_LOG_PRE:'amLog_',am5391Enabled:()=>true,amLogDay:n=>'day'+n,amLogRange:()=>{calls++;if(fail)throw Error('synthetic');return [];}});const original=c.amLogRange;
 c.am5391Missed=(day,now)=>{for(let i=0;i<120;i++)c.amLogRange(now-day.length,now);return [{id:'sample',w:'synthetic',miss:1,wsMissed:1}];};
 // Unique date keys produce one range per day, as the real calendar does.
 c.am5391Missed=(day,now)=>{const index=Number(day.slice(3));for(let i=0;i<120;i++)c.amLogRange(index,index+1);return [{id:'sample',w:'synthetic',miss:1,wsMissed:1}];};
 vm.runInContext(fn('am5391Settle',s),c);if(fail)assert.throws(()=>vm.runInContext('am5391Settle(9000000000)',c),/synthetic/);else vm.runInContext('am5391Settle(9000000000)',c);
 assert.equal(c.amLogRange,original);return {state:JSON.stringify(c.state),calls};}
 const a=run(old),b=run(source);assert.equal(a.state,b.state);assert.equal(a.calls,4200);assert.equal(b.calls,35);run(source,true);
});
test('round numbers and eligibility match the previous version, including equal and unordered times',()=>{
 for(let seed=0;seed<20;seed++){
 const slots=Array.from({length:16},(_,i)=>({s:((i*7+seed)%57)*3600000,o:((i*7+seed)%57)*3600000-1800000,e:((i*7+seed)%57)*3600000+3600000,re:i%7===0?1:0}));
 function run(s,only=''){const c=vm.createContext({only,Map,Date,Math,slots,w:{id:'synthetic',name:'見本'},am5391Enabled:()=>true,amIsTimed:()=>true,amIsRep:()=>false,amWorkSince:()=>0,am5391Since:()=>0,am5391TimeSince:()=>1000,amOffRecsOf:()=>[],_amChecksRead:()=>({}),am5391Slots:()=>slots,am5391Cut:(w,x,nx)=>nx?nx.s:Infinity,am5391Keep:()=>false,amLogDay:n=>String(Math.floor(n/864e5))});vm.runInContext(fn('am5391Rounds',s),c);return vm.runInContext('JSON.stringify(am5391Rounds(w,90000000,90000000,only).filter(x=>!only||x.day===only))',c);}
 for(const only of ['', '0','1','2'])assert.equal(run(source,only),run(old,only));}
});
test('settlement skips only days whose deadlines predate activation, including 12-hour grace and archived misses',()=>{
 const now=Date.UTC(2026,10,13,20),day=t=>new Date(t-3*3600000).toISOString().slice(0,10);
 for(const grace of [1,60,720])for(const days of [0,1,3,34,60]){
 const since=now-days*864e5,rounds=Array.from({length:36},(_,i)=>{const s=now-i*864e5-4*3600000;return {id:'sample'+i,w:'synthetic',s,e:s+grace*60000,end:s+14*3600000,miss:1,wsMissed:1};});
 function run(s){let visits=0;const state={unrelated:{keep:true},['amLog_'+day(now-30*864e5)]:{archived:{w:'synthetic',miss:1,wsMissed:1}}},c=vm.createContext({state,Date,Map,Math,AM_LOG_DAYS:35,AM_LOG_PRE:'amLog_',am5391Enabled:()=>true,am5391Since:()=>since,amWorks:()=>[{grace}],amIsTimed:()=>true,amOffGrace:w=>w.grace,amLogDay:day,amLogRange:()=>[]});
 c.am5391Missed=d=>{visits++;return rounds.filter(x=>day(x.s)===d&&x.e>since&&now>=x.end).concat(Object.entries(state['amLog_'+d]||{}).map(([id,r])=>({id,...r})));};
 vm.runInContext(fn('am5391Settle',s),c);vm.runInContext('am5391Settle('+now+')',c);return {state:JSON.stringify(state),visits};}
 const a=run(old),b=run(source);assert.equal(b.state,a.state);assert.ok(b.visits<=a.visits);if(days<3)assert.ok(b.visits<5);
 }
});
test('overdue prefilter preserves status across deadlines, early windows, freshness, completions and midnight',()=>{
 const spec=fs.readFileSync(path.join(__dirname,'ws5391.test.cjs'),'utf8'),contextCode=spec.slice(spec.indexOf('function context(){'),spec.indexOf('const at='));
 const c=new Function('vm','fn',contextCode+'return context();')(vm,fn);c.latest=c.amOffStatus;
 for(const grace of [5,60,720])for(const lead of [0,30,120])for(const keep of [false,true])for(const hour of [2,3,9,10,11,12,13,18,19,23])for(const completed of [false,true]){
 c.now=new Date(2026,10,13,hour,15).getTime();c.w={id:'synthetic',name:'見本',off:true,times:['02:00','10:00','12:00','18:30'],lead,grace,wsOverdueKeep:keep};c.works=[c.w];c.state.wsOverdueSince=new Date(2026,10,12,3).getTime();c.checks=completed?{synthetic:[{at:new Date(2026,10,13,10,20).toISOString(),by:'見本'}]}:{};
 vm.runInContext(fn('amOffStatus',old),c);const before=vm.runInContext('JSON.stringify(amOffStatus(w,now))',c);c.amOffStatus=c.latest;assert.equal(vm.runInContext('JSON.stringify(amOffStatus(w,now))',c),before);
 }
});
test('forgotten-round index matches full scans, ignores undone/after records and expires with the frame',()=>{
 const rows=Object.fromEntries(Array.from({length:120},(_,i)=>['r'+i,{w:i%3,s:new Date(100000+i*1000).toISOString(),nf:i%2,miss:i%4?1:0,u:i%7===0?1:0,af:i%11===0?1:0}]));
 rows.invalid={w:2,s:'invalid',nf:1,miss:1};const c=vm.createContext({Date,Map,state:{'amLog_2026-11-13':rows,unrelated:rows},_am5392Forgot:{index:null}});
 vm.runInContext(fn('am5392ForgotIndex')+fn('am5391Forgot')+fn('am5391Forgot',old).replace('function am5391Forgot(','function legacyForgot('),c);
 for(const w of [0,1,2,'2','absent',null])for(const from of [0,120000,170000,250000]){c.w=w;c.from=from;assert.equal(vm.runInContext('am5391Forgot(w,from,from+60000)',c),vm.runInContext('legacyForgot(w,from,from+60000)',c));}
 c.state['amLog_2026-11-13'].added={w:'new',s:new Date(10000).toISOString(),nf:1,miss:1};c._am5392Forgot={index:null};assert.equal(vm.runInContext('am5391Forgot("new",0,20000)',c),true);
});
test('identical calendars share date calculation without sharing mutable slots; rechecks bypass the cache',()=>{
 const spec=fs.readFileSync(path.join(__dirname,'ws5391.test.cjs'),'utf8'),contextCode=spec.slice(spec.indexOf('function context(){'),spec.indexOf('const at=')),c=new Function('vm','fn',contextCode+'return context();')(vm,fn);
 vm.runInContext(fn('am5392SlotsMemo'),c);c.original=c.amOffSlots;c.calls=0;vm.runInContext('cached=am5392SlotsMemo((...a)=>{calls++;return original(...a)})',c);
 const now=new Date(2026,10,13,12,20).getTime();c.now=now;c.a={id:'A',off:true,times:['10:00','18:30'],grace:60,lead:30};c.b={...c.a,id:'B'};
 vm.runInContext('first=cached(a,now);second=cached(b,now)',c);assert.equal(c.calls,1);assert.notEqual(c.first,c.second);assert.notEqual(c.first[0],c.second[0]);c.first[0].s=0;
 assert.equal(vm.runInContext('JSON.stringify(cached(b,now))',c),vm.runInContext('JSON.stringify(original(b,now))',c));
 for(const days of [null,[],[0,2,5]])for(const lead of [0,30,120])for(const grace of [5,60,720]){c.w={off:true,times:['02:00','10:00','18:30'],days,lead,grace};for(const time of [now,now+1800000,now+864e5]){c.time=time;assert.equal(vm.runInContext('JSON.stringify(cached(w,time))',c),vm.runInContext('JSON.stringify(original(w,time))',c));}}
 c.amRecheckMin=()=>15;c.amReSlots=(w,slots,rs)=>rs||[];const before=c.calls;c.rs=[{s:now,o:now,e:now+1000,re:1}];vm.runInContext('cached(a,now,rs);cached(a,now,[])',c);assert.equal(c.calls,before+2);
});
test('day formatting caches explicit timestamps but preserves live default-time reads',()=>{
 let calls=0,clock=100;const c=vm.createContext({Map,Number,read:ms=>{calls++;return ms||clock;}});vm.runInContext(fn('am5392DayMemo')+';cached=am5392DayMemo(read)',c);
 assert.equal(vm.runInContext('cached(123)',c),123);assert.equal(vm.runInContext('cached(123)',c),123);assert.equal(calls,1);
 assert.equal(vm.runInContext('cached(0)',c),100);clock=200;assert.equal(vm.runInContext('cached(0)',c),200);assert.equal(vm.runInContext('cached()',c),200);clock=300;assert.equal(vm.runInContext('cached()',c),300);assert.equal(calls,5);
});
test('all 18 inline scripts parse; UTF-8, LF, version and generated main remain correct',()=>{
 let count=0;for(const file of ['ws/index.html','v2/ws/index.html','v2/wstest.html']){const s=fs.readFileSync(path.join(root,file),'utf8');assert.ok(!s.includes('\r')&&!s.includes('\uFFFD'),file);for(const m of s.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(/src=/.test(m[1])||(/type=/.test(m[1])&&!/id="v2-main"/.test(m[1])))continue;const r=cp.spawnSync(process.execPath,['--check'],{input:m[2],encoding:'utf8'});assert.equal(r.status,0,r.stderr);count++;}}
 assert.equal(count,18);assert.match(source,/APP_VERSION = '5.39.2'/);
 const built=fs.readFileSync(path.join(root,'v2/ws/index.html'),'utf8').match(/<script type="text\/plain" id="v2-main">([\s\S]*?)<\/script>/)[1],main=source.match(/<script>\n('use strict';[\s\S]*?)<\/script>/)[1];
 const normalize=s=>s.replace(/^    if\(fromHub.*$/m,'    embedded navigation').replaceAll('../app.html?sys=ws','../index.html?sys=ws').trim();assert.equal(normalize(built),normalize(main));
});
