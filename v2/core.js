/* 新しいシステム（v2）の土台：保存と読み込みの共通部品　2026-10-05
   考え方
   ・本物のデータはネット上（Firestore）に「1件ずつ」の文書として置く。端末は窓。
   ・画面が「全部を保存」と言ったら、前の中身と比べて、変わった1件だけを送る。
   ・1件ごとに版の番号（rev）を持つ。送る時は必ず「自分が見ていた版」と比べる。相手が先に進んでいたら、
     自分が変えた項目だけを重ねる（3方向の合成）。古い状態の端末は、自分が変えていない項目を書き戻せない。
   ・消すのは「消した印」。消した記録は、古い端末の保存では戻らない（戻すのは履歴の画面からだけ）。
   ・変えるたびに、変える前の中身を履歴の文書に残す。負けた側の入力も履歴に残す。
   ・ネットが切れている間の変更は端末（IndexedDB）にため、つながったら送る。
   いまの決まり（keiei_stores の文書を1件ずつ get・create・update できる。一覧と削除はできない）の中だけで動く：
   ・記録の一覧は「索引」の文書で持つ（一覧の代わり）。ほかの端末の変更は索引1件を見張って知る。
   文書の名前： <場所>~i~<入れ物>            索引（記録の名前 → 版の番号）
                <場所>~r~<入れ物>~<記録>     記録1件（中身は文字列 d）
                <場所>~h~<入れ物>~<記録>~<版> 履歴（その版になる前の中身）
                <場所>~l~<入れ物>~<日付>     その日の変更の一覧
                <場所>~s~<入れ物>~<日付>     1日1回の全体の写し
   <場所> は合言葉から作る（いまのアプリの場所とは別の作り方なので、いまのデータの文書とは重ならない）。 */
