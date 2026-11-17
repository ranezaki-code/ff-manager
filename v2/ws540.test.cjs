'use strict';
// 架空の記録だけを使う。既存試験のファイルは書き換えない。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),os=require('node:os');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'ws/index.html'),'utf8');
function fn(name,s=source){const a=s.indexOf('function '+name+'(');assert.ok(a>=0,name);for(let b=s.indexOf('}',a);b>=0;b=s.indexOf('}',b+1)){try{new vm.Script(s.slice(a,b+1));return s.slice(a,b+1);}catch(_){}}throw Error(name);}
function context(s=source,enabled=true){
 const nodes={},calls={},storage={synthetic:'unchanged'},reads=name=>{calls[name]=(calls[name]||0)+1;};
 const element=()=>({style:{},textContent:'',innerHTML:'',classList:{toggle(){}},insertAdjacentHTML(where,html){for(const m of html.matchAll(/id="([^"]+)"/g))nodes[m[1]]=element();this.html=(this.html||'')+html;}});
 for(const id of ['tab-request','request-view','ho-list','tab-handover-badge'])nodes[id]=element();
 const c=vm.createContext({state:{amRun:{}},storage,calls,nodes,currentView:'handover',Date,Set,document:{getElementById:id=>nodes[id]},escapeHtml:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),amTr2:(en,ne)=>'<small>'+en+' / '+ne+'</small>',amNxOn:()=>c.on!==false,amLogDay:()=> '2026-11-17',amNxQueue:()=>{reads('queue');return c.queue;},amNxLongRuns:()=>c.long,amRunActive:()=>c.active,amNxTrbNow:()=>{reads('trouble');return {band:c.trouble};},amNxGvNow:()=>{reads('given');return {live:c.given};},am5391Missed:()=>{reads('missed');return c.missed;},amNxRunLabel:r=>({icon:'📋',full:r.w,base:{}}),am539People:r=>[{n:r.by}],amRunMap:()=>c.state.amRun,amRunMin:()=>20,am5392ReadFrame:f=>f(),amIsFreshLegacy:w=>!!w.fresh,amNxTrbName:id=>id,amHM:()=> '12:00',queue:[],long:[],active:[],trouble:[],given:[],missed:[]});
 const start=s.indexOf('const AM_HO_LIST'),end=s.indexOf('/* バージョン表示を初期化 */',start);
 vm.runInContext(s.slice(start,end).replace('const AM_HO_LIST = true','const AM_HO_LIST = '+enabled),c);return c;
}
const run=(c,s)=>vm.runInContext(s,c);
test('97ho1 all store configurations mount once, after request, without writes',()=>{
 for(const config of [{},{amNx:{}},{amNx:{on:1}},{amNx:{on:1,gv:{on:1}}}]){const c=context();c.state=config;const before=JSON.stringify([c.state,c.storage]);run(c,'amHoMount();amHoMount()');assert.ok(c.nodes['tab-handover']);assert.ok(c.nodes['handover-view']);assert.ok(c.nodes['ho-notes']);assert.match(c.nodes['tab-request'].html,/aria-label="引継ぎ"/);assert.equal((c.nodes['tab-request'].html.match(/id="tab-handover"/g)||[]).length,1);assert.equal(JSON.stringify([c.state,c.storage]),before);}
});
test('97ho2 all sections and tiles, freshness, deduplication, read only',()=>{
 const c=context();c.queue=[0,1,2].map(i=>({k:'fire',w:{fresh:i===2},name:'作業'+i}));c.long=[{k:'long',w:'残った作業',by:'クルーA'}];c.active=[...c.long,{k:'a',w:'作業中A',by:'クルーB'},{k:'b',w:'作業中B',by:'クルーC'}];c.state.amRun=Object.fromEntries(c.active.map(r=>[r.k,r]));const def={ic:'!',t:'物が ない',en:'Missing item',ne:'सामान छैन'};c.trouble=[{qid:'困った作業',def}];c.given=[{qid:'諦めた作業',def,by:'クルーD',t:0}];c.missed=[{w:'間に合わなかった作業',round:1,scheduled:new Date().toISOString(),hiddenAt:new Date().toISOString()}];c.amWork=()=>({});
 const before=JSON.stringify([c.state,c.storage]);for(let i=0;i<3;i++)run(c,'amHoRender()');const h=c.nodes['ho-list'].innerHTML;
 assert.equal(JSON.stringify([c.state,c.storage]),before);for(const k of ['late','long','run','trouble','given','missed'])assert.ok(h.includes('data-ho="'+k+'"'),k);assert.match(h,/data-ho-tile="undone"[^]*?<b[^>]*>4<\/b>/);assert.equal((h.match(/残った作業/g)||[]).length,1);assert.match(h,/鮮度管理/);assert.match(h,/amNxGvList\(\)/);assert.doesNotMatch(h,/amNxGvUndo|しめ なし|受けた|退勤|＋/);
});
test('97ho3 badge reuses supplied global queue, never builds list or reads history',()=>{
 const c=context();c.amHoData=()=>{throw Error('badge must not build list');};run(c,"amHoBadge([{k:'fire'},{k:'soon'},{k:'fire'}],[{}])");assert.equal(c.nodes['tab-handover-badge'].textContent,'3');assert.deepEqual(c.calls,{});run(c,'amHoBadge([],[])');assert.equal(c.nodes['tab-handover-badge'].style.display,'none');
 const body=fn('amNxRenderBody');assert.match(body,/hoQ=amNxQueue\(now\), q=kcv\?hoQ\.filter/);assert.match(body,/amHoBadge\(hoQ,lgA\)/);
});
test('97ho4 closed tab skips every list read; old screen and empty messages are pure',()=>{
 const c=context();c.currentView='map';run(c,'amHoRender()');assert.deepEqual(c.calls,{});c.currentView='handover';c.on=false;const before=JSON.stringify([c.state,c.storage]);run(c,'amHoRender()');assert.match(c.nodes['ho-list'].innerHTML,/新しい 画面で 見られます/);assert.deepEqual(c.calls,{});c.on=true;c.nodes['tab-handover-badge'].textContent='4';run(c,'amHoRender()');assert.match(c.nodes['ho-list'].innerHTML,/いま 引き継ぐ 物は ありません/);assert.equal(c.nodes['tab-handover-badge'].textContent,'0');assert.equal(c.nodes['tab-handover-badge'].style.display,'none');assert.equal(JSON.stringify([c.state,c.storage]),before);
});
test('97ho5 false removes all mounting, badge and list work; handover falls back to map',()=>{
 assert.match(fn('renderMapView'),/if\(AM_HO_LIST\)\{ amHoMount\(\); amHoRender\(\); \}/);const c=context(source,false);const before=JSON.stringify(c.nodes);run(c,'amHoMount();amHoBadge([],[]);amHoRender()');assert.equal(JSON.stringify(c.nodes),before);assert.deepEqual(c.calls,{});assert.match(fn('setView'),/if\(!AM_HO_LIST&&v==='handover'\) v='map'/);
});
test('97ho6 old calculations and mutation functions remain byte-identical to 5.39.3',()=>{
 const old=cp.execFileSync('git',['show','3a70166:ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});
 for(const name of ['amLogDay','amNxQueue','amNxClose','amNxLongRuns','amRunActive','amNxTrbNow','amNxGvNow','am5391Missed','am5391Settle','amRunDoStart','amRunDoEnd','amNxTrbPut','amNxGvPut','amNxGvUndo','saveState'])assert.equal(fn(name),fn(name,old),name);
});
test('97ho7 mutation checks reject state writes, badge recomputation and false mount',()=>{
 const checkWrite=s=>{const c=context(s),before=JSON.stringify(c.state);run(c,'amHoRender()');assert.equal(JSON.stringify(c.state),before);};
 assert.throws(()=>checkWrite(source.replace('const now=Date.now(), d=am5392ReadFrame',"state.unwanted=1; const now=Date.now(), d=am5392ReadFrame")));
 const c=context(source.replace('amHoMount(); const b=', 'amHoData(Date.now()); amHoMount(); const b='));c.amHoData=()=>{throw Error('recomputed');};assert.throws(()=>run(c,'amHoBadge([],[])'));
 const c2=context(source.replace("if(!AM_HO_LIST||document.getElementById('tab-handover')) return;","if(document.getElementById('tab-handover')) return;"),false);run(c2,'amHoMount()');assert.throws(()=>assert.equal(c2.nodes['tab-handover'],undefined));
});
test('97ho8 syntax, LF, Unicode and generated body agree',()=>{
 let count=0;for(const f of ['ws/index.html','v2/ws/index.html','v2/wstest.html']){const s=fs.readFileSync(path.join(root,f),'utf8');assert.ok(!s.includes('\r')&&!s.includes('\uFFFD'));for(const m of s.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(/src=/.test(m[1])||(/type=/.test(m[1])&&!/id="v2-main"/.test(m[1])))continue;new vm.Script(m[2]);count++;}}assert.equal(count,18);assert.match(source,/APP_VERSION = '5.40.2'/);assert.match(source,/aria-label="引継ぎ"/);assert.match(source,/नयाँ स्क्रिनमा/);const gen=fs.readFileSync(path.join(root,'v2/ws/index.html'),'utf8');assert.equal(fn('amHoRender',gen),fn('amHoRender'));
});

function tabsCheck(s=source){
 const c=context(s),tabs={style:{},clientWidth:300,children:[{id:'tab-map',offsetWidth:200,offsetHeight:44},{id:'tab-handover',offsetWidth:48,offsetHeight:48}],offsetHeight:61,clientHeight:60,scrollWidth:300};c.nodes['view-tabs']=tabs;c.getComputedStyle=()=>({paddingTop:'8',paddingBottom:'8',paddingLeft:'12',paddingRight:'12',borderTopWidth:'0',borderBottomWidth:'1',columnGap:'6'});
 run(c,'amHoTabsSize()');assert.equal(tabs.style.height,'61px');tabs.children.push({id:'tab-db',offsetWidth:100,offsetHeight:44});run(c,'amHoTabsSize()');assert.equal(tabs.style.height,'71px');tabs.clientWidth=500;run(c,'amHoTabsSize()');assert.equal(tabs.style.height,'61px');tabs.children[0].offsetWidth=450;run(c,'amHoTabsSize()');assert.equal(tabs.style.height,'71px');
}
function reviewCheck(s=source){tabsCheck(s);
 const c=context(s);c.long=[{k:'a',w:'残った作業',by:'クルーA'}];c.active=[{k:'b',w:'作業中',by:'クルーB'}];c.state.amRun={a:c.long[0],b:c.active[0]};c.given=[{qid:'諦めた作業',def:{ic:'!',t:'理由',en:'Reason',ne:'कारण'},by:'クルーC',t:0}];c.missed=[{w:'作業',round:1,scheduled:'2026-11-17T02:00:00Z',hiddenAt:'2026-11-17T10:00:00Z'}];c.amWork=()=>({});c.amNxRunLabel=r=>({icon:'!',full:r.w,base:{fresh:true}});run(c,'amHoRender()');const h=c.nodes['ho-list'].innerHTML;
 for(const key of ['long','run','given','missed']){const section=h.split('data-ho="'+key+'"')[1].split('</section>')[0],detail=section.split('<div class="tx">')[1];assert.equal((detail.match(/<small>/g)||[]).length,2,key);assert.match(detail,/<span data-ho-jp>[^]*<\/span><small>/,key);}
 assert.match(h,/1回目/);assert.match(h,/下げた時刻/);assert.match(h,/Freshness control/);assert.doesNotMatch(h,/<span style="display:inline-block;padding:2px[^>]*>[^<]*<small>/);
 assert.match(fn('amHoMount',s),/MutationObserver/);assert.match(fn('amHoMount',s),/aria-label="引継ぎ"/);assert.match(fn('amHoText',s),/display:inline-block/);assert.doesNotMatch(fn('initVersionInfo',s),/5.39.3|AM_HO_LIST/);assert.doesNotMatch(fn('amNxCfgOpen',s),/5.39.3/);
}
test('97ho11 false shows APP_VERSION in version DOM',()=>{const c=context(source,false);c.nodes['version-num']={};run(c,"const APP_VERSION='5.40.2',APP_BUILD='synthetic';"+fn('initVersionInfo')+';initVersionInfo()');assert.equal(c.nodes['version-num'].textContent,'v5.40.2');});
test('97ho9 review fixes: complete Japanese then one translation, fresh badge, missed words, sizing and version',()=>reviewCheck());
test('97ho10 each of five review regressions is rejected',()=>{
 const old=cp.execFileSync('git',['show','aa11df4:ws/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});
 const variants=[source.replace("'<span data-ho-jp>'+jp+'</span>'+amTr2", "amTr2"),source.replace(fn('amHoMount'),fn('amHoMount',old)),source.replace("e(AM_HO_WORDS.round[0])", "''"),source.replace("e(AM_HO_WORDS.fresh[0])", "amHoText('fresh')"),source.replace(fn('initVersionInfo'),fn('initVersionInfo',old))];for(let i=0;i<variants.length;i++)assert.throws(()=>reviewCheck(variants[i]),'review regression '+(i+1));
});

test('97ho12 admin tab height is settled before map and band measurement; missing call is rejected',()=>{
 const check=(text,enabled=true)=>{for(const width of [390,768,800]){
  const c=context(text,enabled),tabs={style:{height:'61px'},clientWidth:width,children:[{offsetWidth:width+20}],get offsetHeight(){return parseInt(this.style.height);}};
  c.nodes['view-tabs']=tabs;c.getComputedStyle=()=>({paddingTop:'8',paddingBottom:'8',borderBottomWidth:'1'});
  c.view={clientWidth:width,getBoundingClientRect:()=>({width,top:100+tabs.offsetHeight})};c.window={innerWidth:width,innerHeight:1024,scrollY:0};c.map=null;c.ckR=null;c.isAdmin=true;
  const body=fn('amNxRenderBody',text),a=body.indexOf("  if(typeof amHoTabsSize==='function') amHoTabsSize();"),b=body.indexOf('  let M=null, C;');
  const start=a>=0?a:body.indexOf('  const vr=view.getBoundingClientRect()');
  const measured=run(c,'(()=>{'+body.slice(start,b)+'return {topY,H,bodyH};})()');
  run(c,'amHoTabsSize()');const settled=100+tabs.offsetHeight;
  assert.equal(tabs.style.height,enabled?'71px':'61px');assert.equal(measured.topY,settled,'map/band top at width '+width);assert.equal(measured.H,Math.floor(1024-settled-(width>=621?22:0)));
 }};
 check(source);check(source,false);
 const broken=source.replace("  if(typeof amHoTabsSize==='function') amHoTabsSize();\n",'');assert.notEqual(broken,source);assert.throws(()=>check(broken),/map\/band top/);
});

// Run unchanged regression tests with only the exact current-version expectation adapted in memory.
if(process.argv.includes('--regressions'))for(const f of ['ws5390.test.cjs','ws5391.test.cjs','ws5392.test.cjs','ws5393.test.cjs','ws-settle-equivalence.test.cjs']){
 let code=fs.readFileSync(path.join(__dirname,f),'utf8').replace(/APP_VERSION = '5\.39\.3'/g,"APP_VERSION = '5.40.2'");new Function('require','__dirname','process',code)(require,__dirname,process);
}
// Existing single-process speed runner; output uses os.tmpdir and no external origin is allowed.
async function reviewGeometry({ev,send,setRevision,load,out}){
 const rows=[];for(const revision of ['3a70166','working']){setRevision(revision);await load();await ev('w.eval('+JSON.stringify('('+handoverFixture.toString()+')()')+')');for(const width of [1280,1024,820,800,768,412,390,375]){await send('Emulation.setDeviceMetricsOverride',{width,height:1024,deviceScaleFactor:1,mobile:false});await ev('document.querySelector("iframe").style.width='+JSON.stringify(width+'px'));for(const admin of [false,true]){await ev('w.eval('+JSON.stringify('isAdmin='+admin+';document.body.classList.toggle("admin-mode",isAdmin);renderMapView();')+')');await new Promise(r=>setTimeout(r,60));rows.push(await ev('w.eval('+JSON.stringify('(()=>{const t=document.getElementById("view-tabs");t.scrollLeft=0;const r=t.getBoundingClientRect();return {width:innerWidth,admin:isAdmin,height:r.height,overflow:t.scrollWidth-t.clientWidth,tabs:[...t.children].filter(b=>b.offsetWidth).map(b=>{const q=b.getBoundingClientRect();return {id:b.id,visible:100*Math.max(0,Math.min(q.right,r.right)-Math.max(q.left,r.left))/q.width};})};})()')+')'));rows[rows.length-1].revision=revision;}}}for(const r of rows){if(r.revision==='working'){const base=rows.find(b=>b.revision==='3a70166'&&b.width===r.width&&b.admin===r.admin);r.targets=r.tabs.filter(t=>t.id!=='tab-handover').map(t=>({id:t.id,pass:t.visible+0.1>=base.tabs.find(b=>b.id===t.id).visible}));r.heightPass=r.height===(r.overflow?71:61);}}fs.writeFileSync(path.join(out,'tabs5401.json'),JSON.stringify(rows,null,2));for(const r of rows.filter(r=>r.revision==='working'))assert.equal(r.heightPass,true,'tab height '+r.width+' '+r.admin);
}
async function integration({ev,send,out,html,setRevision}){
 console.log('RUN_ARTIFACTS',out);
 const load=async()=>{
  await ev(`(async()=>{document.querySelector('iframe')?.remove();const f=document.createElement('iframe');f.style.cssText='position:fixed;inset:0;width:1280px;height:844px;border:0';document.body.append(f);await new Promise(r=>{f.onload=r;f.src='/v2/ws/index.html?embedded=1&mem=1&wait=1'});window.w=f.contentWindow;const store=new V2.Store({backend:new V2.MemoryCloud().device(),space:'ho-test',device:'synthetic',kv:new V2.MemKV(),snapshot:false});await w.__v2go({store,stores:[{id:'synthetic',name:'見本の店'}],current:'synthetic',state:JSON.stringify({staff:[],amUsed:true,amNx:{on:1,pre:{off:1}}})});})()`);
 };
 await load();await ev('w.eval('+JSON.stringify('('+handoverFixture.toString()+')()')+')');
 await reviewGeometry({ev,send,setRevision,load,out});setRevision('working');await load();await ev('w.eval('+JSON.stringify('('+handoverFixture.toString()+')()')+')');
 const lines=[];for(const width of [1280,768,390,375]){await ev('document.querySelector("iframe").style.width='+JSON.stringify(width+'px'));await ev('w.__hoShow(false)');lines.push(await ev('w.eval('+JSON.stringify('(()=>{const rows=[...document.querySelectorAll("#ho-list section .nxt-li")];return {width:innerWidth,rows:rows.map(r=>{const d=r.querySelector(".tx > small"),jp=d.querySelector("[data-ho-jp]");return {jp:jp?.textContent||null,translations:d.querySelectorAll(".am-tr").length,html:d.innerHTML};}),heading:[...document.querySelectorAll("#ho-list h3 > span")].map(s=>({text:s.textContent,rects:s.getClientRects().length})),badges:[...document.querySelectorAll("#ho-list b > span")].map(s=>({text:s.textContent,height:s.getBoundingClientRect().height,translations:s.children.length}))};})()')+')'));}fs.writeFileSync(path.join(out,'lines5401.json'),JSON.stringify(lines,null,2));for(const line of lines){for(const r of line.rows)assert.equal(r.translations,1,'one trailing translation at '+line.width);for(const b of line.badges){assert.equal(b.text,'鮮度管理');assert.equal(b.translations,0);assert.ok(b.height<30);}assert.ok(line.heading.some(h=>h.text==='ここに'));}
 const result=await ev('w.__hoCheck()');assert.deepEqual(result.counts,[3,1,2,1,1,1]);assert.equal(result.pure,true);assert.equal(result.badge,4);assert.equal(result.sections,6);assert.equal(result.lazy,true);assert.equal(result.old,true);assert.equal(result.future,true);assert.equal(result.global,true);
 fs.writeFileSync(path.join(out,'handover-integration.json'),JSON.stringify(result,null,2));console.log('HANDOVER_INTEGRATION',JSON.stringify(result));
 for(const [width,height] of [[1280,844],[1024,844],[390,844],[768,1024]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  for(const empty of width===768?[false]:[false,true]){
   await ev(`document.querySelector('iframe').style.cssText='position:fixed;inset:0;width:${width}px;height:${height}px;border:0';w.__hoShow(${empty});1`);
   await new Promise(r=>setTimeout(r,250));
   const geometry=await ev('({overflow:w.document.documentElement.scrollWidth-w.innerWidth,buttons:[...w.document.querySelectorAll("#handover-view button")].every(b=>b.getBoundingClientRect().height>=48)})');assert.ok(geometry.overflow<=0);assert.equal(geometry.buttons,true);
   const png=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'handover-'+width+'-'+(empty?'empty':'all')+'.png'),Buffer.from(png.data,'base64'));
   if(!empty){
    await ev('w.scrollTo(0,(w.document.documentElement.scrollHeight-w.innerHeight)/2);1');await new Promise(r=>setTimeout(r,100));
    const middle=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'handover-'+width+'-middle.png'),Buffer.from(middle.data,'base64'));
    await ev('w.scrollTo(0,w.document.documentElement.scrollHeight);1');await new Promise(r=>setTimeout(r,100));
    const bottom=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'handover-'+width+'-bottom.png'),Buffer.from(bottom.data,'base64'));
   }
  }
 }
 const probes=[];
 html.set('disabled',fs.readFileSync(path.join(root,'v2/ws/index.html'),'utf8').replace('const AM_HO_LIST = true','const AM_HO_LIST = false'));
 for(const version of ['3a70166','disabled','working']){
  setRevision(version);await load();await ev('w.eval('+JSON.stringify('('+handoverFixture.toString()+')()')+')');
  probes.push(await ev(`w.eval('('+${JSON.stringify(function(){
   const tabs=document.getElementById('view-tabs').innerHTML,map=document.getElementById('map-view').innerHTML, visible=(()=>{const nodes=[...document.querySelectorAll('#version-num,#nx-version')],text=nodes.map(n=>n.textContent);nodes.forEach(n=>n.textContent='vVERSION');const visible=document.body.innerText;nodes.forEach((n,i)=>n.textContent=text[i]);return visible;})(), geometry=['top-stack','map-view'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
   const initial=JSON.stringify(state),trace=[];let serial=0;Math.random=()=>0.1234+(++serial)/1000000;amDevId=()=> 'synthetic';
   const Native=Date;let clock=Date.now();window.Date=class extends Native{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}};
   const record=()=>{amSave(true);trace.push(JSON.stringify([state,Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])]));};record();
   const k=amRunDoStart('ho0','クルーD',Date.now()-60000);record();amRunDoEnd(k,Date.now());record();
   let undo;amSnack=(text,w,label,callback)=>{if(callback)undo=callback;};_amNx.trbSrc={id:'ho2',k:''};amNxTrbPut(AM_NX_TRB.find(d=>d.band&&!d.auto).y);record();if(undo){undo();record();}
   const item=amNxQueue(Date.now()).find(x=>x.id==='ho1');if(item){const ref=amNxGvPut(item,AM_NX_GV[0].y,'クルーD',Date.now(),0);record();amNxGvUndo(ref.key,ref.id);record();}
   clock+=3600000;renderMapView();record();clock=new Native(2026,10,18,3,1).getTime();amRunSettle(clock);am5391Settle(clock);record();
   const beforeRead=JSON.stringify([state,Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])]);
   if(typeof amHoData==='function'&&AM_HO_LIST){setView('handover');renderMapView();setView('request');setView('handover');renderMapView();setView('map');}
   const readOnlyAfterClock=beforeRead===JSON.stringify([state,Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])]);
   const boundary=[new Date(2026,10,18,2,59),new Date(2026,10,18,3,0),new Date(2026,10,18,3,1),new Date(2026,10,17,17,0,-30),new Date(2026,10,17,17,0,30)].map(t=>{const n=t.getTime();return JSON.stringify([amLogDay(n),amNxQueue(n),amNxLongRuns(n),amNxTrbNow(n),amNxGvNow(n),am5391Missed(amLogDay(n),n)]);});
   return {tabs,map,initial,trace,boundary,geometry,readOnlyAfterClock,visible,displayedVersion:document.getElementById('version-num').textContent};
  }.toString())}+')()')`));
 }
 assert.equal(probes[1].tabs,probes[0].tabs,'disabled tabs identical');assert.equal(probes[1].map,probes[0].map,'disabled map DOM identical');
 assert.equal(probes[1].displayedVersion,'v5.40.2');assert.equal(probes[1].visible,probes[0].visible,'disabled DOM text and order, only version nodes normalized');
 assert.equal(JSON.stringify(probes[2].geometry),JSON.stringify(probes[0].geometry),'map geometry unchanged with the new tab');
 fs.writeFileSync(path.join(out,'probe-detail.json'),JSON.stringify(probes));
 for(const p of probes){assert.equal(p.readOnlyAfterClock,true);assert.equal(p.initial,probes[0].initial);assert.equal(JSON.stringify(p.trace),JSON.stringify(probes[0].trace),'operation bytes');assert.equal(JSON.stringify(p.boundary),JSON.stringify(probes[0].boundary),'boundary bytes');}
 await ev('w.eval("setView(\'handover\')")');setRevision('disabled');await load();await ev('w.eval("setView(\'handover\')")');assert.equal(await ev('w.eval("currentView")'),'map');
 fs.writeFileSync(path.join(out,'handover-equivalence.json'),JSON.stringify({disabledDOM:true,operationSnapshots:probes[0].trace.length,boundaries:probes[0].boundary.length}));
 console.log('HANDOVER_ARTIFACTS',out);
}
function handoverFixture(){
 const RD=Date,now=new RD(2026,10,17,18,40).getTime();window.Date=class extends RD{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 const names=['クルーA','クルーB','クルーC','クルーD'];
 const works=Array.from({length:9},(_,i)=>({id:'ho'+i,name:i===2?'見本の 鮮度管理':'見本の 作業'+i,kind:i===2?'鮮度管理':'点検',icon:'📋',place:'off',how:'time',times:i===8?['10:00','18:30']:['10:00'],lead:0,grace:60,sch:[1,1,1,1],sch7:[1,1,1,1,1,1,1],items:[],ctr:i%2?'out':'in'}));
 state={staff:names,amUsed:true,amNx:{on:1,pre:{off:1},gv:{on:1}},amWorks:works,amRun:{},areaChecks:{},amHere:{},wsOverdueSince:now-864e5};
 state.amMap=JSON.parse(JSON.stringify(OMACHI_MAP));state.amMap.cells.forEach(c=>c.works=[]);
 for(const [i,min] of [[3,90],[4,5],[5,5]])state.amRun['r'+i]={w:'ho'+i,by:names[i-3],s:new Date(now-min*60000).toISOString(),d:'synthetic'};
 const day=amLogDay(now),log=state['amLog_'+day]={},trb=AM_NX_TRB.find(d=>d.band&&!d.auto),given=AM_NX_GV[0];
 log.p1={p:1,w:'ho6',t:new Date(now-120000).toISOString(),by:names[3],d:'synthetic',y:trb.y};
 const g=amNxQueue(now).find(x=>x.id==='ho7');log.g1={g:1,w:'ho7',t:new Date(now-120000).toISOString(),by:names[3],d:'synthetic',y:given.y,o:amNxGvDue(g)};
 // The later round is complete; its earlier round is the one missed row.
 state.areaChecks.ho8=[{at:new Date(now-60000).toISOString(),by:names[0],wsScheduled:new Date(2026,10,17,18,30).getTime()}];
 const initial=JSON.stringify(state);isAdmin=false;amCloseSheet();setView('map');renderMapView();
 window.__hoShow=empty=>{state=JSON.parse(initial);if(empty){state.amWorks=[];state.amRun={};state['amLog_'+day]={};state.areaChecks={};}amCloseSheet();setView('handover');document.getElementById('tab-handover').scrollIntoView({block:'nearest',inline:'nearest'});window.scrollTo(0,0);};
 window.__hoCheck=()=>{
  const kv=()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));const before=JSON.stringify(state),saved=kv();
  setView('handover');const d=amHoData(now),counts=['late','long','run','trouble','given','missed'].map(k=>d[k].length),sections=document.querySelectorAll('#ho-list [data-ho]').length,badge=Number(document.getElementById('tab-handover-badge').textContent);
  setView('request');setView('handover');renderMapView();const pure=before===JSON.stringify(state)&&saved===kv();
  const data=amHoData;let called=0;amHoData=(...args)=>{called++;return data(...args);};setView('map');renderMapView();const lazy=called===0;amHoData=data;
  amKcViewOn=()=>true;renderMapView();setView('handover');const global=amHoData(now).late.length===counts[0]&&Number(document.getElementById('tab-handover-badge').textContent)===badge;
  log.pFuture={...log.p1,w:'ho0',t:new Date(now+61000).toISOString()};log.gFuture={...log.g1,w:'ho1',t:new Date(now+61000).toISOString()};const future=amHoData(now).trouble.length===1&&amHoData(now).given.length===1;
  state.amNx.on=0;const oldBefore=JSON.stringify(state);setView('handover');const old=document.getElementById('ho-list').textContent.includes('新しい 画面で 見られます')&&oldBefore===JSON.stringify(state);
  return {counts,pure,badge,sections,lazy,old,future,global};
 };
}
function checkPerformance(results,out){
 const base=results.versions['3a70166'],current=results.versions.working;
 const checks=['start','finish'].map(action=>({action,dom:JSON.stringify(base[action].dom)===JSON.stringify(current[action].dom),speed:current[action].max<=base[action].max,baselineMax:base[action].max,currentMax:current[action].max}));
 fs.writeFileSync(path.join(out,'checks540.json'),JSON.stringify(checks,null,2));console.log('CHECKS_540',JSON.stringify(checks));if(!checks.every(x=>x.dom&&x.speed))process.exitCode=1;
}
async function pairedPerformance({ev,send,setRevision,fixture,out}){
 const origin=await ev('location.origin'),target=await send('Target.createTarget',{url:'about:blank'},null),sid=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 const command=(method,params={})=>send(method,params,sid),evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const results={cpu:4,repeats:20,warmups:3,timeMethod:'12:20 to 15:00, amTick30',versions:{}};
 try{
  await send('Page.setWebLifecycleState',{state:'frozen'});
  await command('Page.enable');await command('Network.enable');await command('Network.setBlockedURLs',{urls:['https://*']});await command('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});await command('Emulation.setCPUThrottlingRate',{rate:4});await command('Page.navigate',{url:origin+'/fixture'});
  for(let i=0;i<100;i++){if(await evaluate('!!window.V2'))break;await new Promise(r=>setTimeout(r,50));}
  for(const version of ['3a70166','working','working','3a70166']){
   setRevision(version);await evaluate(`(async()=>{document.querySelector('iframe')?.remove();const f=document.createElement('iframe');f.style.cssText='position:fixed;inset:0;width:768px;height:1024px;border:0';document.body.append(f);await new Promise(r=>{f.onload=r;f.src='/v2/ws/index.html?embedded=1&mem=1&wait=1'});window.w=f.contentWindow;const store=new V2.Store({backend:new V2.MemoryCloud().device(),space:'paired',device:'synthetic',kv:new V2.MemKV(),snapshot:false});await w.__v2go({store,stores:[{id:'synthetic',name:'見本の店'}],current:'synthetic',state:JSON.stringify({staff:[],amUsed:true,amNx:{on:1,pre:{off:1}}})});})()`);
   await evaluate('w.eval('+JSON.stringify('('+fixture.toString()+')()')+')');
   await evaluate(`w.eval(${JSON.stringify(`window.__clock540=Date;const prepare540=__prepare;window.__prepare=async action=>{window.Date=__clock540;setView('map');await prepare540(action==='handover'?'side':action);if(action==='handover')window.__target=document.getElementById('tab-handover');};window.__measureTime540=async()=>{const R=__clock540,n=R.now()+160*60000;window.Date=class extends R{constructor(...a){super(...(a.length?a:[n]));}static now(){return n;}};const before=JSON.stringify(state),begin=performance.now();amTick30();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(before!==JSON.stringify(state))throw Error('time redraw wrote state');return {ms:performance.now()-begin,dom:document.getElementById('map-view').textContent};};`)})`);
   const rows={};
   for(const action of ['start','finish','time','handover']){
    if(action==='handover'&&version!=='working'){rows[action]={unavailable:true};continue;}
    const samples=[],dom=[],callSamples=[];
    for(let i=-3;i<20;i++){
     await evaluate('w.Date=w.__clock540;w.__prepare('+JSON.stringify(action==='time'?'side':action)+')');
     const r=await evaluate(action==='time'?'w.__measureTime540()':'w.__measure('+JSON.stringify(action)+')');
     if(i>=0){samples.push(r.ms);dom.push(r.dom);callSamples.push(r.calls||{});}
    }
    const sorted=samples.slice().sort((a,b)=>a-b);rows[action]={median:(sorted[9]+sorted[10])/2,min:sorted[0],max:sorted[19],samples,dom,callSamples};console.log('PAIRED_540',version,action,rows[action].median.toFixed(1),rows[action].max.toFixed(1));
   }
   if(!results.runs)results.runs=[];results.runs.push({version,rows});results.versions[version]=rows;
  }
  fs.writeFileSync(path.join(out,'paired540.json'),JSON.stringify(results,null,2));checkPerformance(results,out);
  const time={action:'time',dom:JSON.stringify(results.versions['3a70166'].time.dom)===JSON.stringify(results.versions.working.time.dom),speed:results.versions.working.time.max<=results.versions['3a70166'].time.max};fs.writeFileSync(path.join(out,'time540.json'),JSON.stringify(time));console.log('TIME_540',JSON.stringify(time));if(!time.dom||!time.speed)process.exitCode=1;
 }finally{await send('Target.closeTarget',{targetId:target.targetId},null);await send('Page.setWebLifecycleState',{state:'active'});}
 return results;
}
if(process.argv.includes('--browser')||process.argv.includes('--integration')){
 let code=fs.readFileSync(path.join(__dirname,'ws-speed.test.cjs'),'utf8');
 code=code.replace(" const u=new URL(req.url,'http://localhost');"," res.sendDate=false;const u=new URL(req.url,'http://localhost');");
 code=code.replace("const allowed=['/v2/ws/index.html'","const allowed=['/v2/index.html','/v2/ws/index.html'").replace("img-src 'self' data:;","img-src 'self' data: blob:;");
 code=code.replace("path.resolve(root,'../speed-records/run-'+Date.now())","fs.mkdtempSync(path.join(path.resolve(root,'../records/ws5401-20261117-codex'),'run-'))");
 code=code.replace("let revision='ac802b4';","let revision='3a70166';").replace("const versions=['3933277','65efd8c','ac802b4'];","const versions=['3a70166'];");
 code=code.replace(/if\(process\.argv\.includes\('--after'\)\)\{\r?\n const checks=/, "if(process.argv.includes('--after'))checkPerformance(results,out);if(false){\n const checks=");
 code=code.replace("for(revision of process.argv.includes('--after')?versions.concat('working'):versions){", "while(process.env.WS540_WAIT&&!fs.existsSync(process.env.WS540_WAIT)){await new Promise(r=>setTimeout(r,1000));}for(revision of process.argv.includes('--after')?versions.concat('working'):versions){");
 if(process.argv.includes('--integration')){
  code=code.replace("if(process.argv.includes('--after')||process.argv.includes('--browser'))main()",'if(true)main()');
  code=code.replace('const results={cpu:4,repeats:10,versions:{}};', "revision='working';try{await integration({ev,send,out,html,setRevision:r=>revision=r});}catch(e){console.error('INTEGRATION_FAILED',e.message.slice(0,200));process.exitCode=1;}const results={cpu:4,repeats:10,versions:{}};");
  if(!process.argv.includes('--after'))code=code.replace("for(revision of process.argv.includes('--after')?versions.concat('working'):versions){",'for(revision of []){');
 }
 if(process.argv.includes('--paired')){
  code=code.replace('const results={cpu:4,repeats:10,versions:{}};',"await pairedPerformance({ev,send,out,fixture,setRevision:r=>revision=r});const results={cpu:4,repeats:10,versions:{}};");
  code=code.replace("for(revision of process.argv.includes('--after')?versions.concat('working'):versions){",'for(revision of []){');
 }
 if(process.argv.includes('--tab-speed')){
  code=code.replace("['name','row','start','finish','team','side','time','map']","['start','finish','time','handover']");
  code=code.replace("if(action==='time'){rows[action]={unavailable:true,reason:'時間帯の切り替えボタンを特定できない'};continue;}","if(action==='handover'&&revision!=='working'){rows[action]={unavailable:true};continue;}if(action==='time'){rows[action]={unavailable:true,reason:'時間帯の切り替えボタンを特定できない'};continue;}");
  code=code.replace("amCloseSheet();state=JSON.parse(initial);", "amCloseSheet();setView('map');state=JSON.parse(initial);");
  code=code.replace("if(action==='time'){isAdmin=true;amOpenWorks();}","if(action==='time'){isAdmin=true;amOpenWorks();}");
  code=code.replace("_amfHold=0;_amNx.hold=0;", "if(action==='handover')__target=document.getElementById('tab-handover');_amfHold=0;_amNx.hold=0;");
 }
 if(process.argv.includes('--six')){
  code=code.replace("revision='working';await send('Emulation.setCPUThrottlingRate'", "for(const hour of [2.9833333333,3,3.0166666667,10,17,23.9833333333]){revision='working';await send('Page.addScriptToEvaluateOnNewDocument',{source:'(()=>{const R=Date,off=new R(2026,10,13).getTime()+'+Math.round(hour*3600000)+'-R.now();function F(...a){if(!new.target)return new R(R.now()+off).toString();return Reflect.construct(R,a.length?a:[R.now()+off],new.target);}F.prototype=R.prototype;Object.setPrototypeOf(F,R);F.now=()=>R.now()+off;window.Date=F;})()'});await send('Emulation.setCPUThrottlingRate'");
  code=code.replace("path.join(out,'suite.json')","path.join(out,'suite-'+hour+'.json')");
  code=code.replace("if(!result||result.existing.ng||result.ws539.ng)process.exitCode=1;", "if(!result||result.existing.ng||result.ws539.ng)process.exitCode=1;}");
 }
 if(process.argv.includes('--baseline')){
  code=code.replace("for(revision of process.argv.includes('--after')?versions.concat('working'):versions){",'for(revision of []){');
  code=code.replaceAll("revision='working';await send('Page.addScriptToEvaluateOnNewDocument'","revision='3a70166';await send('Page.addScriptToEvaluateOnNewDocument'");
  code=code.replace("fs.readFileSync(path.join(root,u.pathname))", "(u.pathname==='/v2/wstest.html'?cp.execFileSync('git',['show','3a70166:v2/wstest.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(root,u.pathname)))");
 }
 new Function('require','__dirname','process','integration','checkPerformance','pairedPerformance','reviewGeometry',code)(require,__dirname,process,integration,checkPerformance,pairedPerformance,reviewGeometry);
}
