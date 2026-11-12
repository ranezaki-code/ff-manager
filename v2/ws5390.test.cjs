'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'ws/index.html'),'utf8');
function fn(name){
  const a=source.indexOf('function '+name+'(');assert.ok(a>=0,name);
  for(let b=source.indexOf('}',a);b>=0;b=source.indexOf('}',b+1)){
    const code=(source.slice(a-6,a)==='async '?'async ':'')+source.slice(a,b+1);try{new vm.Script(code);return code;}catch(_){}
  }throw Error(name);
}
const names=['テストあ','テストい','テストう','テストえ'];
function context(){
  const crew={members:names.map((name,i)=>({id:'m'+i,name})),ranks:{m0:{rank:'leader'},m1:{rank:'regular'},m2:{rank:'rookie'}}};
  const boxes={crew:JSON.stringify(crew),duty:JSON.stringify({assignments:{clean:[names[1]]}})},state={amRun:{},staff:names,gameProfiles:Object.fromEntries(names.map((n,i)=>[n,{monthlyEarned:i===0?600:0,points:0,totalEarned:0,totalCompleted:0}])),wsDuties:{assignments:{clean:[names[1]]}}};
  const ctx=vm.createContext({state,CREW_KEY:'crew',_STORE_ID:'',_am539CrewMemory:null,_crewRosterCache:{},isAdmin:false,AM_NX_HOLD:2,AM_LOG_PRE:'amLog_',_amNx:{ctrOk:{}},location:{search:''},Date,Set,JSON,Math,RANKS:[{id:'gold',name:'ゴールド'},{id:'bronze',name:'ブロンズ'}],getRank:n=>({current:{id:n>=500?'gold':'bronze'}}),DEFAULT_GAME_SETTINGS:{pointsBase:2},
    localStorage:{getItem:k=>boxes[k==='bumon_v1'?'duty':k]||null,setItem:(k,v)=>boxes[k]=v},sessionStorage:{getItem:()=>ctx.actor||names[0]},
    escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll("'",'&#39;'),amNxAv2:()=>'<i></i>',amNxAv:()=>'<i></i>',amNxLongRuns:()=>[],
    amRunMap:()=>state.amRun,amRunEdit:()=>state.amRun,amRunOk:r=>!!r?.w,amWork:id=>ctx.works.find(w=>w.id===id),amWorksEdit:()=>ctx.works,amWorks:()=>ctx.works.length?ctx.works:(ctx.rows||[]).map(x=>x.w),
    amNxRunLabel:r=>({base:ctx.works.find(w=>w.id===r.w)}),amRunActive:()=>Object.entries(state.amRun).map(([k,r])=>({...r,k})),
    amSave:()=>{},amCloseSheet:()=>{},renderMapView:()=>{},amSnack:()=>{},amNxPut:()=>{},amDevId:()=>'test-device',amLogDay:()=> '2026-11-12',amCkHash:s=>Buffer.from(s).toString('hex'),amPreNeed:()=>false,amGoalOf:w=>w?.goal||0,getOrCreateProfile:n=>{const a=state.gameProfiles||(state.gameProfiles={});return a[n]?.points!==undefined?a[n]:(a[n]={points:0,totalEarned:0,monthlyEarned:0,totalCompleted:0,currentMonth:'2026-11'});},rolloverMonthlyRank:()=>{},
    amCtrOf:w=>({v:w?.ctr||''}),amNxCut:()=>0,amNxHere:()=>ctx.here||[],amNxRowNums:rs=>rs.map((_,i)=>i+1),
    amNxSlot:()=>null,amNxRowHtml:(x,n)=>'<button data-task="'+x.id+'">'+n+'</button>',amNxOpenHtml:()=>'',works:[],actor:names[0],boxes});
  const funcs=['am539RosterRead','am539Ranks','am539Resolve','am539AllowedIds','am539PermSave','am539RosterReview','am539RosterMissing','am539Tracked','am539EventId','am539TeamState','am539TeamEvent','amNxPkBtn','am539Crew','am539Duty','am539Permission','am539Restricted','am539Allowed','am539Learn','am539Practice','am539Actor','am539CanLearn','am539LearnPut','am539People','am539PeopleHtml','am539NameButton','am539Why','am539TeamChange','am539LeaveRecord','am539Credit','am539CreditUndo','am539DutyChoices','am539Side','am539Counts','am539Columns','amNxHoldMap','amNxCtrCheck'];
  funcs.forEach(n=>vm.runInContext(fn(n),ctx));return ctx;
}
const run=(c,code)=>vm.runInContext(code,c);
test('permission: multiple ranks, duties and names are OR; old work remains open',()=>{
  const c=context();c.w={id:'w',wsPermission:{ranks:['leader','rookie'],duties:['clean'],members:['name:'+names[2],'name:'+names[3]]}};
  assert.equal(run(c,'am539Allowed({id:"old"},"unknown")'),true);
  for(const n of names){c.n=n;assert.equal(run(c,'am539Allowed(w,n)'),true);}
  c.w.wsPermission={ranks:['leader'],duties:[],members:[]};c.n=names[2];assert.equal(run(c,'am539Allowed(w,n)'),false);
  assert.match(run(c,'am539NameButton(w,n,"start()")'),/disabled/);
  assert.match(run(c,'am539NameButton(w,n,"start()")'),/🔒 権限が ありません/);
  assert.match(run(c,'am539Why(w)'),/できる人/);
});
test('learning: manager and authorized person, undo only author or manager, append-only and unrelated fields preserved',()=>{
  const c=context();c.w={id:'w',wsTraining:true,wsPermission:{ranks:['leader'],duties:[],members:[]}};c.works=[c.w];c.n=names[1];
  const original=JSON.parse(c.boxes.crew);original.extra={keep:true};c.boxes.crew=JSON.stringify(original);
  assert.equal(run(c,'am539Practice(w,n)'),true);assert.match(run(c,'am539PeopleHtml({by:n,s:new Date().toISOString()},w)'),/近く|手順/);
  c.actor=names[2];assert.equal(run(c,'am539LearnPut("w",n)'),false);
  c.actor=names[0];assert.equal(run(c,'am539LearnPut("w",n)'),true);assert.equal(run(c,'am539Practice(w,n)'),false);
  c.actor=names[2];assert.equal(run(c,'am539LearnPut("w",n,true)'),false);
  c.actor=names[0];assert.equal(run(c,'am539LearnPut("w",n,true)'),true);
  const saved=JSON.parse(c.boxes.crew);assert.deepEqual(saved.extra,{keep:true});assert.equal(Object.keys(c.state.wsLearning).length,2);assert.equal(c.boxes.crew,JSON.stringify(original));
  c.isAdmin=true;c.actor='';assert.equal(run(c,'am539LearnPut("w",n)'),true);assert.equal(Object.keys(c.state.wsLearning).length,3);
});
test('three participants maximum, all holds and lane counts; leaving affects only current person and retains time',()=>{
  const c=context();c.works=[{id:'w',ctr:'in'}];c.state.amRun.k={w:'w',by:names[0],s:new Date(Date.now()-600000).toISOString()};
  c.n=names[1];assert.equal(run(c,'am539TeamChange("k","join",n)'),true);c.n=names[2];assert.equal(run(c,'am539TeamChange("k","join",n)'),true);
  c.n=names[3];assert.equal(run(c,'am539TeamChange("k","join",n)'),false);assert.equal(run(c,'am539Counts().in'),3);
  assert.equal(run(c,'amNxHoldMap()[am539People(state.amRun.k)[1].n]'),1);assert.equal(Object.keys(c.state.amRun).length,1);
  c.n=names[1];assert.equal(run(c,'am539TeamChange("k","leave",n)'),false);
  c.actor=names[1];assert.equal(run(c,'am539TeamChange("k","leave",n)'),true);assert.equal(run(c,'am539People(state.amRun.k).length'),2);
  const credit=Object.values(c.state['amLog_2026-11-12'])[0];assert.equal(credit.by,names[1]);assert.equal(credit.wsLeft,1);assert.ok(credit.minutes>=0&&credit.minutes<1);
});
test('completion: every person gets equal time and points, one completion for round counters',()=>{
  const c=context();c.works=[{id:'w',points:7}];const checks={w:[]};c._amChecks=()=>checks;c.amCkSettle=()=>{};c.amCkReq=()=>false;
  c.state.amRun.k={w:'w',by:names[0],s:'2026-11-12T01:00:00.000Z',wsPeople:names.slice(0,3).map(n=>({n,s:'2026-11-12T01:00:00.000Z'}))};
  vm.runInContext(fn('amRunDoEndOne')+'\n'+fn('amRunDoEnd'),c);
  const result=run(c,'amRunDoEnd("k",Date.parse("2026-11-12T01:20:00Z"))');assert.equal(result.team.length,3);
  const rows=Object.values(c.state['amLog_2026-11-12']);assert.equal(rows.length,3);assert.equal(rows.filter(r=>!r.miss).length,1);assert.equal(checks.w.length,1);
  assert.deepEqual(rows.map(r=>r.by).sort(),names.slice(0,3).sort());assert.ok(rows.every(r=>r.s===rows[0].s&&r.at===rows[0].at&&r.wsPoints===0));assert.equal(Object.keys(c.state.amRun).length,0);assert.deepEqual(names.slice(0,3).map(n=>c.state.gameProfiles[n].points),[0,0,0]);
});
test('two columns, both once per column, unknown only inside; no reads mutate old state or crew',()=>{
  const c=context();const before=JSON.stringify([c.state,c.boxes]);c.rows=['in','out','both','unknown'].map(ctr=>({id:ctr,w:{id:ctr,ctr:ctr==='unknown'?'':ctr}}));
  const html=run(c,'am539Columns(rows,rows,[],{},Date.now(),null)');assert.equal((html.match(/data-task="both"/g)||[]).length,2);assert.equal((html.match(/data-task="unknown"/g)||[]).length,1);
  assert.match(html,/決まっていない/);assert.match(html,/role="tab"/);assert.equal(JSON.stringify([c.state,c.boxes]),before);
  assert.match(source,/@media\(max-width:620px\)/);assert.match(source,/\.ws539-columns\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});
test('unassigned store keeps one legacy list even with inferred outside badges',()=>{const c=context();c.rows=[{id:'a',w:{id:'a'}},{id:'b',w:{id:'b'}}];c.amCtrOf=()=>({v:'out',est:true});const html=run(c,'am539Columns(rows,rows,[],{},Date.now(),null)');assert.equal(html.includes('ws539-columns'),false);assert.match(html,/data-task="a">1/);assert.match(html,/data-task="b">2/);});
test('team undo removes every credit and restores the single run, preserving later point changes',()=>{
  const c=context();c.works=[{id:'w',points:5}];const checks={w:[]};c._amChecks=()=>checks;c.amCkSettle=()=>{};c.amCkReq=()=>false;
  c.state.amRun.k={w:'w',by:names[0],s:'2026-11-12T01:00:00Z',wsPeople:names.slice(0,2).map(n=>({n,s:'2026-11-12T01:00:00Z'}))};
  vm.runInContext(fn('amRunDoEndOne')+'\n'+fn('amRunDoEnd')+'\n'+fn('amRunUndo'),c);
  const x=run(c,'amRunDoEnd("k",Date.parse("2026-11-12T01:20:00Z"))');c._amUndo={id:'w',at:x.rec.at,log:x.lg,team:x.team,run:{k:'k',r:x.run}};
  c.state.gameProfiles[names[0]].points+=2;
  c.amLogRemove=ref=>{delete c.state[ref.key][ref.id];return true;};c.amNxOn=()=>true;
  run(c,'amRunUndo()');assert.equal(Object.keys(c.state['amLog_2026-11-12']).length,0);assert.equal(c.state.amRun.k.wsPeople.length,2);
  assert.equal(c.state.gameProfiles[names[0]].points,2);assert.equal(c.state.gameProfiles[names[1]].points,0);assert.equal(checks.w.length,0);
});
test('practice line names the trained helper; unconfigured legacy work has no practice flag',()=>{
  const c=context();c.w={id:'w',wsTraining:true};c.works=[c.w];c.isAdmin=true;c.n=names[0];assert.equal(run(c,'am539LearnPut("w",n)'),true);
  c.r={w:'w',by:names[0],s:new Date().toISOString(),wsPeople:names.slice(0,2).map(n=>({n,s:new Date().toISOString()}))};
  const html=run(c,'am539PeopleHtml(r,w)');assert.match(html,/テストいさんは 練習中です。テストあさん、近くで見てあげてください/);
  assert.equal(run(c,'am539Practice({id:"old"},"テストい")'),false);
});
test('register warning only on transition to zero inside, no repeat or work-blocking answer',()=>{
  const c=context();c.works=[{id:'out',ctr:'out'},{id:'in',ctr:'in'}];c.it={w:c.works[0]};c.n=names[1];
  c.state.amRun.k={w:'out',by:names[0],s:new Date().toISOString()};c.here=[{n:names[0],at:1},{n:names[1],at:1}];
  const warning=run(c,'amNxCtrCheck(it,n,Date.now())');assert.ok(warning);c._amNx.ctrOk[warning.key]=1;assert.equal(run(c,'amNxCtrCheck(it,n,Date.now())'),null);
  c._amNx.ctrOk={};c.here.push({n:names[2],at:1});assert.equal(run(c,'amNxCtrCheck(it,n,Date.now())'),null);
  c.it={w:c.works[1]};assert.equal(run(c,'amNxCtrCheck(it,n,Date.now())'),null);
  assert.ok(fn('amNxGo').indexOf('m[k]=')<fn('amNxGo').indexOf('if(counterNotice) amNxCtrAsk'));
  assert.doesNotMatch(fn('amNxCtrAns'),/amNxGo|amRunCancel/);
});

test('two real v2 memory devices: concurrent learning and joins survive merge and legacy save',async()=>{
 const v=vm.createContext({window:{},console,setTimeout,clearTimeout,Date,Math,JSON,TextEncoder,crypto:require('node:crypto').webcrypto});
 for(const f of ['core.js','wsspec.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),v);
 const V=v.window.V2,cloud=new V.MemoryCloud();
 const stores=['A','B','old'].map(device=>new V.Store({backend:cloud.device(),space:'test539',device,kv:new V.MemKV(),snapshot:false}));
 const cols=await Promise.all(stores.map(s=>s.open('ws~synthetic','ws')));
 const settle=async()=>{for(let i=0;i<3;i++){await Promise.all(stores.map(s=>s.settle()));await new Promise(r=>setTimeout(r,30));}};
 const c=context(),d=context();c.works=d.works=[{id:'w'}];c.isAdmin=d.isAdmin=true;
 c.state.amRun.k={w:'w',by:names[0],s:new Date().toISOString()};cols[0].setState(c.state);await settle();
 for(const [ctx,col] of [[c,cols[0]],[d,cols[1]]]){const st=col.getState();Object.keys(ctx.state).forEach(k=>delete ctx.state[k]);Object.assign(ctx.state,st);}
 const legacy=cols[2].getState();stores[2].be.setOnline(false);stores[0].be.setOnline(false);stores[1].be.setOnline(false);
 c.n=names[1];d.n=names[2];assert.equal(run(c,'am539LearnPut("w",n)'),true);assert.equal(run(d,'am539LearnPut("w",n)'),true);
 assert.equal(run(c,'am539TeamChange("k","join",n)'),true);assert.equal(run(d,'am539TeamChange("k","join",n)'),true);
 cols[0].setState(c.state);cols[1].setState(d.state);stores[0].be.setOnline(true);stores[1].be.setOnline(true);await settle();
 for(const col of cols.slice(0,2)){const st=col.getState();assert.equal(Object.keys(st.wsLearning).length,2);Object.keys(d.state).forEach(k=>delete d.state[k]);Object.assign(d.state,st);assert.equal(run(d,'am539People(state.amRun.k).length'),3);}
 const st=cols[0].getState();Object.keys(c.state).forEach(k=>delete c.state[k]);Object.assign(c.state,st);c.n=names[1];assert.equal(run(c,'am539LearnPut("w",n,true)'),true);cols[0].setState(c.state);await settle();
 for(const col of cols.slice(0,2))assert.equal(Object.values(col.getState().wsLearning).filter(x=>x.action==='undo').length,1);
 legacy.staffOrder=names.slice().reverse();cols[2].setState(legacy);stores[2].be.setOnline(true);await settle();
 for(const col of cols){assert.equal(Object.keys(col.getState().wsLearning).length,3);assert.equal(Object.keys(col.getState().amRun.k.wsTeamEvents).length,2);}
 for(const store of stores)clearTimeout(store.flushT);
});
test('missing local roster is irrelevant; missing synchronized duty data is manager-only',()=>{
 const a=context(),b=context();b.boxes.crew=null;a.w={id:'w'};a.p={ranks:['leader'],duties:[],members:[]};assert.equal(run(a,'am539PermSave(w,p)'),true);b.w=JSON.parse(JSON.stringify(a.w));
 for(const n of names){a.n=b.n=n;assert.equal(run(a,'am539Allowed(w,n)'),run(b,'am539Allowed(w,n)'));}
 b.w.wsPermission={duties:['missing']};b.boxes.duty=null;assert.equal(run(b,'am539RosterMissing(w)'),true);assert.equal(run(b,'am539Allowed(w,"any")'),false);b.isAdmin=true;assert.equal(run(b,'am539Allowed(w,"any")'),true);
});
test('overflow keeps all join events and deterministically reports fourth participant',()=>{
 const c=context();c.r={by:names[0],s:'2026-11-12T01:00:00Z',wsTeamEvents:Object.fromEntries(names.slice(1).map((n,i)=>['e'+i,{id:'e'+i,action:'join',n,at:'2026-11-12T01:01:00Z'}]))};
 assert.equal(run(c,'am539People(r).length'),3);assert.equal(run(c,'am539TeamState(r).rejected[0]'),names[3]);assert.equal(Object.keys(c.r.wsTeamEvents).length,3);
});

test('solo completion uses same default points as team and serializes without a cycle',()=>{
 const old=require('node:child_process').execFileSync('git',['show','3933277:ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});let oldFn='';const at=old.indexOf('function amRunDoEnd(');for(let i=old.indexOf('}',at);i>=0;i=old.indexOf('}',i+1)){const code=old.slice(at,i+1);try{new vm.Script(code);oldFn=code;break;}catch(_){}}assert.ok(oldFn);
 const legacy=context();legacy.works=[{id:'w'}];legacy._amChecks=()=>({w:[]});legacy.amCkSettle=()=>{};legacy.amCkReq=()=>false;legacy.state.amRun.k={w:'w',by:names[0],s:'2026-11-12T01:00:00Z'};vm.runInContext(oldFn.replace('function amRunDoEnd(','function am5384End('),legacy);run(legacy,'am5384End("k",Date.parse("2026-11-12T01:02:00Z"))');assert.equal(legacy.state.gameProfiles[names[0]].points,0);
 const c=context();c.works=[{id:'w'}];const checks={w:[]};c._amChecks=()=>checks;c.amCkSettle=()=>{};c.amCkReq=()=>false;
 vm.runInContext(fn('amRunDoEndOne')+'\n'+fn('amRunDoEnd'),c);
 c.state.amRun.k={w:'w',by:names[0],s:new Date(Date.now()-120000).toISOString()};
 const solo=run(c,'amRunDoEnd("k",Date.now())');assert.doesNotThrow(()=>JSON.stringify(solo));assert.equal(c.state.gameProfiles[names[0]].points,0);const row=Object.values(c.state['amLog_2026-11-12'])[0];assert.equal('wsAward' in row,false);assert.equal('wsPoints' in row,false);c.row=row;run(c,'am539CreditUndo(row)');assert.equal(c.state.gameProfiles[names[0]].points,0);
 c.state.amRun.k2={w:'w',by:names[1],s:new Date(Date.now()-120000).toISOString(),wsPeople:names.slice(1,3).map(n=>({n,s:new Date(Date.now()-120000).toISOString()}))};
 const team=run(c,'amRunDoEnd("k2",Date.now())');assert.doesNotThrow(()=>JSON.stringify(team));assert.equal(c.state.gameProfiles[names[1]].points,0);assert.equal(c.state.gameProfiles[names[2]].points,0);
});

test('full team button says three; one-person register warning has one self answer',()=>{
 const c=context();c.works=[{id:'w'}];c.r={k:'k',w:'w',by:names[0],s:new Date().toISOString(),wsPeople:names.slice(0,3).map(n=>({n,s:new Date().toISOString()}))};
 vm.runInContext(fn('am539LearningHtml')+'\n'+fn('am539TeamActions')+'\n'+fn('amNxCtrAsk'),c);
 assert.match(run(c,'am539TeamActions(r)'),/disabled[^>]*>いっぱい（3人）/);assert.doesNotMatch(run(c,'am539TeamActions(r)'),/一緒にやる（4人目）/);
 c._amSheet=html=>c.sheet=html;run(c,'amNxCtrAsk("w","test-a",{key:"one",other:"test-a"})');assert.equal((c.sheet.match(/test-a が見る/g)||[]).length,1);
});

test('saved permission uses crew ranks and duties on rosterless devices, ignoring points; explicit names always work',()=>{
 const a=context(),b=context();a.w={id:'w'};a.p={ranks:['leader'],duties:['clean'],members:['m2']};
 assert.equal(run(a,'am539PermSave(w,p)'),true);assert.deepEqual(Array.from(a.w.wsPermission.allowed),names.slice(0,3).map(n=>'name:'+n));
 b.boxes.crew=b.boxes.duty=null;b.w=JSON.parse(JSON.stringify(a.w));delete b.state.gameProfiles[names[0]];b.state.gameProfiles[names[3]].monthlyEarned=999999;
 for(const n of names){a.n=b.n=n;assert.equal(run(a,'am539Allowed(w,n)'),run(b,'am539Allowed(w,n)'));}
 b.w={wsPermission:{ranks:['leader'],members:['name:'+names[2]]}};b.n=names[2];assert.equal(run(b,'am539Allowed(w,n)'),true);
});
test('settings count equals stored allowed even for manager; roster change asks and only accepted change saves',()=>{
 const c=context();c.w={id:'w',name:'見本'};c.p={ranks:['leader'],duties:[],members:[]};run(c,'am539PermSave(w,p)');c.works=[c.w];c.amWorks=()=>c.works;c.isAdmin=true;
 c._amSheet=h=>c.sheet=h;c.am539LearningHtml=()=>'';vm.runInContext(fn('am539Settings'),c);run(c,'am539Settings("w")');assert.match(c.sheet,/いま選べる人：1人（テストあ）/);assert.match(c.sheet,/店長（いつでも）/);assert.doesNotMatch(c.sheet,/ゴールド/);
 const crew=JSON.parse(c.boxes.crew);crew.ranks.m1.rank='leader';c.boxes.crew=JSON.stringify(crew);let prompts=0,saves=0;c.confirm=msg=>{prompts++;assert.match(msg,/テストいさんが増える/);return false;};c.amSave=()=>saves++;
 const before=JSON.stringify(c.w);run(c,'am539RosterReview()');assert.equal(JSON.stringify(c.w),before);assert.equal(prompts,1);assert.equal(saves,0);
 c._amNx.permSeen={};c.confirm=()=>true;run(c,'am539RosterReview()');assert.equal(saves,1);assert.deepEqual(Array.from(c.w.wsPermission.allowed),names.slice(0,2).map(n=>'name:'+n));
});
test('estimated outside uses the existing badge classifier; register warning remains explicit only',()=>{
 const c=context();c.amCtrOf=w=>({v:w.ctr||(/店外/.test(w.name)?'out':'')});c.amWorks=()=>[{id:'configured',ctr:'in'}];c.rows=[{id:'estimate',w:{name:'店外の点検'}}];
 assert.equal(run(c,'am539Side(rows[0].w)'), 'out');const html=run(c,'am539Columns(rows,rows,[],{},Date.now(),null)');assert.match(html,/class="ws539-column out[^]*data-task="estimate"/);
 assert.match(fn('amNxCtrCheck'),/.ctr/);
});
test('two v2 devices compete for last seat in server transaction order with skewed clocks and no provisional success',async()=>{
 const v=vm.createContext({window:{},console,setTimeout,clearTimeout,Date,Math,JSON,TextEncoder,crypto:require('node:crypto').webcrypto});for(const f of ['core.js','wsspec.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),v);
 const V=v.window.V2,cloud=new V.MemoryCloud(),stores=['A','B'].map(device=>new V.Store({backend:cloud.device(),space:'join539',device,kv:new V.MemKV(),snapshot:false}));const cols=await Promise.all(stores.map(st=>st.open('ws~test','ws')));
 const a=context(),b=context(),base={w:'w',by:names[0],s:'2026-11-12T01:00:00Z',wsPeople:names.slice(0,2).map(n=>({n,s:'2026-11-12T01:00:00Z'}))};a.state.amRun.k=base;cols[0].setState(a.state);await stores[0].settle();await new Promise(r=>setTimeout(r,50));
 const notices=[[],[]];for(const [i,c] of [a,b].entries()){Object.assign(c.state,JSON.parse(JSON.stringify(cols[0].getState())));c.works=[{id:'w'}];c.window={__v2:{store:stores[i],coll:cols[i]}};c.amSave=()=>cols[i].setState(c.state);c.amSnack=m=>notices[i].push(m);c.Date=class extends Date{static now(){return Date.now()+(i?-86400000:86400000);}};vm.runInContext(fn('am539TeamCommit'),c);}
 a.n=names[2];b.n=names[3];const result=await Promise.all([run(a,'am539TeamChange("k","join",n)'),run(b,'am539TeamChange("k","join",n)')]);assert.deepEqual(result,[true,false]);assert.ok(notices[0].at(-1).includes('入れました'));assert.ok(notices[1].every(m=>!m.includes('入れました')));
 await Promise.all(stores.map(st=>st.settle()));await new Promise(r=>setTimeout(r,80));for(const col of cols){b.state.amRun=col.getState().amRun;assert.deepEqual(Array.from(run(b,'am539People(state.amRun.k).map(p=>p.n)')),names.slice(0,3));}for(const n of names.slice(0,3)){a.actor=a.n=n;a.state.amRun=JSON.parse(JSON.stringify(cols[0].getState().amRun));assert.equal(await run(a,'am539TeamChange("k","leave",n)'),true);}assert.equal(Object.keys(cols[0].getState().amRun).length,0);for(const st of stores)clearTimeout(st.flushT);
});

// Optional native Edge run: no package installation, only an owned loopback server.
async function browser(){
  const http=require('node:http');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ws5390-'));
  const legacyTests=process.argv.includes('--legacy-tests'),baseline=process.argv.includes('--baseline'),oldFile=f=>require('node:child_process').execFileSync('git',['show','3933277:'+f],{cwd:root,encoding:'utf8',maxBuffer:8e6});
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
    if(result&&!baseline&&!legacyTests){
      const old=oldFile('ws/index.html'),start=old.indexOf('function amNxRender(');let legacy='';for(let end=old.indexOf('}',start);end>=0;end=old.indexOf('}',end+1)){try{new vm.Script(old.slice(start,end+1));legacy=old.slice(start,end+1);break;}catch(_){}}
      const geometry=[];
      for(const [width,height] of [[768,1024],[1024,768],[1280,1024]]){
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        geometry.push(await evaluate('(()=>{const f=window.__ws539Frame;f.style.maxWidth="none";f.style.width="'+width+'px";f.style.height="'+height+'px";const w=f.contentWindow;w.eval("state.amMap=JSON.parse(JSON.stringify(OMACHI_MAP));_amNx.ck=String();_amNx.sel=String();isAdmin=false;renderMapView()");const read=()=>["nxa-map","nxa-col"].map(id=>{const r=w.document.getElementById(id).getBoundingClientRect();return [r.x,r.y,r.width,r.height]});const current=read(),saved=w.amNxRender;w.eval('+JSON.stringify(legacy)+');w.eval("renderMapView()");const old=read();w.amNxRender=saved;w.eval("renderMapView()");return {width:'+width+',current,baseline:old,equal:JSON.stringify(current)===JSON.stringify(old),overflow:w.document.documentElement.scrollWidth-w.document.documentElement.clientWidth};})()'));
      }
      assert.ok(geometry.every(x=>x.equal&&x.overflow===0),JSON.stringify(geometry));console.log('GEOMETRY',JSON.stringify(geometry));fs.writeFileSync(path.join(dir,'geometry.json'),JSON.stringify(geometry,null,2));
    }
    if(result&&!baseline&&!legacyTests){await evaluate("window.__ws539Frame.contentWindow.eval(\"state.amWorks=Array.from({length:16},(_,i)=>({id:\\\"shot-\\\"+i,name:\\\"見本の点検\\\"+(i+1),kind:\\\"点検\\\",zone:\\\"blue\\\",ctr:i===2?\\\"both\\\":i%2?\\\"out\\\":\\\"in\\\",sch:[1,1,1,1],items:[]}));state.amRun={shot:{w:\\\"shot-0\\\",by:\\\"テストあ\\\",s:new Date().toISOString()}};_amNx.wsSide=\\\"in\\\";renderMapView()\")");for(const width of [390,768,1024,1280]){const height=width===390?844:width===1024?768:1024;await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate('(()=>{document.documentElement.style.overflow="hidden";document.body.style.cssText="margin:0;padding:0;overflow:hidden";for(const x of document.body.children)x.style.display=x.id==="ws539-fixture"?"block":"none";const f=window.__ws539Frame;f.style.cssText="width:'+width+'px;height:'+height+'px;border:0";f.contentWindow.eval("renderMapView()");})()');await new Promise(r=>setTimeout(r,500));if(width===390||width===768){const old=oldFile('ws/index.html'),at=old.indexOf('function amNxRender(');let fn='';for(let end=old.indexOf('}',at);end>=0;end=old.indexOf('}',end+1)){try{new vm.Script(old.slice(at,end+1));fn=old.slice(at,end+1);break;}catch(_){}}const styles=[...old.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]);const counts=await evaluate('(()=>{const w=window.__ws539Frame.contentWindow,d=w.document;const read=()=>{const c=d.getElementById("nxa-col").getBoundingClientRect();return [...d.querySelectorAll("#nxa-col .nxa-it")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.top>=c.top&&r.bottom<=Math.min(c.bottom,w.innerHeight)}).length};const current=read(),saved=w.amNxRender,ss=[...d.querySelectorAll("style")],texts=ss.map(e=>e.textContent);ss.forEach((e,i)=>e.textContent=('+JSON.stringify(styles)+')[i]||String());w.eval('+JSON.stringify(fn)+');w.eval("renderMapView()");const baseline=read();ss.forEach((e,i)=>e.textContent=texts[i]);w.amNxRender=saved;w.eval("renderMapView()");return {width:'+width+',baseline,current};})()');console.log('VISIBLE_ROWS',JSON.stringify(counts));assert.ok(counts.current>=counts.baseline,JSON.stringify(counts));assert.equal(counts.baseline,width===768?7:3);}
const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(dir,'ws5390-'+width+'.png'),Buffer.from(shot.data,'base64'));if(width===768){const crop=await send('Page.captureScreenshot',{format:'png',clip:{x:390,y:140,width:362,height:500,scale:2}});fs.writeFileSync(path.join(dir,'ws5390-768-row.png'),Buffer.from(crop.data,'base64'));}}} 
    console.log('ARTIFACTS',dir);
  }finally{child.kill();server.close();}
}
if(process.argv.includes('--browser'))browser().catch(e=>{console.error('BROWSER_UNAVAILABLE',e.message);process.exitCode=1;});