(function (g) {
  'use strict';
  var S = JSON.stringify;
  function clone(x) { return x === undefined ? undefined : JSON.parse(S(x)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function enc(s) { return encodeURIComponent(String(s)).replace(/~/g, '%7E').replace(/\./g, '%2E'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayStr(t) { var d = t ? new Date(t) : new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sha256hex(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function spaceOf(pass) { return sha256hex('keiei-v2-space::' + pass); }   // いまのアプリ（'keiei::'）とは別の場所になる
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- 3方向の合成 ----------
  // b＝自分が見ていた中身、m＝自分の今の中身、t＝相手（ネット上）の今の中身。
  // 片方だけが変えた項目は変えた側。両方が変えた項目は、あとから入力したほう（mineWins）。負けた側は lost に入れる。
  function merge3(b, m, t, mineWins, depth, path, lost) {
    var ms = S(m), ts = S(t), bs = S(b);
    if (ms === ts) return m;
    if (ms === bs) return t;
    if (ts === bs) return m;
    if (depth > 0 && isObj(m) && isObj(t)) {
      var bb = isObj(b) ? b : {}, out = {}, seen = {};
      Object.keys(t).concat(Object.keys(m)).forEach(function (k) {
        if (seen[k]) return; seen[k] = 1;
        var v = merge3(bb[k], m[k], t[k], mineWins, depth - 1, path ? path + '.' + k : k, lost);
        if (v !== undefined) out[k] = v;
      });
      return out;
    }
    lost.push({ path: path, mine: m, theirs: t, kept: mineWins ? 'mine' : 'theirs' });
    return mineWins ? m : t;
  }
  // op＝{base:{rev,d,del}|null, next:文字列|null(＝消す), t:入力した時刻}、remote＝ネット上の今の記録（無ければ null）
  // 戻り値 {write:文字列|null} ＝書く／{noop:true} ＝書かない。lost＝負けた側の入力（履歴に残す）
  function resolve(op, remote) {
    var baseRev = op.base ? op.base.rev : 0, rRev = remote ? remote.rev : 0;
    var rDel = !remote || !!remote.del;
    if (op.force) { if (op.next === null) return rDel ? { noop: true } : { write: null }; return (!rDel && remote.d === op.next) ? { noop: true } : { write: op.next }; }
    if (rRev === baseRev) {                                   // 相手は進んでいない → そのまま書ける
      if (op.next === null) return rDel ? { noop: true } : { write: null };
      if (!rDel && remote.d === op.next) return { noop: true };
      return { write: op.next };
    }
    if (op.next === null) {                                   // 自分は「消す」、相手は先に変えていた → 相手の変更を残す
      if (rDel) return { noop: true };
      return { noop: true, lost: { kind: 'delete-vs-edit' } };
    }
    if (rDel) {                                               // 相手が先に消していた → 消したまま。自分の入力は履歴へ
      if (rRev === 0) return { write: op.next };
      return { noop: true, lost: { kind: 'edit-vs-delete', mine: op.next } };
    }
    if (remote.d === op.next) return { noop: true };
    var b, m, t;
    try { b = (op.base && !op.base.del) ? JSON.parse(op.base.d) : undefined; m = JSON.parse(op.next); t = JSON.parse(remote.d); }
    catch (e) { return { noop: true, lost: { kind: 'unreadable', mine: op.next } }; }
    var lost = [], mineWins = (op.t || 0) > (remote.ct || 0);
    var out = S(merge3(b, m, t, mineWins, 6, '', lost));
    var L = lost.length ? { kind: 'field', items: lost } : null;
    if (out === remote.d) return { noop: true, lost: L };
    return { write: out, lost: L };
  }

  // ---------- 端末の中の置き場所（IndexedDB。試験ではメモリ） ----------
  function MemKV() { this.m = {}; }
  MemKV.prototype.get = function (k) { return Promise.resolve(this.m[k] === undefined ? undefined : clone(this.m[k])); };
  MemKV.prototype.set = function (k, v) { this.m[k] = clone(v); return Promise.resolve(); };
  MemKV.prototype.del = function (k) { delete this.m[k]; return Promise.resolve(); };
  MemKV.prototype.keys = function () { return Promise.resolve(Object.keys(this.m)); };
  function IdbKV(name) { this.name = name; this.dbp = null; }
  IdbKV.prototype._db = function () {
    var self = this;
    if (!this.dbp) this.dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(self.name, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return this.dbp;
  };
  IdbKV.prototype._tx = function (mode, fn) {
    return this._db().then(function (db) { return new Promise(function (res, rej) {
      var tx = db.transaction('kv', mode), out, rq = fn(tx.objectStore('kv'));
      if (rq) rq.onsuccess = function () { out = rq.result; };
      tx.oncomplete = function () { res(out); }; tx.onerror = function () { rej(tx.error); }; tx.onabort = function () { rej(tx.error); };
    }); });
  };
  IdbKV.prototype.get = function (k) { return this._tx('readonly', function (s) { return s.get(k); }); };
  IdbKV.prototype.set = function (k, v) { return this._tx('readwrite', function (s) { s.put(v, k); }); };
  IdbKV.prototype.del = function (k) { return this._tx('readwrite', function (s) { s.delete(k); }); };
  IdbKV.prototype.keys = function () { return this._tx('readonly', function (s) { return s.getAllKeys(); }); };

  // ---------- 保存先その1：試験用（ネットにつながない。何台ぶんでも同じ「ネット上」を共有できる） ----------
  function MemoryCloud() { this.docs = {}; this.watchers = []; this.chain = Promise.resolve(); this.reads = 0; this.writes = 0; }
  MemoryCloud.prototype.device = function () { return new MemoryBackend(this); };
  function MemoryBackend(cloud) { this.cloud = cloud; this.online = true; this.reads = 0; this.writes = 0; this.subs = []; }
  MemoryBackend.prototype._chk = function () { if (!this.online) { var e = new Error('offline'); e.offline = true; throw e; } };
  MemoryBackend.prototype.get = function (id) {
    var self = this;
    return Promise.resolve().then(function () { self._chk(); self.reads++; self.cloud.reads++; var d = self.cloud.docs[id]; return d ? clone(d) : null; });
  };
  MemoryBackend.prototype.txn = function (readIds, fn) {
    var self = this, c = this.cloud;
    var p = c.chain.then(function () {
      self._chk();
      var docs = {}; readIds.forEach(function (id) { self.reads++; c.reads++; docs[id] = c.docs[id] ? clone(c.docs[id]) : null; });
      var r = fn(docs) || {}, w = r.writes || {}, now = Date.now();
      Object.keys(w).forEach(function (id) { var d = clone(w[id]); d.at = now; c.docs[id] = d; self.writes++; c.writes++; });
      var ids = Object.keys(w);
      setTimeout(function () { c.watchers.forEach(function (x) { if (ids.indexOf(x.id) >= 0 && x.be.online) x.cb(clone(c.docs[x.id])); }); }, 0);
      return r;
    });
    c.chain = p.catch(function () {});
    return p;
  };
  MemoryBackend.prototype.watch = function (id, cb) {
    var self = this, c = this.cloud, w = { id: id, cb: cb, be: this };
    c.watchers.push(w); this.subs.push(w);
    setTimeout(function () { if (self.online) { self.reads++; c.reads++; cb(c.docs[id] ? clone(c.docs[id]) : null); } }, 0);
    return function () { var i = c.watchers.indexOf(w); if (i >= 0) c.watchers.splice(i, 1); };
  };
  MemoryBackend.prototype.setOnline = function (on) {
    var self = this, c = this.cloud; this.online = !!on;
    if (on) this.subs.forEach(function (w) { if (c.watchers.indexOf(w) >= 0) setTimeout(function () { self.reads++; c.reads++; w.cb(c.docs[w.id] ? clone(c.docs[w.id]) : null); }, 0); });
    if (this.onOnline) this.onOnline(on);
  };

  // ---------- 保存先その2：本番（Firestore。いまと同じプロジェクト・同じ入れ物の中の、別の名前の文書） ----------
  function FirestoreBackend(db, collection) { this.db = db; this.col = db.collection(collection); this.reads = 0; this.writes = 0; this.online = true; }
  function fsOffline(e) { var c = (e && e.code) || ''; return c === 'unavailable' || c === 'deadline-exceeded' || c === 'cancelled' || /offline|network/i.test((e && e.message) || ''); }
  function strip(d) { if (d && d.at !== undefined) { var t = d.at; d.at = t && t.toMillis ? t.toMillis() : (t || 0); } return d; }
  FirestoreBackend.prototype.get = function (id) {
    var self = this;
    return this.col.doc(id).get({ source: 'server' }).then(function (s) { self.reads++; return s.exists ? strip(s.data()) : null; })
      .catch(function (e) { if (fsOffline(e)) e.offline = true; throw e; });
  };
  FirestoreBackend.prototype.txn = function (readIds, fn) {
    var self = this, col = this.col, out = null, nw = 0;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { var e0 = new Error('offline'); e0.offline = true; return Promise.reject(e0); }
    return this.db.runTransaction(function (tx) {
      return Promise.all(readIds.map(function (id) { return tx.get(col.doc(id)); })).then(function (snaps) {
        var docs = {}; snaps.forEach(function (s, i) { docs[readIds[i]] = s.exists ? strip(s.data()) : null; });
        self.reads += readIds.length;
        out = fn(docs) || {}; var w = out.writes || {}; nw = Object.keys(w).length;
        Object.keys(w).forEach(function (id) { var d = Object.assign({}, w[id]); d.at = firebase.firestore.FieldValue.serverTimestamp(); tx.set(col.doc(id), d); });
      });
    }).then(function () { self.writes += nw; return out; })
      .catch(function (e) { if (fsOffline(e)) e.offline = true; throw e; });
  };
  FirestoreBackend.prototype.watch = function (id, cb, onErr) {
    var self = this;
    return this.col.doc(id).onSnapshot(function (s) {
      if (s.metadata && s.metadata.hasPendingWrites) return;
      self.reads++; cb(s.exists ? strip(s.data()) : null);
    }, function (e) { if (onErr) onErr(e); });
  };

  // ---------- 入れ物ごとの「分け方・組み立て方」 ----------
  var SPECS = {};
  function defineSpec(name, spec) { SPECS[name] = spec; }
  // 一覧（配列）を1件ずつに分ける時の、並び順の番号 o の付け方：前の番号をできるだけ保つ（1件足しても、ほかの記録は書き換えない）
  function splitList(list, prefix, idOf, prev, out) {
    var last = -1, used = {};
    (list || []).forEach(function (item, i) {
      var id = idOf(item, i), key = prefix + id, n = 2;
      while (used[key]) { key = prefix + id + '#' + (n++); }
      used[key] = 1;
      var po; try { po = prev && prev[key] ? JSON.parse(prev[key]).o : undefined; } catch (e) { po = undefined; }
      var o = (typeof po === 'number' && po > last) ? po : last + 1;
      last = o; out[key] = S({ o: o, v: item });
    });
  }
  function joinList(recs, prefix) {
    var a = [];
    Object.keys(recs).forEach(function (k) { if (k.indexOf(prefix) === 0) { var r = JSON.parse(recs[k]); a.push([r.o, k, r.v]); } });
    a.sort(function (x, y) { return x[0] !== y[0] ? x[0] - y[0] : (x[1] < y[1] ? -1 : 1); });
    return a.map(function (x) { return x[2]; });
  }
  // カレンダー：予定1件＝記録1件。予定の一覧のほかに項目があれば「_rest」の1件にまとめる
  defineSpec('cal', {
    split: function (st, prev) {
      var out = {}; st = st || {};
      splitList(Array.isArray(st.events) ? st.events : [], 'e:', function (e, i) { return (e && e.id) ? e.id : 'noid' + i; }, prev, out);
      var rest = {}; Object.keys(st).forEach(function (k) { if (k !== 'events') rest[k] = st[k]; });
      if (Object.keys(rest).length) out._rest = S(rest);
      return out;
    },
    join: function (recs) { var st = { events: joinList(recs, 'e:') }; if (recs._rest) { var r = JSON.parse(recs._rest); Object.keys(r).forEach(function (k) { st[k] = r[k]; }); } return st; },
    label: function (key, d) { try { var v = JSON.parse(d); return key === '_rest' ? '設定' : ((v.v.date || '') + ' ' + (v.v.title || '')).slice(0, 40); } catch (e) { return key; } }
  });
  // 全体の設定（店舗の一覧など）：項目1つ＝記録1件
  defineSpec('meta', {
    split: function (st) { var out = {}; Object.keys(st || {}).forEach(function (k) { out[k] = S(st[k]); }); return out; },
    join: function (recs) { var st = {}; Object.keys(recs).forEach(function (k) { st[k] = JSON.parse(recs[k]); }); return st; },
    label: function (key) { return key; }
  });

  // ---------- 本体 ----------
  // opt＝{backend, space, device, kv, snapshot:true|false}
  function Store(opt) {
    this.be = opt.backend; this.space = opt.space; this.device = opt.device || ('dev_' + rid());
    this.kv = opt.kv || new MemKV(); this.tab = rid(); this.colls = {}; this.outbox = []; this.busy = false;
    this.snapshot = opt.snapshot !== false; this.listeners = []; this.error = ''; this.retryT = null; this.loaded = null; this.lastOk = 0;
    this.offline = false;
    var self = this;
    if (this.be instanceof MemoryBackend) this.be.onOnline = function (on) { if (on) self.flush(); self._emit(); };
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', function () { self.offline = false; self.flush(); });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) self.flush(); });
    }
  }
  Store.prototype.id = function (kind, coll, rec, extra) {
    return this.space + '~' + kind + '~' + enc(coll) + (rec !== undefined ? '~' + enc(rec) : '') + (extra !== undefined ? '~' + enc(extra) : '');
  };
  Store.prototype.onStatus = function (cb) { this.listeners.push(cb); };
  Store.prototype.status = function () {
    var n = this.outbox.length, on = this.be.online !== false && !this.offline && (typeof navigator === 'undefined' || navigator.onLine !== false);
    return { pending: n, online: on, error: this.error, busy: this.busy, state: this.error ? 'err' : (!on ? 'off' : (n || this.busy ? 'saving' : 'ok')) };
  };
  Store.prototype._emit = function () { var s = this.status(); this.listeners.forEach(function (cb) { try { cb(s); } catch (e) { console.error(e); } }); };
  Store.prototype._loadOutbox = function () {
    var self = this;
    if (!this.loaded) this.loaded = this.kv.keys().then(function (keys) {
      return Promise.all((keys || []).filter(function (k) { return String(k).indexOf('o:') === 0; }).map(function (k) {
        return self.kv.get(k).then(function (v) {   // 前に送れなかった分（閉じたタブの分も）を引き取る。2重に送っても中身が同じなら書かれない
          if (v && Array.isArray(v.ops)) v.ops.forEach(function (op) { if (!self.outbox.some(function (x) { return x.id === op.id; })) { op.inflight = false; self.outbox.push(op); } });
          if (k !== 'o:' + self.tab && (!v || Date.now() - (v.ts || 0) > 120000)) return self.kv.del(k);
        });
      }));
    }).then(function () { self.outbox.sort(function (a, b) { return (a.t || 0) - (b.t || 0); }); return self._saveOutbox(); }).catch(function (e) { console.warn('v2 outbox load', e); });
    return this.loaded;
  };
  Store.prototype._saveOutbox = function () { return this.kv.set('o:' + this.tab, { ts: Date.now(), ops: this.outbox.map(function (o) { var c = Object.assign({}, o); delete c.inflight; return c; }) }).catch(function (e) { console.warn('v2 outbox save', e); }); };

  // 入れ物を開く。name＝'cal~<店舗>' など、specName＝分け方の名前
  Store.prototype.open = function (name, specName) {
    var self = this;
    if (this.colls[name]) return this.colls[name].ready;
    var c = new Coll(this, name, SPECS[specName]);
    this.colls[name] = c;
    c.ready = this._loadOutbox().then(function () { return self.kv.get('c:' + name); }).then(function (saved) {
      if (saved && saved.recs) { c.recs = saved.recs; c.synced = !!saved.synced; }
      return new Promise(function (res) {
        var done = false, fin = function () { if (!done) { done = true; res(c); } };
        c.unsub = self.be.watch(self.id('i', name), function (idx) { c._onIndex(idx).then(fin, fin); }, function (e) { self.error = '受信できません（' + ((e && e.code) || e) + '）'; self._emit(); fin(); });
        setTimeout(fin, c.synced ? 300 : 6000);     // 端末に前の中身があればすぐ開く。無ければ最初の受信を待つ（最大6秒）
      });
    }).then(function () { self.flush(); return c; });
    return c.ready;
  };

  function Coll(store, name, spec) { this.store = store; this.name = name; this.spec = spec; this.recs = {}; this.synced = false; this.subs = []; this._view = null; this._state = null; this.idxSeq = -1; }
  Coll.prototype.onChange = function (cb) { var s = this.subs; s.push(cb); return function () { var i = s.indexOf(cb); if (i >= 0) s.splice(i, 1); }; };
  Coll.prototype._changed = function (remote) { this._view = null; this._state = null; var self = this; this.store.kv.set('c:' + this.name, { recs: this.recs, synced: this.synced }).catch(function (e) { console.warn('v2 cache save', e); }); this.subs.forEach(function (cb) { try { cb(!!remote); } catch (e) { console.error(e); } }); };
  // いま見えている中身（ネットから受け取った分＋まだ送っていない自分の変更）。記録の名前 → 文字列
  Coll.prototype.view = function () {
    if (this._view) return this._view;
    var v = {}, self = this;
    Object.keys(this.recs).forEach(function (k) { if (!self.recs[k].del) v[k] = self.recs[k].d; });
    this.store.outbox.forEach(function (op) { if (op.coll !== self.name) return; if (op.next === null) delete v[op.rec]; else v[op.rec] = op.next; });
    return (this._view = v);
  };
  Coll.prototype.getState = function () { if (!this._state) this._state = S(this.spec.join(this.view())); return JSON.parse(this._state); };
  Coll.prototype.pending = function () { var n = this.name; return this.store.outbox.filter(function (o) { return o.coll === n; }).length; };
  // 画面からの「全部を保存」。変わった記録だけを送る列に入れる
  Coll.prototype.setState = function (state, why) { return this.setRecs(this.spec.split(state, this.view()), { deleteMissing: true, why: why || 'edit' }); };
  // map＝記録の名前 → 文字列（null は消す）。deleteMissing＝map に無い記録を消す
  Coll.prototype.setRecs = function (map, o) {
    o = o || {}; var self = this, st = this.store, view = this.view(), now = Date.now(), n = 0;
    var put = function (rec, next) {
      var cur = view[rec]; if ((next === null && cur === undefined) || next === cur) return;
      var ops = st.outbox.filter(function (x) { return x.coll === self.name && x.rec === rec; }), lastOp = ops[ops.length - 1];
      var label = ''; try { label = self.spec.label ? self.spec.label(rec, next === null ? (cur || '') : next) : rec; } catch (e) { label = rec; }
      if (lastOp && !lastOp.inflight) {
        lastOp.next = next; lastOp.t = now; lastOp.label = label; if (o.force) lastOp.force = true;
        var b = lastOp.base, same = b && !b.chain && ((next === null && b.del) || (next !== null && !b.del && b.d === next));
        if ((same || (!b && next === null)) && !lastOp.force) st.outbox.splice(st.outbox.indexOf(lastOp), 1);
      } else {
        var base = lastOp ? { chain: lastOp.id } : (self.recs[rec] ? { rev: self.recs[rec].rev, d: self.recs[rec].d, del: !!self.recs[rec].del } : null);
        st.outbox.push({ id: rid(), coll: self.name, rec: rec, base: base, next: next, t: now, why: o.why || 'edit', label: label, force: !!o.force });
      }
      n++;
    };
    Object.keys(map).forEach(function (rec) { put(rec, map[rec]); });
    if (o.deleteMissing) Object.keys(view).forEach(function (rec) { if (!(rec in map)) put(rec, null); });
    if (n) { this._view = null; this._state = null; st._saveOutbox(); st._emit(); this.subs.forEach(function (cb) { try { cb(false); } catch (e) { console.error(e); } }); clearTimeout(st.flushT); st.flushT = setTimeout(function () { st.flush(); }, o.now ? 0 : 150); }
    return n;
  };
  // 索引が届いた：版が進んだ記録だけ取りに行く
  Coll.prototype._onIndex = function (idx) {
    var self = this, st = this.store; idx = idx || { recs: {}, dels: {} };
    var need = Object.keys(idx.recs || {}).filter(function (k) { return !self.recs[k] || self.recs[k].rev < idx.recs[k]; });
    return Promise.all(need.map(function (k) { return st.be.get(st.id('r', self.name, k)).then(function (d) { if (d && (!self.recs[k] || self.recs[k].rev < d.rev)) self.recs[k] = { rev: d.rev, d: d.d, del: !!d.del, ct: d.ct || 0 }; }); })).then(function () {
      var first = !self.synced; self.synced = true; self.idxSeq = idx.seq || 0; st.lastOk = Date.now();
      if (st.error && /受信/.test(st.error)) st.error = '';
      if (need.length || first) self._changed(true);
      st._emit();
      if (first || need.length) self._maybeSnapshot();
    }).catch(function (e) { if (!(e && e.offline)) console.warn('v2 index', e); });
  };
  // 1日1回の全体の写し（その日の最初に開いた端末が残す。すでにあれば何もしない）
  Coll.prototype._maybeSnapshot = function () {
    var self = this, st = this.store; if (!st.snapshot || !this.synced) return;
    var alive = Object.keys(this.recs).filter(function (k) { return !self.recs[k].del; }); if (!alive.length) return;
    var day = dayStr(); if (this._snapDay === day) return; this._snapDay = day;
    var body = {}; alive.forEach(function (k) { body[k] = self.recs[k].d; });
    var text = S(body), parts = []; for (var i = 0; i < text.length; i += 200000) parts.push(text.slice(i, i + 200000));
    var sid = st.id('s', this.name, day);
    st.be.txn([sid], function (docs) {
      if (docs[sid]) return {};
      var w = {}; w[sid] = { day: day, n: alive.length, parts: parts.length, by: st.device, ct: Date.now() };
      parts.forEach(function (p, i) { w[sid + '~p' + i] = { d: p }; });
      return { writes: w };
    }).catch(function (e) { self._snapDay = null; if (!(e && e.offline)) console.warn('v2 snapshot', e); });
  };

  // たまった変更を送る（入れ物ごとに1回のまとめ書き。途中で切れたら全部が無かったことになり、あとで送り直す）
  Store.prototype.flush = function () {
    var self = this;
    if (this.busy) return Promise.resolve();
    var first = this.outbox.filter(function (o) { return !o.base || !o.base.chain; })[0];
    if (!first) { this._emit(); return Promise.resolve(); }
    var cname = first.coll, c = this.colls[cname], seen = {};
    var ops = this.outbox.filter(function (o) { if (o.coll !== cname || (o.base && o.base.chain) || seen[o.rec]) return false; seen[o.rec] = 1; return true; }).slice(0, 40);
    if (!c) { return Promise.resolve(); }
    ops.forEach(function (o) { o.inflight = true; });
    this.busy = true; this._emit();
    var idxId = this.id('i', cname), logId = this.id('l', cname, dayStr()), results = [];
    var readIds = [idxId, logId].concat(ops.map(function (o) { return self.id('r', cname, o.rec); }));
    return this.be.txn(readIds, function (docs) {
      results = [];
      var idx = docs[idxId] || { recs: {}, dels: {}, seq: 0 }, log = docs[logId] || { e: [] }, w = {}, touched = false;
      idx.recs = idx.recs || {}; idx.dels = idx.dels || {}; log.e = log.e || [];
      ops.forEach(function (op) {
        var rId = self.id('r', cname, op.rec), remote = docs[rId], r = resolve(op, remote);
        if (r.write !== undefined) {
          var rev = (remote ? remote.rev : 0) + 1, del = r.write === null, d = del ? (remote ? remote.d : '') : r.write;
          w[rId] = { rev: rev, d: d, del: del, ct: op.t, by: self.device };
          w[self.id('h', cname, op.rec, rev)] = { rev: rev, prev: remote ? { rev: remote.rev, d: remote.d, del: !!remote.del, ct: remote.ct || 0, by: remote.by || '' } : null, by: self.device, ct: op.t, why: op.why || 'edit', lost: r.lost ? S(r.lost) : '' };
          idx.recs[op.rec] = rev; if (del) idx.dels[op.rec] = 1; else delete idx.dels[op.rec];
          log.e.push({ id: op.rec, rev: rev, op: del ? 'del' : (remote && !remote.del ? 'edit' : 'add'), by: self.device, t: op.t, s: op.label || '', why: op.why || 'edit', lost: r.lost ? 1 : 0 });
          results.push({ op: op, fin: { rev: rev, d: d, del: del, ct: op.t } }); touched = true;
        } else {
          if (r.lost) {   // 負けた側の入力だけを履歴に残す（記録そのものは変えない）
            w[self.id('h', cname, op.rec, (remote ? remote.rev : 0) + '-lost-' + op.id)] = { rev: remote ? remote.rev : 0, lostOnly: true, mine: op.next === null ? '' : op.next, mineDel: op.next === null, by: self.device, ct: op.t, lost: S(r.lost) };
            log.e.push({ id: op.rec, rev: remote ? remote.rev : 0, op: 'lost', by: self.device, t: op.t, s: op.label || '', why: op.why || 'edit', lost: 1, h: (remote ? remote.rev : 0) + '-lost-' + op.id });
            w[logId] = log;
          }
          results.push({ op: op, fin: remote ? { rev: remote.rev, d: remote.d, del: !!remote.del, ct: remote.ct || 0 } : null });
        }
      });
      if (touched) { idx.seq = (idx.seq || 0) + 1; w[idxId] = { recs: idx.recs, dels: idx.dels, seq: idx.seq }; if (log.e.length > 1500) log.e = log.e.slice(-1500); w[logId] = { e: log.e }; }
      return { writes: w };
    }).then(function () {
      results.forEach(function (r) {
        if (r.fin) c.recs[r.op.rec] = r.fin;
        var i = self.outbox.indexOf(r.op); if (i >= 0) self.outbox.splice(i, 1);
        self.outbox.forEach(function (o) { if (o.base && o.base.chain === r.op.id) o.base = r.fin ? { rev: r.fin.rev, d: r.fin.d, del: r.fin.del } : null; });
      });
      self.busy = false; self.error = ''; self.offline = false; self.lastOk = Date.now(); self.backoff = 0;
      c._changed(true); self._saveOutbox(); self._emit();
      return self.flush();
    }).catch(function (e) {
      ops.forEach(function (o) { o.inflight = false; });
      self.busy = false;
      if (e && e.offline) self.offline = true; else { self.error = '保存できません（' + ((e && (e.code || e.message)) || e) + '）'; console.error('v2 flush', e); }
      self._emit();
      clearTimeout(self.retryT); self.backoff = Math.min(30000, (self.backoff || 1000) * 2);
      if (!(self.be instanceof MemoryBackend)) self.retryT = setTimeout(function () { self.offline = false; self.flush(); }, self.backoff);
    });
  };
  // 送り終わるまで待つ（試験・写す道具用）
  Store.prototype.settle = function (ms) {
    var self = this, t0 = Date.now();
    return new Promise(function (res, rej) {
      (function loop() {
        if (!self.outbox.length && !self.busy) return res();
        if (Date.now() - t0 > (ms || 20000)) return rej(new Error('送信が終わりません（残り ' + self.outbox.length + ' 件）' + (self.error || '')));
        if (!self.busy) self.flush();
        setTimeout(loop, 40);
      })();
    });
  };

  // ---------- 履歴 ----------
  // 直近 days 日ぶんの「変更の一覧」（新しい順）
  Coll.prototype.changes = function (days) {
    var self = this, st = this.store, out = [], ps = [];
    for (var i = 0; i < (days || 7); i++) (function (i) { ps.push(st.be.get(st.id('l', self.name, dayStr(Date.now() - i * 86400000))).then(function (d) { if (d && d.e) d.e.forEach(function (x) { out.push(x); }); })); })(i);
    return Promise.all(ps).then(function () { return out.sort(function (a, b) { return (b.t || 0) - (a.t || 0); }); });
  };
  Coll.prototype.historyOf = function (rec, revOrKey) { return this.store.be.get(this.store.id('h', this.name, rec, revOrKey)); };
  // その変更の「前の状態」に戻す（戻すことも1つの変更として履歴に残る＝戻したのを取り消せる）
  Coll.prototype.restoreBefore = function (rec, rev) {
    var self = this;
    return this.historyOf(rec, rev).then(function (h) {
      if (!h) throw new Error('履歴が見つかりません');
      var m = {}; if (h.lostOnly) m[rec] = h.mineDel ? null : h.mine; else m[rec] = (h.prev && !h.prev.del) ? h.prev.d : null;
      return self.setRecs(m, { why: 'restore', force: true, now: true });
    });
  };
  Coll.prototype.snapshots = function (days) {
    var self = this, st = this.store, out = [], ps = [];
    for (var i = 0; i < (days || 30); i++) (function (i) { var day = dayStr(Date.now() - i * 86400000); ps.push(st.be.get(st.id('s', self.name, day)).then(function (d) { if (d) out.push({ day: day, n: d.n, parts: d.parts, by: d.by, ct: d.ct }); })); })(i);
    return Promise.all(ps).then(function () { return out.sort(function (a, b) { return a.day < b.day ? 1 : -1; }); });
  };
  Coll.prototype.readSnapshot = function (day) {
    var st = this.store, sid = st.id('s', this.name, day);
    return st.be.get(sid).then(function (m) {
      if (!m) throw new Error('その日の写しがありません');
      var ps = []; for (var i = 0; i < m.parts; i++) ps.push(st.be.get(sid + '~p' + i));
      return Promise.all(ps).then(function (a) { return JSON.parse(a.map(function (x) { return (x && x.d) || ''; }).join('')); });
    });
  };
  Coll.prototype.restoreSnapshot = function (day) { var self = this; return this.readSnapshot(day).then(function (body) { return self.setRecs(body, { deleteMissing: true, why: 'restore-day', force: true, now: true }); }); };
  // ネット上の中身を、端末の控えを通さずに全部読み直す（写した後の突き合わせ用）
  Coll.prototype.readServer = function () {
    var self = this, st = this.store;
    return st.be.get(st.id('i', this.name)).then(function (idx) {
      var keys = Object.keys((idx && idx.recs) || {}), out = {};
      return Promise.all(keys.map(function (k) { return st.be.get(st.id('r', self.name, k)).then(function (d) { if (d && !d.del) out[k] = d.d; }); })).then(function () { return out; });
    });
  };

  // ---------- 本番の Firestore につなぐ（いまのアプリと同じプロジェクト。値は app.html と同じ公開の設定） ----------
  var FIREBASE_CONFIG = { apiKey: 'AIzaSyDy49I2DYxIgiUZKtqG9GJZUIjuxlwENvg', authDomain: 'keiei-system.firebaseapp.com', projectId: 'keiei-system', storageBucket: 'keiei-system.firebasestorage.app', messagingSenderId: '89836927404', appId: '1:89836927404:web:074eb4a13c04b5b6ec2209' };
  function deviceId() {
    var d = null; try { d = localStorage.getItem('v2_device'); } catch (e) {}
    if (!d) { d = 'dev_' + rid(); try { localStorage.setItem('v2_device', d); } catch (e) {} }
    return d;
  }
  function connect(pass, opt) {
    opt = opt || {};
    if (!g.firebase) return Promise.reject(new Error('Firebase を読み込めませんでした（ネットを確かめてください）'));
    var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    return firebase.auth().signInAnonymously().then(function () { return spaceOf(pass); }).then(function (space) {
      var be = new FirestoreBackend(firebase.firestore(), 'keiei_stores');
      return new Store({ backend: be, space: space, device: opt.device || deviceId(), kv: opt.kv || new IdbKV('v2_' + space.slice(0, 12)), snapshot: opt.snapshot });
    });
  }

  g.V2 = { Store: Store, MemoryCloud: MemoryCloud, MemKV: MemKV, IdbKV: IdbKV, FirestoreBackend: FirestoreBackend, connect: connect, spaceOf: spaceOf,
    sha256hex: sha256hex, merge3: merge3, resolve: resolve, defineSpec: defineSpec, splitList: splitList, joinList: joinList, SPECS: SPECS, dayStr: dayStr, rid: rid, deviceId: deviceId };
})(window);
