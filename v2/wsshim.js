/* 新しいシステム（v2）：ワークスケジュールの画面と、新しい保存先のあいだに入る「つなぎ」　2026-10-05
   ワークスケジュールの画面（ws/index.html の写し）は、保存も読み込みも localStorage という名前の箱を通して行う。
   その箱の中身だけを差し替える。画面・計算のコードは書き換えない。
   ・ws_v1_store_<店舗>   → 新しい保存先の「ワークスケジュール × 店舗」の入れ物（1件ずつの記録に分けて保存・組み立てて読み込み）
   ・global_stores / ffv6_stores / current_store_id / ffv6_current → 入口のページの店舗の一覧・いま開いている店舗（読むだけ）
   ・crew_v1_store_<店舗>（クルーの名簿）→ クルーの画面がまだ新しいほうに無いので、この端末の いまのアプリのデータを読むだけ（書かない）
   ・unified_ui_am_roles（売場マップの説明の開閉）→ いままでどおり端末の中
   ・それ以外（端末の中の自動の控え ws_v1_snap_* / ws_v1_emergency_* / ws_v1_autobackup_* / ws_v1_pre_import_* / 名前そろえ前の控え、
     操作の記録、古い同期 Gist の設定、多店舗にする前の古いデータ ws_v1）
       → この画面を開いている間だけの仮の箱。端末にもネットにも残さない＝新しい作りでは「止める」（代わりは 入口の ⚙️ → 履歴）
   ・IndexedDB の自動の控え・操作の記録も止める（いまのアプリの控えに混ざらないように）
   本体のスクリプトは、ページを開いた時にすぐ動かさず、データが届いてからこのファイルが動かす（本体は読み込みと同時にデータを読むため）。 */
const __realLS = window.localStorage;
const indexedDB = { open: function () { const r = {}; setTimeout(function () { try { r.error = new Error('v2：端末の中の控えは使いません'); if (r.onerror) r.onerror({}); } catch (e) {} }, 0); return r; } };

const V2WS = (function () {
  'use strict';
  const MEM = /[?&]mem=1/.test(location.search);
  const LOCAL = /^(unified_ui_am_roles)$/, CREW = /^crew_v1(_store_|$)/;
  const S = JSON.stringify, mem = {};
  let host = null, store = null, stores = [], sid = '', coll = null, cache, booted = false, warned = false, crewSeed = null;
  const KEY = () => 'ws_v1_store_' + sid;
  let seen;   // 画面がいま持っている中身
  function stateStr() { if (cache === undefined) cache = Object.keys(coll.view()).length ? S(coll.getState()) : null; return cache; }
  function block(what) { console.warn('v2：' + what + ' は新しいシステムでは行いません'); if (!warned) { warned = true; try { alert('この操作（' + what + '）は、新しいシステムでは使えません。\nデータを戻したい時は、入口の ⚙️ →「履歴・前の状態に戻す」を使ってください。'); } catch (e) {} } }

  function getItem(k) {
    k = String(k);
    if (LOCAL.test(k)) return __realLS.getItem(k);
    if (CREW.test(k)) return MEM ? ((crewSeed && k in crewSeed) ? crewSeed[k] : null) : __realLS.getItem(k);
    if (k === 'current_store_id' || k === 'ffv6_current') return (k in mem) ? mem[k] : (sid || null);
    if (coll && k === KEY()) { seen = stateStr(); return seen; }
    return (k in mem) ? mem[k] : null;
  }
  function setItem(k, v) {
    k = String(k); v = String(v);
    if (LOCAL.test(k)) { __realLS.setItem(k, v); return; }
    if (CREW.test(k)) { console.warn('v2：クルーの名簿は、この画面からは書きません'); return; }
    if (coll && k === KEY()) {
      let st; try { st = JSON.parse(v); } catch (e) { console.error('v2：保存する中身を読めません', e); return; }
      if (!coll.synced) { console.warn('v2：まだ読み込めていないので保存しません'); return; }
      if (!st || typeof st !== 'object' || Array.isArray(st)) { console.warn('v2：保存する中身の形がちがうので保存しません'); return; }
      coll.setState(st); coll._state = null; cache = undefined; seen = stateStr();
      return;
    }
    mem[k] = v;
  }
  function removeItem(k) {
    k = String(k);
    if (LOCAL.test(k)) { __realLS.removeItem(k); return; }
    if (CREW.test(k)) return;
    if (coll && k === KEY()) { block('店舗のデータをまるごと消す'); return; }
    delete mem[k];
  }
  function keys() {
    const out = Object.keys(mem);
    if (coll && Object.keys(coll.view()).length) out.push(KEY());
    if (!MEM) { for (let i = 0; i < __realLS.length; i++) { const k = __realLS.key(i); if (LOCAL.test(k) || CREW.test(k)) out.push(k); } } else if (crewSeed) Object.keys(crewSeed).forEach(k => out.push(k));
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
  // seed（答え合わせ・試験用）＝{stores:[{id,name}], current:'id', state:文字列, crew:{名前:文字列}, store:共通の保存先}
  async function init(seed) {
    if (MEM) {
      store = (seed && seed.store) || new V2.Store({ backend: new V2.MemoryCloud().device(), space: 'MEM', device: 'mem', kv: new V2.MemKV(), snapshot: false });
      stores = (seed && seed.stores) || [{ id: 's', name: '見本' }]; sid = (seed && seed.current) || stores[0].id; crewSeed = (seed && seed.crew) || null;
      coll = await store.open('ws~' + sid, 'ws');
      if (seed && seed.state != null) { coll.setRecs(V2.SPECS.ws.split(JSON.parse(seed.state), {}, coll), { why: 'import' }); await store.settle(60000); }
    } else {
      host = (window.parent && window.parent !== window) ? window.parent.V2APP : null;
      if (!host) { note('このページは、新しいシステムの入口から開いてください。'); return false; }
      note('データを読み込んでいます…');
      store = host.store(); stores = host.stores(); sid = host.storeId();
      coll = await host.openStore('ws', sid);
      for (let i = 0; i < 600 && !coll.synced; i++) { note('データを読み込んでいます…（ネットにつながると表示されます。それまでは入力できません）'); await new Promise(r => setTimeout(r, 500)); }
      // 5分待っても届かない時は、画面を開かない（開くと、入力しても保存されないまま使えてしまうため）
      if (!coll.synced) { note('データを読み込めませんでした。ネットにつながる所で、もう一度開いてください。'); return false; }
      note('');
    }
    mem.global_stores = S(stores); mem.ffv6_stores = S(stores.map(s => ({ id: s.id, name: s.name || '' })));
    const off = coll.onChange(remote => { cache = undefined; if (remote && booted && stateStr() !== seen) {   // 自分の保存が送り終わった知らせ（中身は画面と同じ）では描き直さない
       try { window.dispatchEvent(new StorageEvent('storage', { key: KEY() })); } catch (e) { console.warn(e); } } });
    window.addEventListener('pagehide', off);
    window.__v2 = { store, coll, sid };
    // 本体を動かす（元のファイルでは、ページを開いた時にそのまま動いていた部分）
    const src = document.getElementById('v2-main'); const s = document.createElement('script'); s.textContent = src.textContent; document.body.appendChild(s);
    booted = true; window.__v2ready = true;
    return true;
  }
  function start() {
    if (MEM && /[?&]wait=1/.test(location.search)) { window.__v2go = seed => init(seed); return; }
    init(null).catch(e => { console.error('v2 ws start', e); note('データを読み込めませんでした：' + (e && e.message || e)); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  return { ls, keys, MEM };
})();
const localStorage = V2WS.ls;
