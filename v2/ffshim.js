/* 新しいシステム（v2）：FF管理の画面と、新しい保存先のあいだに入る「つなぎ」　2026-10-05
   FF管理の画面（ff/index.html の写し）は、保存も読み込みも localStorage という名前の箱を通して行う（200か所以上）。
   その箱の中身だけを差し替える。画面・計算のコードは書き換えない。
   ・ffv6_store_<店舗>      → 新しい保存先の「FF × 店舗」の入れ物（1件ずつの記録に分けて保存・組み立てて読み込み）
   ・ffv6_setup_<店舗>      → 同じ入れ物の「初期設定の済み印」
   ・ffv6_stores / global_stores / ffv6_current / current_store_id → 入口のページの店舗の一覧・いま開いている店舗（読むだけ）
   ・ffv6_lang など端末ごとの設定 → いままでどおり端末の中（言葉の切り替え・カテゴリの開閉・並び順・AI機能の鍵）
   ・それ以外（端末の中の自動の控え ffv6_snap_* / ffv6_emergency_* / ffv6_pre_import_*、操作の記録、古い同期 Gist の設定）
       → この画面を開いている間だけの仮の箱。端末にもネットにも残さない＝新しい作りでは「止める」（代わりは 入口の ⚙️ → 履歴）
   ・IndexedDB の自動の控え・ほかのタブへの知らせ（BroadcastChannel）も止める（いまのアプリの控えに混ざらないように） */
const __realLS = window.localStorage;
try { window.BroadcastChannel = undefined; } catch (e) {}
const indexedDB = { open: function () { const r = {}; setTimeout(function () { try { r.error = new Error('v2：端末の中の控えは使いません'); if (r.onerror) r.onerror({}); } catch (e) {} }, 0); return r; } };

