// 端末で選んだ実績だけを読む。確認中は保存しない。
function jiImportName(v){ return String(v||'').normalize('NFKC').replace(/[\s「」『』]/g,'').replace(/[-－]/g,'ー'); }
function jiImportNumber(v){
  if(typeof v==='number')return Number.isSafeInteger(v)&&v>=0?v:null;
  if(typeof v!=='string')return null;
  const s=v.normalize('NFKC').trim();
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s))return null;
  const n=Number(s.replace(/,/g,'')); return Number.isSafeInteger(n)?n:null;
}
function jiImportCSV(text){
  const rows=[]; let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){ if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c; }
    else if(c==='"'&&!cell&&!closed)quoted=true;
    else if(c===','||c==='\n'||c==='\r'){
      row.push(cell);cell='';closed=false;
      if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++; if(row.some(x=>x!==''))rows.push(row);row=[];}
    }else{if(closed||c==='"')throw Error('format');cell+=c;}
  }
  if(quoted)throw Error('format');
  row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows;
}
function jiImportParse(text){
  if(new TextEncoder().encode(text).length>1048576)throw Error('size');
  text=text.replace(/^\uFEFF/,'').trim(); let obj,items;
  if(text.startsWith('{')){obj=JSON.parse(text);if(obj.kind!=='ff-jisseki'||obj.v!==1||!Array.isArray(obj.items))throw Error('format');items=obj.items;}
  else{
    const rows=jiImportCSV(text),head=rows.shift()||[],code=head[0]==='コード';
    if(JSON.stringify(head)!==JSON.stringify(code?['コード','商品名','定価販売','値引販売','廃棄']:['商品名','定価販売','値引販売','廃棄']))throw Error('format');
    items=rows.map(r=>r.length!==head.length?null:{name:r[code?1:0],teika:r[code?2:1],nebiki:r[code?3:2],haiki:r[code?4:3]});obj={};
  }
  const good=[],bad=[];
  items.forEach((r,i)=>{
    const nums=r&&['teika','nebiki','haiki'].map(k=>jiImportNumber(r[k]));
    if(!r||typeof r.name!=='string'||!jiImportName(r.name)||nums.some(n=>n===null)){bad.push(i+1);return;}
    good.push({name:r.name,teika:nums[0],nebiki:nums[1],haiki:nums[2]});
  });
  let cust=null;
  if(obj.cust!==undefined){
    if(!Array.isArray(obj.cust)||obj.cust.length!==7||obj.cust.some(r=>!Array.isArray(r)||r.length!==24||r.some(n=>jiImportNumber(n)===null)))throw Error('format');
    cust=obj.cust.map(r=>r.map(jiImportNumber));
  }
  return {items:good,bad,cust,from:typeof obj.from==='string'?obj.from:'',to:typeof obj.to==='string'?obj.to:''};
}
function jiImportPlan(data,manual){
  const products=S.PM.filter(p=>p.enabled),mapping=Object.assign(Object.create(null),S.jiImportMap||{},manual||{}),groups=new Map(),unmatched=[];
  data.items.forEach((r,i)=>{
    const key=jiImportName(r.name),id=mapping[key];
    const candidates=products.filter(p=>jiImportName(p.name)===key);
    let p=id?products.find(p=>p.id===id):candidates.length===1?candidates[0]:null;
    if(!p){unmatched.push({r,i});return;}
    p=packParentOf(p)||p;
    const g=groups.get(p.id)||{p,teika:0,nebiki:0,haiki:0,count:0};
    for(const k of ['teika','nebiki','haiki']){g[k]+=r[k];if(!Number.isSafeInteger(g[k]))throw Error('format');}g.count++;groups.set(p.id,g);
  });
  return {groups:[...groups.values()],unmatched,missing:products.filter(p=>!packParentOf(p)&&!groups.has(p.id))};
}
let _jiImport=null;
function closeJiImport(){ document.getElementById('ji-import-modal').remove();_jiImport=null; }
function openJiImport(){
  if(_jiImport)return;
  _jiImport={data:null,manual:Object.create(null),week:S.activeWeek,store:currentStoreId,period:S.weekStart};
  const el=document.createElement('dialog');el.id='ji-import-modal';el.style.cssText='width: min(680px, calc(100% - 32px));max-height:85vh;box-sizing:border-box;border:1px solid #ccc;border-radius:12px;padding:16px;overflow:auto';
  el.innerHTML=`<style>#ji-import-modal button,#ji-import-modal select,#ji-import-modal input[type=file],#ji-import-modal label{min-height:44px;max-width:100%;box-sizing:border-box}#ji-import-modal label{display:flex;align-items:center;gap:8px}#ji-import-modal td{padding:8px;overflow-wrap:anywhere}#ji-import-modal table{width:100%;table-layout:fixed}</style><h3>${t('jiImport.open')}</h3><label>${t('jiImport.file')}<input type="file" accept=".json,.csv" onchange="jiImportFile(this.files[0])"></label><label for="ji-import-text">${t('jiImport.paste')}</label><textarea id="ji-import-text" style="width:100%;box-sizing:border-box;min-height:100px"></textarea><button onclick="jiImportRead(document.getElementById('ji-import-text').value)">${t('jiImport.preview')}</button><div id="ji-import-preview" aria-live="polite"></div><button onclick="closeJiImport()">${t('jiImport.close')}</button>`;
  el.addEventListener('cancel',e=>{e.preventDefault();closeJiImport();});document.body.appendChild(el);el.showModal();
}
async function jiImportFile(file){
  if(!file)return;const session=_jiImport;
  if(file.size>1048576){jiImportRead(' '.repeat(1048577));return;}
  try{const text=await file.text();if(_jiImport===session)jiImportRead(text);}catch(_){if(_jiImport===session)jiImportRead('');}
}
function jiImportRead(text){
  _jiImport.data=null;_jiImport.manual=Object.create(null);
  try{_jiImport.data=jiImportParse(text);jiImportPreview();}
  catch(e){document.getElementById('ji-import-preview').textContent=t(e.message==='size'?'jiImport.size':'jiImport.error');}
}
function jiImportMismatch(data){
  const r=getPrevWeekRange(),iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return !r||data.from!==iso(r.start)||data.to!==iso(r.end);
}
function jiImportPreview(){
  const data=_jiImport.data,plan=jiImportPlan(data,_jiImport.manual),esc=escapeHtmlP;
  let html=`<p>${t('jiImport.period')}: ${esc(data.from||'—')} 〜 ${esc(data.to||'—')}<br>${t('jiImport.week')}: ${esc(fmtPrevWeekShort())}</p>`;
  if(jiImportMismatch(data))html+=`<p style="color:#b91c1c">${t('jiImport.mismatch')}</p><label><input type="checkbox" id="ji-import-anyway">${t('jiImport.anyway')}</label>`;
  html+=`<table><thead><tr><th>${t('jisseki.productName')}</th><th>${t('jiImport.values')}</th></tr></thead><tbody>`;
  for(const g of plan.groups){const old=S.ji[g.p.id]||{};html+=`<tr><td>${esc(g.p.name)}</td><td>${['teika','nebiki','haiki'].map(k=>`<span style="${(old[k]||0)!==g[k]?'background:#fef3c7;color:#92400e':''}">${old[k]||0} → ${g[k]}</span>`).join(' / ')}</td></tr>`;}
  html+='</tbody></table><h4>'+t('jiImport.unmatched')+'</h4>';
  for(const {r,i} of plan.unmatched)html+=`<label>${esc(r.name)}<select onchange="_jiImport.manual[jiImportName(_jiImport.data.items[${i}].name)]=this.value;jiImportPreview()"><option value="">—</option>${S.PM.filter(p=>p.enabled).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>`;
  html+=`<h4>${t('jiImport.missing')}</h4><p>${plan.missing.map(p=>esc(p.name)).join(' / ')||'—'}</p><h4>${t('jiImport.bad')}</h4><p>${data.bad.join(', ')||'—'}</p>`;
  if(data.cust)html+=`<label><input type="checkbox" id="ji-import-cust" checked>${t('jiImport.cust')}</label>`;
  html+=`<button onclick="jiImportApply()">${t('jiImport.apply')}</button>`;document.getElementById('ji-import-preview').innerHTML=html;
}
function jiImportApply(){
  const session=_jiImport;if(!session||!session.data)return;
  if(session.week!==S.activeWeek||session.store!==currentStoreId||session.period!==S.weekStart){closeJiImport();return;}
  if(jiImportMismatch(session.data)&&!document.getElementById('ji-import-anyway').checked)return;
  const plan=jiImportPlan(session.data,session.manual),cust=session.data.cust&&document.getElementById('ji-import-cust').checked;
  if(!plan.groups.length&&!cust)return;
  // 保存済みの状態に、いま開いている週の入力中の値も重ねて控える。
  try{
    const backup=JSON.parse(JSON.stringify(_ffSaveObj()));
    if(backup.activeWeek&&backup.weeks[backup.activeWeek])Object.assign(backup.weeks[backup.activeWeek],{ji:backup.ji,cust:backup.cust});
    localStorage.setItem('ffv6_pre_import_'+currentStoreId+'_'+Date.now(),JSON.stringify(backup));
  }catch(_){alert(t('jiImport.backup'));return;}
  for(const g of plan.groups)S.ji[g.p.id]={teika:g.teika,nebiki:g.nebiki,haiki:g.haiki};
  if(cust)S.cust=session.data.cust.map(r=>r.slice());
  S.jiImportMap=Object.assign(Object.create(null),S.jiImportMap||{},session.manual);
  saveS();renderJissekiTable();renderCustGrid();renderRanking();
  const count=plan.groups.reduce((n,g)=>n+g.count,0);closeJiImport();alert(tf('jiImport.done',plan.groups.length,count));
}
