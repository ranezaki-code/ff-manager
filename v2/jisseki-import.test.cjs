const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function app(){
  const c={TextEncoder,S:{PM:[{id:'p',name:'テストからあげ',enabled:true},{id:'c',name:'テストパック',enabled:true,packOf:'p'},{id:'q',name:'テスト別',enabled:true}],ji:{q:{teika:9}},weeks:{w:{}},activeWeek:'w',weekStart:'2026-11-08'},currentStoreId:'test',getPrevWeekRange:()=>({start:new Date(2026,9,31),end:new Date(2026,10,6)})};
  c.packParentOf=p=>p.packOf?c.S.PM.find(x=>x.id===p.packOf):null;
  vm.createContext(c);vm.runInContext(fs.readFileSync('ff/jisseki-import.js','utf8'),c);return c;
}
const item=(name='テストからあげ',teika=2)=>({name,teika,nebiki:1,haiki:0});
const json=items=>JSON.stringify({kind:'ff-jisseki',v:1,items});
test('customer checkbox and failed backup',()=>{
  const c=app();let saves=0,checked=false,fail=false;
  c.S.cust=Array.from({length:7},()=>Array(24).fill(1));
  const d={items:[item()],bad:[],cust:Array.from({length:7},()=>Array(24).fill(3)),from:'2026-10-31',to:'2026-11-06'};
  c.document={getElementById:()=>({checked})};c.localStorage={setItem:()=>{if(fail)throw Error();}};c._ffSaveObj=()=>c.S;c.saveS=()=>saves++;c.renderJissekiTable=c.renderCustGrid=c.renderRanking=c.alert=c.closeJiImport=()=>{};c.tf=c.t=()=>'';
  vm.runInContext('_jiImport={data:'+JSON.stringify(d)+',manual:{},week:S.activeWeek,store:currentStoreId,period:S.weekStart}',c);
  c.jiImportApply();assert.equal(c.S.cust[0][0],1);checked=true;c.jiImportApply();assert.equal(c.S.cust[0][0],3);assert.equal(saves,2);
  fail=true;c.S.ji.p.teika=8;c.jiImportApply();assert.equal(c.S.ji.p.teika,8);assert.equal(saves,2);
});
test('JSON: numbers, invalid rows, size',()=>{const c=app(),d=c.jiImportParse(json([item(),item('テスト','１，２３４'),item('テスト',-1),item('テスト',1.5),item('テスト','1,23')]));assert.equal(d.items.length,2);assert.equal(d.items[1].teika,1234);assert.equal(d.bad.length,3);assert.throws(()=>c.jiImportParse(' '.repeat(1048577)));});
test('CSV: quoted commas, full width, code, invalid format',()=>{const c=app(),d=c.jiImportParse('コード,商品名,定価販売,値引販売,廃棄\r\nx,テスト,"１，２３４",２,0\r\ny,テスト,-1,0,0');assert.equal(d.items[0].teika,1234);assert.equal(d.bad.length,1);assert.throws(()=>c.jiImportParse('商品名,廃棄,定価販売,値引販売'));assert.throws(()=>c.jiImportCSV('"x'));});
test('names, manual mapping, packs, untouched products and preview',()=>{const c=app(),before=JSON.stringify(c.S),d=c.jiImportParse(json([item('「テスト　からあげ」'),item('テストパック'),item('別名')]));const p=c.jiImportPlan(d);assert.equal(p.groups[0].teika,4);assert.equal(p.unmatched.length,1);assert.equal(p.missing[0].id,'q');assert.equal(JSON.stringify(c.S),before);c.S.jiImportMap={'別名':'q'};assert.equal(c.jiImportPlan(d).unmatched.length,0);assert.equal(c.jiImportName('ﾃｽﾄ－'),c.jiImportName('テストー'));});
test('period and customer validation',()=>{const c=app();assert.equal(c.jiImportMismatch({from:'2026-10-31',to:'2026-11-06'}),false);assert.equal(c.jiImportMismatch({}),true);const o={kind:'ff-jisseki',v:1,items:[],cust:Array.from({length:7},()=>Array(24).fill('２'))};assert.equal(c.jiImportParse(JSON.stringify(o)).cust[0][0],2);o.cust[0][0]=-1;assert.throws(()=>c.jiImportParse(JSON.stringify(o)));});
test('apply only after confirmation, single save, backup and customer opt out',()=>{const c=app(),d=c.jiImportParse(json([item(),item('別名')])),store={},checks={'ji-import-anyway':{checked:false},'ji-import-cust':{checked:false}};let saves=0;c.document={getElementById:id=>checks[id]};c.localStorage={setItem:(k,v)=>store[k]=v};c._ffSaveObj=()=>c.S;c.saveS=()=>saves++;c.renderJissekiTable=c.renderCustGrid=c.renderRanking=c.alert=()=>{};c.tf=()=>'';c.closeJiImport=()=>{};vm.runInContext('_jiImport={data:null,manual:{},week:S.activeWeek,store:currentStoreId,period:S.weekStart}',c);vm.runInContext('_jiImport.data='+JSON.stringify(d),c);c.jiImportApply();assert.equal(saves,0);checks['ji-import-anyway'].checked=true;c.jiImportApply();assert.equal(saves,1);assert.equal(c.S.ji.p.teika,2);assert.equal(c.S.ji.q.teika,9);const backup=JSON.parse(Object.values(store)[0]);assert.equal(backup.ji.p,undefined);assert.equal(backup.weeks.w.ji.q.teika,9);c.S.ji=backup.weeks.w.ji;assert.equal(c.S.ji.q.teika,9);});
