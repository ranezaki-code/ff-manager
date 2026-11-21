'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'ws/index.html'),'utf8');
const old=revision=>cp.execFileSync('git',['show',revision+':ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});
const run=(c,code)=>vm.runInContext(code,c);
function fn(name,s=source){
  const start=s.indexOf('function '+name+'('); assert.ok(start>=0,name);
  for(let end=s.indexOf('}',start);end>=0;end=s.indexOf('}',end+1)){
    const code=s.slice(start,end+1);
    try{new vm.Script(code);return code;}catch(e){if(!(e instanceof SyntaxError)) throw e;}
  }
  throw Error(name);
}
const now=new Date(2026,10,21,12).getTime(), day=86400000;
const iso=t=>new Date(t).toISOString();
const A='クルーA', B='クルーB';
function setup(s=source,enabled=true){
  const jobs=['late','future','running','left','after','restricted'].map(id=>({id,name:'作業 '+id,icon:'📋',permission:id==='restricted'}));
  const q=jobs.filter(w=>!['running','left'].includes(w.id)).map(w=>({id:w.id,w,name:w.name,k:w.id==='future'?'soon':'fire',due:now+day}));
  Object.assign(q[2],{id:'after#af@'+iso(now-day),af:{},o:{src:now-day}});
  const active=[{k:'r:one',w:'running',by:A}], long=[{k:'r:two',w:'left',by:B}];
  const state={amRun:{'r:one':active[0],'r:two':long[0]},amHere:{},areaChecks:{},amNx:{on:1}};
  const nodes=Object.fromEntries(['tab-handover','tab-handover-badge','ho-list'].map(id=>[id,{style:{}}]));
  const c=vm.createContext({state,q,active,long,nodes,present:[A],roster:[A,B],clock:now,tick:1000,saves:0,local:{},currentView:'handover',_amNx:{},AM_LOG_PRE:'amLog_',AM_LOG_DAYS:35,AM_HOLD_MS:500,
    document:{getElementById:id=>nodes[id],querySelector:()=>null},escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),amTr2:(en,ne)=>'<small>'+en+' / '+ne+'</small>',amHM:()=> '12:00',
    amNxOn:()=>c.on!==false,amFT:()=>c.tick,amNxQueue:()=>c.q,amRunActive:()=>c.active,amNxLongRuns:()=>c.long,amRunMap:()=>c.state.amRun,am539People:r=>[{n:r.by}],amRunMin:()=>30,amWork:id=>jobs.find(w=>w.id===id),amNxRunLabel:r=>({full:r.w,base:jobs.find(w=>w.id===r.w)}),amIsFreshLegacy:()=>false,
    amNxStaffOrd:x=>x,amNxHere:()=>c.present.map(n=>({n})),staffList:()=>c.roster,am539Restricted:w=>!!w?.permission,am539Allowed:(w,n)=>!w?.permission||n===B,amNxAv2:()=>'',amNxTrbNow:()=>({band:[]}),amNxGvNow:()=>({live:[]}),am5391Missed:()=>[],am5392ReadFrame:f=>f(),
    amDevId:()=> 'fixture', _amSheet:html=>{c.sheet=html;},amSheetName:()=>c.sheet?'handover':'',amCloseSheet:()=>{c.sheet='';},amSnack:(m,_,label,f)=>{c.undo=f;},_origSaveState:()=>{c.saves++;c.local.saved=JSON.stringify(c.state);},renderMapView:()=>run(c,'amHoRender()')});
  c.Date=class extends Date{static now(){return c.clock;}};
  const helpers=['amSave','amLogDay','amLogDayMs','amLogKeys','amLogRange','amLogSince','_amChecksRead','amAfRecs','amNxRid','amNxGvDue','amCkHash','amNxTrbDoneAfter','amLogRemove'];
  run(c,helpers.map(n=>fn(n,s)).join('\n')+'\n'+s.slice(s.indexOf('const AM_HO_LIST'),s.indexOf('/* バージョン表示を初期化 */')).replace('AM_HO_LIST = true','AM_HO_LIST = '+enabled));
  c.key='amLog_'+run(c,'amLogDay(clock)');
  return c;
}
const records=c=>Object.entries(c.state[c.key]||{}).filter(([id])=>id.startsWith('h'));
const tap=(c,code)=>{c.tick+=500;run(c,code);};
const choose=(c,value)=>tap(c,'amHoChoose('+JSON.stringify(value)+')');
const take=(c,kind,value)=>{c.tick+=300;tap(c,'amHoOpen("take",'+JSON.stringify(kind)+','+JSON.stringify(value)+')');};
function add(c,id,reason='mid',name){
  tap(c,'amHoOpen("add")');assert.match(c.sheet,/どの 作業/);
  choose(c,id);assert.match(c.sheet,/どうして/);choose(c,reason);
  if(name!==undefined){assert.match(c.sheet,/だれが 足す/);choose(c,name);}
}
const seed=(c,key,id,r)=>{c.state[key]={...c.state[key],[id]:r};};
const assertFields=(r,extras=[])=>assert.deepEqual(Object.keys(r).sort(),['h','w','t','by','d','y','to','src',...extras].sort());

test('97hb1 add late, upcoming, active, long and after, with deterministic IDs and tap counts',()=>{
  for(const [id,field,by] of [['late','o',A],['future','o',B],['running','rk',A],['left','rk',B],['after','o',A]]){
    const c=setup();if(id!=='late')c.present=[A,B];
    if(id==='after')c.present=[A];
    add(c,id==='after'?c.q[2].id:id,'mono',id==='future'?B:undefined);
    assert.equal(c.saves,1,id);const [[key,r]]=records(c);
    assertFields(r,id==='after'?['sa','o']:[field]);
    assert.equal(r.y,'mono');assert.equal(r.h,1);assert.equal(r.src,'add');assert.equal(r.to,'');assert.equal(r.by,by);
    assert.equal(key,field==='rk'?'h'+r.rk.replace(/[^0-9A-Za-z_]/g,''):'h'+run(c,'amCkHash('+JSON.stringify(r.w+'|'+r.o)+')'));
    if(id==='after'){assert.equal(r.w,'after#af');assert.equal(r.sa,iso(now-day));}
  }
});
test('97hb2 take pending and unfinished, permission, stable urgent queue and pin',()=>{
  const c=setup(), before=JSON.stringify(c.q); add(c,'future');
  const [id]=records(c)[0];take(c,'want',c.key+'|'+id);assert.equal(records(c).length,1);
  assert.equal(records(c)[0][1].ob,A);assert.equal(records(c)[0][1].ok,iso(now));
  const pinned=run(c,'amHoPin(q,clock)');assert.equal(pinned[0].id,'future');assert.match(pinned[0].handover,/クルーA から/);assert.equal(JSON.stringify(c.q),before);
  take(c,'long','r:two');const r=records(c).find(([i])=>i==='hrtwo')[1];assertFields(r,['rk','ok','ob']);assert.equal(r.src,'take');assert.equal(r.y,'');assert.equal(r.by,B);
  take(c,'late','late');assert.equal(records(c).find(([,r])=>r.w==='late')[1].by,'');
  c.present=[A,B];take(c,'late','restricted');assert.match(c.sheet,/クルーB/);assert.doesNotMatch(c.sheet,/クルーA/);choose(c,A);assert.equal(c.saves,4);choose(c,B);assert.equal(c.saves,5);
  const none=setup();none.roster=[A];take(none,'late','restricted');assert.match(none.sheet,/権限の ある 人が 受けます/);assert.doesNotMatch(none.sheet,/amHoChoose/);assert.equal(none.saves,0);
});
test('97hb3 undo keeps IDs, permits re-taking and allocates a new ID when adding again',()=>{
  const c=setup();add(c,'late');const [id]=records(c)[0];c.undo();assert.ok(records(c)[0][1].u);
  add(c,'late');assert.equal(records(c).length,2);const [again]=records(c)[1];assert.notEqual(again,id);
  take(c,'want',c.key+'|'+again);c.undo();const previously=records(c)[1][1];assert.ok(previously.ou>previously.ok);
  take(c,'want',c.key+'|'+again);assert.equal(records(c).length,2);assert.ok(records(c)[1][1].ok>previously.ou);
  take(c,'long','r:two');c.undo();assert.equal(records(c).length,3);assert.ok(records(c)[2][1].u&&records(c)[2][1].ou);
});
test('97hb4 day boundary, seventh and eighth days, completion and a minute of skew',()=>{
  const c=setup();const pending=t=>({h:1,w:'late',t:iso(t)}), key=t=>'amLog_'+run(c,'amLogDay('+t+')');
  const cut=new Date(2026,10,21,3).getTime();assert.notEqual(key(cut-60000),key(cut));assert.equal(key(cut),key(cut+60000));
  seed(c,key(now-6*day),'h7',pending(now-6*day));seed(c,key(now-7*day),'h8',pending(now-7*day));seed(c,c.key,'hFuture',pending(now+60000));
  assert.deepEqual(Array.from(run(c,'amHoRead(clock).want.map(x=>x.id)')),['h7']);
  c.state.areaChecks.late=[{at:iso(now-6*day-1)}];assert.equal(run(c,'amHoRead(clock).want.length'),1);
  c.state.areaChecks.late=[{at:iso(now-6*day+1)}];assert.equal(run(c,'amHoRead(clock).want.length'),0);assert.ok(c.state[key(now-7*day)].h8);
  seed(c,c.key,'hOk',{...pending(now-1),ok:iso(now+60000)});assert.ok(run(c,'amHoRead(clock).want.some(x=>x.id==="hOk")'));assert.equal(run(c,'amHoRead(clock).got.length'),0);
});
test('97hb5 render is pure and each action saves only the day record',()=>{
  const c=setup(),before=JSON.stringify(c.state);run(c,'amHoRender();amHoBadge(q,long);currentView="map";amHoRender();currentView="handover";amHoRender()');assert.equal(JSON.stringify(c.state),before);assert.deepEqual(c.local,{});
  add(c,'late');assert.equal(c.saves,1);const {[c.key]:bucket,...rest}=JSON.parse(c.local.saved);assert.equal(JSON.stringify(rest),before);assert.equal(Object.keys(bucket).length,1);
});
test('97hb6 completion history and urgent queue are unaffected',()=>{
  const c=setup();add(c,'late');assert.equal(run(c,'amLogRange(clock-1,clock+1).length'),0);assert.equal(run(c,'amLogSince(clock)'),null);
  assert.equal(fn('amNxQueue'),fn('amNxQueue',old('170c29f')));
});
test('97hb7 core merges concurrent additions, independent fields and an older save',()=>{
  const c=setup(),b=setup();b.amDevId=()=> 'other';b.clock+=1;add(c,'late');add(b,'late');
  const v=vm.createContext({window:{},console});vm.runInContext(fs.readFileSync(path.join(__dirname,'core.js'),'utf8'),v);
  const lost=[],merge=(base,mine,theirs)=>v.window.V2.merge3(base,mine,theirs,true,9,'',lost,false);
  const [id,r]=records(c)[0], joined=merge(undefined,c.state[c.key],b.state[b.key]);assert.deepEqual(Object.keys(joined),[id]);assert.deepEqual(lost.map(x=>x.path).sort(),[id+'.d',id+'.t']);
  lost.length=0;const ok={ok:iso(now+100),ob:B},u={u:iso(now+200)};
  const merged=merge(joined,{[id]:{...r,...ok}},{[id]:{...r,...u}});
  assert.equal(merged[id].ok,ok.ok);assert.equal(merged[id].ob,B);assert.equal(merged[id].u,u.u);assert.deepEqual(lost,[]);
  for(const revision of ['3a70166','170c29f']){
    const prior=old(revision);assert.equal(fn('saveState',prior),fn('saveState'));
    c.state[c.key]=merged;
    run(c,fn('amLogRange',prior));assert.equal(run(c,'amLogRange(clock-1,clock+1).length'),0);
    const saved=merge(joined,{...joined,legacy:{w:'future',at:iso(now)}},merged);
    assert.equal(saved[id].u,u.u);assert.equal(saved[id].ok,ok.ok);assert.ok(saved.legacy);
  }
});
test('97hb7 two MemoryCloud clients converge on a single day-log record',async()=>{
  const v=vm.createContext({window:{},console,setTimeout,clearTimeout,TextEncoder,crypto:require('node:crypto').webcrypto});
  for(const f of ['core.js','wsspec.js']) run(v,fs.readFileSync(path.join(__dirname,f),'utf8'));
  const V=v.window.V2, cloud=new V.MemoryCloud();
  const stores=['fixture-a','fixture-b'].map(device=>new V.Store({backend:cloud.device(),space:'handover',device,kv:new V.MemKV(),snapshot:false}));
  const cols=await Promise.all(stores.map(s=>s.open('ws~fixture','ws')));
  const read=i=>JSON.parse(JSON.stringify(cols[i].getState()));
  const settle=()=>Promise.all(stores.map(s=>s.settle()));
  try{
    const a=setup(), b=setup(); b.amDevId=()=> 'other';b.clock+=1;
    add(a,'late');add(b,'late');
    cols[0].setState(a.state);cols[1].setState(b.state);await settle();
    const [id,r]=Object.entries(read(0)[a.key])[0];
    assert.deepEqual(Object.keys(read(1)[a.key]),[id]);
    assert.deepEqual(read(0)[a.key],read(1)[a.key]);
    const x=read(0),y=read(1);
    x[a.key][id]={...r,ok:iso(now+6000),ob:B};y[a.key][id]={...r,u:iso(now+8000)};
    cols[0].setState(x);cols[1].setState(y);await settle();
    for(const i of [0,1]){
      const logs=read(i)[a.key];assert.equal(logs[id].ob,B);assert.equal(logs[id].u,iso(now+8000));assert.deepEqual(Object.keys(logs),[id]);
    }
    const oldState=read(1);oldState[a.key].legacy={w:'future',at:iso(now)};
    cols[1].setState(oldState);await settle();
    assert.deepEqual(read(0)[a.key],oldState[a.key]);
    assert.ok(Object.keys(cols[0].view()).includes('s:'+a.key));
  }finally{for(const store of stores) clearTimeout(store.flushT);}
});
test('97hb8 flag off never touches handover buckets or writes',()=>{
  const c=setup(source,false);Object.defineProperty(c.state,c.key,{get(){throw Error('read while disabled');}});
  run(c,'amHoMount();amHoRender();amHoBadge(q,long);amHoOpen("add");amHoRead(clock);amHoPin(q,clock)');assert.equal(c.saves,0);assert.equal(c.nodes['ho-list'].innerHTML,undefined);
});
test('97hb9 badge and tiles use global supplied rows and subtract accepted work',()=>{
  const c=setup();add(c,'late');const n=run(c,'amHoData(clock)');assert.equal(n.want.length,1);assert.equal(n.late.length,2);assert.equal(n.long.length,1);
  assert.equal(c.nodes['tab-handover-badge'].textContent,'4');assert.match(c.nodes['ho-list'].innerHTML,/data-ho-tile="want"[^]*?<b[^>]*>1<\/b>/);
  take(c,'want',c.key+'|'+records(c)[0][0]);assert.equal(c.nodes['tab-handover-badge'].textContent,'3');
});
test('97hb10 only rebuilds the changed bucket index; repeat pressing saves once',()=>{
  const c=setup();let scans=0;
  for(let i=0;i<7;i++){
    const key='amLog_'+run(c,'amLogDay('+(now-i*day)+')');
    c.state[key]=new Proxy(Object.fromEntries(Array.from({length:10},(_,n)=>['h'+n,{h:1,w:'task'+i+'_'+n,t:iso(now-i*day)}])),{ownKeys(o){scans++;return Reflect.ownKeys(o);}});
  }
  run(c,'for(let i=0;i<5;i++)amHoBadge(q,long)');assert.equal(scans,7);
  c.state[c.key]=new Proxy({}, {ownKeys(o){scans++;return Reflect.ownKeys(o);}});run(c,'amHoBadge(q,long)');assert.equal(scans,8);
  tap(c,'amHoOpen("add")');choose(c,'late');tap(c,'amHoChoose("mid");amHoChoose("mid")');assert.equal(c.saves,1);
});
test('97hb13 detects the six requested regressions',()=>{
  const mutations=[
    ["const r={h:1,w:x.w,t:","const r={h:1,at:new Date(now).toISOString(),w:x.w,t:",c=>{add(c,'late');assert.equal(run(c,'amLogRange(clock-1,clock+1).length'),0);}],
    ['  const stamp=new Date(Math.max(Date.now()','  amLogRemove(ref); return; const stamp=new Date(Math.max(Date.now()',c=>{add(c,'late');c.undo();assert.equal(records(c).length,1);}],
    ['(x.id<y.id?-1:x.id>y.id?1:0));','(x.id<y.id?-1:x.id>y.id?1:0)).reverse();',(_,s)=>assert.equal(fn('amNxQueue',s),fn('amNxQueue',old('170c29f')))],
    ["  amHoMount(); const view=document.getElementById('ho-list');","  state.extra=1; amHoMount(); const view=document.getElementById('ho-list');",c=>{const before=JSON.stringify(c.state);run(c,'amHoRender()');assert.equal(JSON.stringify(c.state),before);}],
    ['if(!entry||entry.bucket!==bucket){','if(true){',c=>{let scans=0;c.state[c.key]=new Proxy({}, {ownKeys(o){scans++;return Reflect.ownKeys(o);}});run(c,'amHoBadge(q,long);amHoBadge(q,long)');assert.equal(scans,1);}],
    ['if(!AM_HO_LIST) return [];\n  const keys','\n  const keys',c=>{Object.defineProperty(c.state,c.key,{get(){throw Error('read while disabled');}});run(c,'amHoRead(clock)');}]
  ];
  mutations.forEach(([from,to,check],i)=>{
    assert.ok(source.includes(from),from);const changed=source.replace(from,to),enabled=i!==5;
    check(setup(source,enabled),source);
    assert.throws(()=>check(setup(changed,enabled),changed),'mutation '+(i+1));
  });
});

test('97hb14 blocks the next row at 600ms and allows it at 800ms',()=>{
  const c=setup();
  take(c,'late','late');
  c.tick+=600;
  run(c,'amHoOpen("take","late",q[2].id)');
  assert.equal(c.saves,1);
  c.tick+=200;
  run(c,'amHoOpen("take","late",q[2].id)');
  assert.equal(c.saves,2);
});

test('97hb15 pending handovers show the date only for an earlier business day',()=>{
  const c=setup();
  const yesterday=now-day;
  seed(c,c.key,'htoday',{h:1,w:'late',t:iso(now),y:'time'});
  seed(c,'amLog_'+run(c,'amLogDay(clock-86400000)'),'hyesterday',{h:1,w:'future',t:iso(yesterday),y:'kikai'});
  run(c,'amHoRender()');
  const html=c.nodes['ho-list'].innerHTML;
  assert.match(html,/<wbr>11\/20 12:00/);
  assert.match(html,/<wbr>12:00/);
});

function morningSaves(s,enabled){
  const spec=fs.readFileSync(path.join(__dirname,'ws-settle-equivalence.test.cjs'),'utf8');
  const body=spec.slice(spec.indexOf('const spec='),spec.indexOf("test('real settlement"));
  const {c,writes}=new Function('fs','path','vm','fn','__dirname','latest',body+'return setup(latest,3);')(fs,path,vm,fn,__dirname,s);
  const helpers=['am5393Plan','amRunDoStart','amRunDoEnd','amRunDoEndOne','_amChecks','amNxTrbPut','amNxGvPut','amNxGvDue','amNxGvUndo','amLogRemove'];
  run(c,'const AM_HO_LIST='+enabled+';\n'+helpers.map(n=>fn(n,s)).join('\n'));
  c.Date=class extends Date{static now(){return c.now;}};
  c.now=new Date(2026,10,13,19,10).getTime();
  c.amRunActive=()=>[];
  c.amRunMap=c.amRunEdit=()=>c.state.amRun;
  c._amChecksRead=()=>c.state.areaChecks||{};
  Object.assign(c,{amDevId:()=> 'fixture',amRunOk:r=>!!r,amWork:id=>c.works.find(w=>w.id===id),amCkSettle:()=>{},amCkReq:()=>false,
    amNxTrbDef:y=>({y}),amNxItemOf:id=>({id}),amNxItemDone:()=>false,amNxTrbWho:()=>A,amNxTrbName:id=>id,amNxTrbQid:r=>r.w,
    amLogPrune:()=>{},amRepSettle:()=>{},amRunSettle:()=>{},amCloseSheet:()=>{},renderMapView:()=>{},amSnack:()=>{},amSheetName:()=>'',amNxGvList:()=>{}});
  const added={h:1,w:'synthetic2',t:iso(c.now),d:'other',src:'add'};
  const key='amLog_'+run(c,'amLogDay(now)');
  seed(c,key,'hmorning',added);
  c.now=new Date(2026,10,14,3,5).getTime();
  const save=(action,verify)=>{
    const count=writes.length;
    run(c,action);
    assert.equal(writes.length,count+1);
    const stored=JSON.parse(writes.at(-1)[1]);
    assert.deepEqual(stored[key].hmorning,added);
    verify(stored);
  };
  save('amSave(false)',st=>assert.ok(Object.values(st[key]).some(r=>r.wsMissed===1)));
  const next='amLog_'+run(c,'amLogDay(now)');
  save('mark=amRunDoStart("synthetic2","",now);amSave(false)',st=>assert.ok(st.amRun[c.mark]));
  save('now+=60000;amRunDoEnd(mark,now);amSave(false)',st=>assert.ok(Object.values(st[next]).some(r=>r.w==='synthetic2'&&r.at)));
  save('_amNx.trbSrc={id:"synthetic3"};amNxTrbPut("te")',st=>assert.ok(Object.values(st[next]).some(r=>r.p===1)));
  save('ref=amNxGvPut({id:"synthetic4"},"time","",now);amSave(false)',st=>assert.equal(st[next][c.ref.id].g,1));
  save('amNxGvUndo(ref.key,ref.id)',st=>assert.ok(st[next][c.ref.id].u));
}

for(const enabled of [true,false]){
  test('97hb16 five saves after the morning settle with AM_HO_LIST='+enabled,()=>{
    morningSaves(source,enabled);
    const fixed="Object.keys(state[k]).filter(id=>id[0]!=='h').map(id=>[k+'|'+id,rows.get(k+'|'+id)])";
    assert.ok(source.includes(fixed));
    const broken=source.replace(fixed,"Object.keys(state[k]).map(id=>[k+'|'+id,rows.get(k+'|'+id)])");
    assert.throws(()=>morningSaves(broken,enabled),/Cannot read properties of undefined/);
  });
}