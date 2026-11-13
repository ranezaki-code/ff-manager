'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {test}=require('node:test');
const path=require('node:path');
const hash=s=>require('node:crypto').createHash('sha1').update(s).digest('hex');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'ws/index.html'),'utf8');
const fn=name=>{ const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);return source.slice(start,end+2); };
for(const file of ['ws/index.html','v2/ws/index.html','v2/wstest.html']){
  test(file+': inline syntax, LF and version',()=>{
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.equal(html.includes('\r'),false);
    assert.equal(html.includes('\uFFFD'),false);
    assert.ok(html.includes('5.39.2'));
    let count=0;
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
      if(/\bsrc=/.test(match[1])||(/\btype=/.test(match[1])&&!match[1].includes('id="v2-main"')))continue;
      const result=spawnSync(process.execPath,['--check'],{input:match[2],encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);count++;
    }
    assert.ok(count>0);
  });
}
const item=(id,tag,k='fire')=>({id,w:{id},tag,tr:tag==='sample-a'?0:1,k});
function context(q,late,tab=null){
  return vm.createContext({q,late,_amNx:{tab},amNxLongLate:()=>late,amKindName:k=>k,escapeHtml:s=>s});
}
for(const [label,q,late,expected] of [
  ['empty',[],[],0],
  ['only held next round',[],[item('held','sample-a')],1],
  ['free and held',[item('free','sample-b')],[item('held','sample-a')],2],
  ['same id once',[item('held','sample-a')],[item('held','sample-a')],1],
  ['soon is not overdue',[item('free','sample-b','soon')],[],0]
])test('tabs: '+label,()=>{
  const ctx=context(q,late);vm.runInContext(fn('amNxTabsHtml'),ctx);
  const html=vm.runInContext('amNxTabsHtml(q)',ctx);
  const all=html.match(/<button[^>]*>([^<]*)<\/button>/)[1];
  assert.equal(Number(all.match(/おくれ (\d+)/)?.[1]||0),expected);
  for(const tag of new Set(q.concat(late).map(x=>x.tag)))assert.ok(html.includes('data-tab="'+tag+'"'));
});
for(const tab of [null,'sample-a','sample-b'])test('heading with held-only overdue: '+tab,()=>{
  const ctx=context([], [item('held','sample-a')],tab);
  ctx.shown=[];ctx.now=1;ctx.kcv=false;ctx.col='';
  const start=source.indexOf('    const lateN=shown.filter'),end=source.indexOf('\n    let after=false;',start);
  assert.ok(start>0&&end>start);
  vm.runInContext(source.slice(start,end),ctx);
  const expected=tab==='sample-b'?0:1;
  assert.equal(Number(ctx.col.match(/おくれ (\d+)/)?.[1]||0),expected);
});
test('long overdue label style and generated body',()=>{
  assert.match(source,/\.nxa \.nxa-rn>\.nm\{display:block\}/);
  assert.match(source,/\.nxa \.nxa-rn \.nxa-run-late\{display:block;font-size:13px/);
  assert.match(source,/\.nxa \.nxa-rn \.nxa-run-late \.am-tr\{display:block;font-size:12px/);
  const generated=fs.readFileSync(path.join(root,'v2/ws/index.html'),'utf8');
  const main=source.match(/<script>\n('use strict';[\s\S]*?)<\/script>/)[1];
  assert.ok(main.length>100000);
  // The build changes embedded navigation and the link to the hub.
  const built=generated.match(/<script type="text\/plain" id="v2-main">([\s\S]*?)<\/script>/)[1];
  const normalize=s=>s.replace(/^    if\(fromHub.*$/m,'    embedded navigation').replaceAll('../app.html?sys=ws','../index.html?sys=ws');
  assert.equal(hash(normalize(built.trim())),hash(normalize(main.trim())));
});
