const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function storage(limit=Infinity){
  const data=new Map();
  return {data,get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,removeItem:k=>data.delete(k),setItem(k,v){
    const next=new Map(data);next.set(k,String(v));
    if([...next].reduce((n,[a,b])=>n+2*(a.length+b.length),0)>limit)throw Error('quota');
    data.set(k,String(v));
  }};
}
function app(real){
  let src=fs.readFileSync('v2/ffshim.js','utf8');
  src=src.slice(0,src.indexOf('  function note(msg)'))+"  store={space:'synthetic'}; return {ls,storageUsage}; })(); globalThis.api=V2FF;";
  const c={window:{localStorage:real},location:{search:''}};
  vm.createContext(c);vm.runInContext(src,c);return c.api;
}
test('ten writes keep newest three per store, survive reopen, preserve other keys',()=>{
  const real=storage(),a=app(real),base='v2ff_backup_synthetic_';
  for(const key of ['ffv6_pre_import_other_1700000000000','ffv6_pre_pull_test_1700000000000','sync_record'])real.setItem(base+key,'keep');
  for(let i=0;i<10;i++)a.ls.setItem('ffv6_pre_import_test_1700000000000',JSON.stringify({i}));
  const b=app(real),keys=Object.keys(b.ls).filter(k=>k.startsWith('ffv6_pre_import_test_'));
  assert.equal(keys.length,3);
  assert.deepEqual(keys.map(k=>JSON.parse(b.ls.getItem(k)).i),[7,8,9]);
  for(const key of ['ffv6_pre_import_other_1700000000000','ffv6_pre_pull_test_1700000000000','sync_record'])assert.equal(real.getItem(base+key),'keep');
  assert.equal(b.storageUsage(),[...real.data].reduce((n,[k,v])=>n+2*(k.length+v.length),0));
});
test('synthetic year-sized backups do not fill storage after repeated imports',()=>{
  const real=storage(5*1024*1024),a=app(real);
  real.setItem('unrelated','x'.repeat(1000000));
  for(let i=0;i<40;i++)a.ls.setItem('ffv6_pre_import_test_'+(1700000000000+i),'x'.repeat(120000));
  assert.equal(Object.keys(a.ls).filter(k=>k.startsWith('ffv6_pre_import_test_')).length,3);
  assert.equal(real.getItem('unrelated').length,1000000);
});
test('capacity preflight and smaller browser quota reject safely; retry can succeed',()=>{
  const real=storage(1800),a=app(real),key='ffv6_pre_import_test_1700000000000';
  for(let i=0;i<3;i++)a.ls.setItem(key,'x'.repeat(100));
  assert.throws(()=>a.ls.setItem(key,'x'.repeat(1000)));
  assert.ok(Object.keys(a.ls).length>=2);
  a.ls.setItem(key,'x'.repeat(100));
  assert.equal(Object.keys(a.ls).length,3);
  const before=[...real.data];
  assert.throws(()=>a.ls.setItem(key,'x'.repeat(3*1024*1024)));
  assert.deepEqual([...real.data],before);
});
