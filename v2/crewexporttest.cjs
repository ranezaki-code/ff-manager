// ネット・ブラウザの実データを使わず、画面の実関数を作り物の DOM で試す。
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../crew/index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const s of scripts){
  const result=require('node:child_process').spawnSync(process.execPath,['--check'],{input:s,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
}
console.log('PASS node --check: '+scripts.length+' inline scripts');
const script=scripts.find(s=>s.includes('function openCrewExport('));
const source=script.slice(script.indexOf('function setModal('),script.indexOf('// ============ イベント'));
const seed={
  crew_v1_store_sampleA:JSON.stringify({members:[{id:'sample1',name:'Sample A'}],extra:{keep:true}}),
  bumon_v1_store_sampleA:JSON.stringify({assignments:{areaA:['Sample A']},sheets:[{areaId:'areaB'}]}),
  crew_v1_store_sampleB:JSON.stringify({members:[{id:'sample2',name:'Sample B'}],unknown:[1,2]}),
  bumon_v1_store_sampleB:JSON.stringify({assignments:{areaC:[]},sheets:[]}),
  crew_v1:JSON.stringify({members:[]}), bumon_v1:JSON.stringify({assignments:{}}),
  crew_v1_store_sampleA_backup_123:'old', unrelated:'unchanged'
};
const before=JSON.stringify(seed), nodes={}; let unlocked=false, route='', calls=0, passed=0;
function node(){return {value:'',textContent:'',innerHTML:'',scrollTop:0,classList:{add(){},remove(){}},focus(){this.focused=true;},select(){this.selected=true;},setSelectionRange(a,b){this.range=[a,b];}};}
nodes.modal=node(); nodes.overlay=node();
Object.defineProperty(nodes.modal,'innerHTML',{get(){return this.markup||'';},set(s){this.markup=s; for(const id of ['crew-export-text','crew-export-status']){delete nodes[id];if(s.includes('id="'+id+'"'))nodes[id]=node();}}});
const forbidden=()=>{calls++;throw Error('unexpected external operation');};
const context=vm.createContext({$:id=>nodes[id],_personOpen:null,infoUnlocked:()=>unlocked,
  switchView:v=>{route=v;},esc:s=>String(s).replace(/[&<>"']/g,'_'),toast:()=>{},
  localStorage:{get length(){return Object.keys(seed).length;},key:i=>Object.keys(seed)[i],getItem:k=>seed[k],setItem:forbidden,removeItem:forbidden},
  navigator:{},fetch:forbidden,XMLHttpRequest:forbidden,Blob:forbidden,URL:{createObjectURL:forbidden},
  lockInfo:()=>{unlocked=false;vm.runInContext('closeModal()',context);}
});
vm.runInContext(source,context);
function check(label,fn){fn();passed++;console.log('PASS '+label);}
(async()=>{
  check('locked button route contains no export',()=>{vm.runInContext('openCrewExport()',context);assert.equal(route,'info');assert.equal(nodes['crew-export-text'],undefined);});
  unlocked=true; vm.runInContext('openCrewExport()',context);
  check('two stores and no-store values preserve all fields',()=>{
    const out=JSON.parse(nodes['crew-export-text'].value);assert.equal(out.kind,'crew-export');assert.equal(out.v,1);assert.ok(Number.isFinite(Date.parse(out.at)));
    for(const id of ['sampleA','sampleB','_none'])for(const kind of ['crew','bumon'])assert.deepEqual(out.stores[id][kind],JSON.parse(seed[kind+'_v1'+(id==='_none'?'':'_store_'+id)]));
    assert.equal(Object.keys(out.stores).length,3);
    assert.ok(nodes.modal.innerHTML.includes('保存のある部門 2件')); assert.ok(!nodes.modal.innerHTML.includes('Sample A'));
  });
  check('no download or network operations',()=>{assert.equal(calls,0);assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|Blob|createObjectURL)\b|\bdownload\s*=/);});
  await vm.runInContext('copyCrewExport()',context);
  check('clipboard fallback selects full text',()=>{const f=nodes['crew-export-text'];assert.equal(f.selected,true);assert.deepEqual(f.range,[0,f.value.length]);assert.equal(nodes['crew-export-status'].textContent,'長押しでコピー');});
  let copied;context.navigator.clipboard={writeText:async s=>{copied=s;}};
  await vm.runInContext('copyCrewExport()',context);
  check('clipboard writeText receives JSON',()=>{assert.equal(copied,nodes['crew-export-text'].value);});
  const field=nodes['crew-export-text'];vm.runInContext('closeModal()',context);
  check('close clears text and removes export DOM',()=>{assert.equal(field.value,'');assert.equal(nodes['crew-export-text'],undefined);});
  vm.runInContext('openCrewExport()',context);const lockedField=nodes['crew-export-text'];unlocked=false;
  await vm.runInContext('copyCrewExport()',context);
  check('expired lock clears export',()=>{assert.equal(lockedField.value,'');assert.equal(nodes['crew-export-text'],undefined);});
  check('all saved values unchanged',()=>{assert.equal(JSON.stringify(seed),before);assert.equal(calls,0);});
  check('existing lock closes modal on expiry',()=>{assert.match(script,/function lockInfo\(msg\)\{[\s\S]*?closeModal\(\)/);assert.match(script,/const INFO_UNLOCK_KEY=.*INFO_IDLE_MS=10\*60\*1000/);assert.match(script,/function _infoCheckExpire\(\).*lockInfo\(/);});
  console.log(passed+' passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
