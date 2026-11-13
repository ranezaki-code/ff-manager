'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),latest=fs.readFileSync(path.join(root,'ws/index.html'),'utf8'),old=cp.execFileSync('git',['show','ac802b4:ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});
function fn(name,s){const a=s.indexOf('function '+name+'(');assert.ok(a>=0,name);for(let b=s.indexOf('}',a);b>=0;b=s.indexOf('}',b+1)){const code=s.slice(a,b+1);try{new vm.Script(code);return code;}catch(_){}}throw Error(name);}
const spec=fs.readFileSync(path.join(__dirname,'ws5391.test.cjs'),'utf8'),contextCode=spec.slice(spec.indexOf('function context(){'),spec.indexOf('const at='));
function setup(source,age){
 const c=new Function('vm','fn',contextCode+'return context();')(vm,n=>fn(n,source));
 const now=new Date(2026,10,13,20).getTime(),iso=t=>new Date(t).toISOString();
 c.Date=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 c.now=now;c.state={staff:Array.from({length:25},(_,i)=>'synthetic-'+i),amUsed:true,wsOverdueSince:now-age*864e5,amRun:{}};
 c.works=Array.from({length:120},(_,i)=>({id:'synthetic'+i,name:i%12===0?'見本の鮮度管理':'見本の作業'+i,off:true,times:['10:00','14:00','18:30'],lead:30,grace:i%7===0?720:60,...(i%12===1?{wsOverdueKeep:true}:{})}));
 c.state.amWorks=c.works;c.state.amHist=[];
 for(const n of ['amLogKeys','amLogRange','amWorkSince','amSave','saveState'])vm.runInContext(fn(n,source),c);
 if(source===latest){c._am5392Forgot=null;for(const n of ['am5392ForgotIndex','am5392SlotsMemo','am5392DayMemo'])vm.runInContext(fn(n,source),c);}
 vm.runInContext(fn('amOffRecsOf',source),c);
 for(let d=0;d<35;d++){
  const t=now-d*864e5,day=c.amLogDay(t),rows={};
  for(let i=0;i<120;i++){const at=t-7*3600000;rows['record'+i]={w:'synthetic'+i,by:c.state.staff[i%25],at:iso(at),s:iso(at-600000),min:10,...(i%9===0?{wsPeople:c.state.staff.slice(0,3).map(n=>({n,s:iso(at-600000)}))}:{})};}
  // Some tasks have no completion, so real missed records must be generated.
  for(let i=2;i<120;i+=5)delete rows['record'+i];
  c.state['amLog_'+day]=rows;
 }
 const start=new Date(2026,10,13,18,35).getTime();c.state.amRun.team={w:'synthetic2',s:iso(start),wsPeople:c.state.staff.slice(0,3).map(n=>({n,s:iso(start)}))};
 c.amRunActive=()=>[{w:'synthetic2',s:start}];
 c._amNx={tab:null};c.STORAGE_KEY='ws_v1_store_synthetic';c.document={getElementById:()=>({textContent:''})};c.console=console;c._wsHasMeaningfulExisting=()=>false;c._wsLooksEmpty=()=>false;c._wsTrimAllIfNeeded=()=>{};
 const writes=[];c.localStorage={getItem:()=>null,setItem:(k,v)=>writes.push([k,v])};
 return {c,writes,now};
}
test('real settlement and localStorage/sync state are byte-identical: 35 days, 120 tasks, 25 synthetic staff',()=>{
 for(const age of [0.5,3,34]){
  const a=setup(old,age),b=setup(latest,age),before=JSON.stringify(a.c.state);
  for(const x of [a,b])vm.runInContext('amSave(false)',x.c);
  assert.equal(JSON.stringify(b.c.state),JSON.stringify(a.c.state));assert.deepEqual(b.writes,a.writes);assert.equal(a.writes.length,1);
  const misses=Object.values(a.c.state).flatMap(v=>v&&typeof v==='object'?Object.values(v):[]).filter(r=>r&&r.wsMissed===1);
  assert.ok(misses.length>0);assert.ok(misses.every(r=>!['synthetic0','synthetic1'].includes(r.w)));
  assert.notEqual(JSON.stringify(a.c.state),before);
  for(const x of [a,b]){const saved=JSON.stringify(x.c.state);vm.runInContext('amSave(false)',x.c);assert.equal(JSON.stringify(x.c.state),saved);}
  assert.deepEqual(b.writes,a.writes);
  // Feed the exact saved payload through the real shim's sync adapter.
  const shim=fs.readFileSync(path.join(__dirname,'wsshim.js'),'utf8');
  function sync(payload){const sent=[],c=vm.createContext({coll:{synced:true,setState:s=>sent.push(JSON.stringify(s))},LOCAL:/^unified_ui_am_roles$/,CREW:/^crew_v1/,KEY:()=> 'ws_v1_store_synthetic',cache:null,seen:null,stateStr:()=>payload});vm.runInContext(fn('setItem',shim),c);c.payload=payload;vm.runInContext("setItem('ws_v1_store_synthetic',payload)",c);return sent;}
  assert.deepEqual(sync(a.writes[0][1]),sync(b.writes[0][1]));assert.equal(sync(a.writes[0][1])[0],JSON.stringify(a.c.state));
 }
});