const V2FF = (function () {
  'use strict';
  const MEM = /[?&]mem=1/.test(location.search);
  const LOCAL = /^(ffv6_lang|ffv6_collapsed_cats|ffv6_prodMasterSort|claude_api_key|gd_client_id|gd_access_token|gd_token_expiry)$/;
  const S = JSON.stringify, mem = {}, colls = {}, cache = {};
  let host = null, store = null, stores = [], sid = '', booted = false, warned = false;
  const idOf = (k, p) => (k.indexOf(p) === 0 && colls[k.slice(p.length)]) ? k.slice(p.length) : null;
  function hasData(id) { return Object.keys(colls[id].view()).some(r => r !== 's:__setup'); }
  function stateStr(id) { if (!(id in cache)) cache[id] = hasData(id) ? S(colls[id].getState()) : null; return cache[id]; }
  function seedStores() { mem.ffv6_stores = S(stores.map(s => ({ id: s.id, name: s.name || '' }))); mem.global_stores = S(stores); }
  function block(what) { console.warn('v2：' + what + ' は新しいシステムでは行いません'); if (!warned) { warned = true; try { alert('この操作（' + what + '）は、新しいシステムでは使えません。\nデータを戻したい時は、入口の ⚙️ →「履歴・前の状態に戻す」を使ってください。'); } catch (e) {} } }

  function getItem(k) {
    k = String(k);
    if (LOCAL.test(k)) return __realLS.getItem(k);
    if (k === 'ffv6_current' || k === 'current_store_id') return (k in mem) ? mem[k] : (sid || null);
    let id = idOf(k, 'ffv6_store_'); if (id) return stateStr(id);
    id = idOf(k, 'ffv6_setup_'); if (id) return ('s:__setup' in colls[id].view()) ? '1' : null;
    return (k in mem) ? mem[k] : null;
  }
  function setItem(k, v) {
    k = String(k); v = String(v);
    if (LOCAL.test(k)) { __realLS.setItem(k, v); return; }
    let id = idOf(k, 'ffv6_store_');
    if (id) {
      const c = colls[id]; let st; try { st = JSON.parse(v); } catch (e) { console.error('v2：保存する中身を読めません', e); return; }
      if (!c.synced) { console.warn('v2：まだ読み込めていないので保存しません'); return; }
      c.setState(st); c._state = null; delete cache[id];     // 開いている週だけ変わった時（記録は変わらない）も、組み立て直す
      if (!MEM && c.local.activeWeek) { try { __realLS.setItem('v2ff_week_' + id, c.local.activeWeek); } catch (e) {} }
      return;
    }
    id = idOf(k, 'ffv6_setup_'); if (id) { if (colls[id].synced) colls[id].setRecs({ 's:__setup': '"1"' }); return; }
    mem[k] = v;
  }
  function removeItem(k) {
    k = String(k);
    if (LOCAL.test(k)) { __realLS.removeItem(k); return; }
    if (idOf(k, 'ffv6_store_')) { block('店舗のデータをまるごと消す'); return; }
    if (idOf(k, 'ffv6_setup_')) { block('初期設定をやり直す'); return; }
    delete mem[k];
  }
  function keys() {
    const out = Object.keys(mem);
    Object.keys(colls).forEach(id => { if (hasData(id)) out.push('ffv6_store_' + id); if ('s:__setup' in colls[id].view()) out.push('ffv6_setup_' + id); });
    for (let i = 0; i < __realLS.length; i++) { const k = __realLS.key(i); if (LOCAL.test(k)) out.push(k); }
    return out.filter((k, i, a) => a.indexOf(k) === i);
  }
  const api = { getItem, setItem, removeItem, key: i => keys()[i] === undefined ? null : keys()[i], clear: () => block('全部消す') };
  const ls = new Proxy({}, {
    get: (t, p) => (p in api) ? api[p] : (p === 'length' ? keys().length : (typeof p === 'string' ? (getItem(p) === null ? undefined : getItem(p)) : undefined)),
    set: (t, p, v) => { setItem(p, v); return true; },
    has: (t, p) => (p in api) || getItem(p) !== null,
    deleteProperty: (t, p) => { removeItem(p); return true; },
    ownKeys: () => keys(),
    getOwnPropertyDescriptor: (t, p) => (typeof p === 'string' && getItem(p) !== null) ? { value: getItem(p), enumerable: true, configurable: true, writable: true } : undefined
  });

  function note(msg) {
    let n = document.getElementById('v2-wait');
    if (msg && !n) { n = document.createElement('div'); n.id = 'v2-wait'; n.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f1f5f9;color:#334155;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:600 15px/1.8 -apple-system,"Hiragino Sans","Yu Gothic",sans-serif'; (document.body || document.documentElement).appendChild(n); }
    if (n) { if (msg) n.textContent = msg; else n.remove(); }
  }
  function wire(id) {
    const c = colls[id];
    if (!MEM) { try { const w = __realLS.getItem('v2ff_week_' + id); if (w) c.local.activeWeek = w; } catch (e) {} }
    const off = c.onChange(remote => { delete cache[id]; if (remote && booted) { try { window.dispatchEvent(new StorageEvent('storage', { key: 'ffv6_store_' + id })); } catch (e) { console.warn(e); } } });
    window.addEventListener('pagehide', off);
  }
  // seed（答え合わせ・試験用）＝{stores:[{id,name}], current:'id', states:{id:文字列}, setup:{id:true}, store:共通の保存先（省くと新しく作る）}
  async function init(seed) {
    if (MEM) {
      store = (seed && seed.store) || new V2.Store({ backend: new V2.MemoryCloud().device(), space: 'MEM', device: 'mem', kv: new V2.MemKV(), snapshot: false });
      stores = (seed && seed.stores) || [{ id: 's', name: '見本' }]; sid = (seed && seed.current) || stores[0].id;
      for (const s of stores) { colls[s.id] = await store.open('ff~' + s.id, 'ff'); }
      if (seed && seed.states) { for (const id of Object.keys(seed.states)) { if (!colls[id] || seed.states[id] == null) continue; const recs = V2.SPECS.ff.split(JSON.parse(seed.states[id]), {}, colls[id]); if (seed.setup && seed.setup[id]) recs['s:__setup'] = '"1"'; colls[id].setRecs(recs, { why: 'import' }); } await store.settle(60000); }
    } else {
      host = (window.parent && window.parent !== window) ? window.parent.V2APP : null;
      if (!host) { note('このページは、新しいシステムの入口から開いてください。'); return false; }
      note('データを読み込んでいます…');
      store = host.store(); stores = host.stores(); sid = host.storeId();
      for (const s of stores) { colls[s.id] = await host.openStore('ff', s.id); }
    }
    seedStores(); Object.keys(colls).forEach(wire);
    if (!MEM) {
      for (let i = 0; i < 600 && !Object.keys(colls).every(id => colls[id].synced); i++) { note('データを読み込んでいます…（ネットにつながると表示されます。それまでは入力できません）'); await new Promise(r => setTimeout(r, 500)); }
      // 5分待っても届かない時は、画面を開かない（開くと、入力しても保存されないまま使えてしまうため）
      if (!Object.keys(colls).every(id => colls[id].synced)) { note('データを読み込めませんでした。ネットにつながる所で、もう一度開いてください。'); return false; }
      note('');
    }
    window.__v2 = { store, colls, sid };
    await window.__v2boot();
    booted = true; window.__v2ready = true;
    return true;
  }
  function start() {
    if (MEM && /[?&]wait=1/.test(location.search)) { window.__v2go = seed => init(seed); return; }   // 答え合わせ：親のページが見本を渡してから始める
    init(null).catch(e => { console.error('v2 ff start', e); note('データを読み込めませんでした：' + (e && e.message || e)); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { ls, keys, MEM };
})();
const localStorage = V2FF.ls;
