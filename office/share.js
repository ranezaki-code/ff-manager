/* オフィスを ほかの端末で見るための部品　2026-10-06
   ・このパソコン（localhost）のダッシュボード＝「送る側」。右上の 📡 を入にすると、オフィスの様子だけをネット上の専用の置き場所へ送る。
   ・公開ページ（ff-manager/office/）＝「見る側」。同じ合言葉で、送られた様子を受け取ってオフィスを動かす。見るだけ。
   送る物：名簿（名前・色・絵）と、各メンバーの 状態（作業中／待機）・作業の短い件名・始めた時刻・完了した件数。
   送らない物：店長とチロルの会話の記録、やることの一覧、提出物、入れる場所、読んでいるファイルの名前。
   置き場所：FF・ワークスケジュールとは別の文書（合言葉から作る別の名前）。FF などのデータは読まない・書かない。
   合言葉はファイルに書かない（ブラウザの中にだけ持つ）。 */
(function () {
  'use strict';
  var CFG = { apiKey: 'AIzaSyDy49I2DYxIgiUZKtqG9GJZUIjuxlwENvg', authDomain: 'keiei-system.firebaseapp.com', projectId: 'keiei-system', storageBucket: 'keiei-system.firebasestorage.app', messagingSenderId: '89836927404', appId: '1:89836927404:web:074eb4a13c04b5b6ec2209' };
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]viewer=1/.test(location.search);   // ?viewer=1 は、このパソコンで「見る側」を試す時用
  var MIN_GAP = 20000, BEAT = 5 * 60000;      // 送るのは変化があった時だけ・最短でも20秒あける。変化が無くても5分に1回は「動いています」を送る
  window.__VIEWER = !LOCAL;
  var $ = function (id) { return document.getElementById(id); };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return v; }
  function addScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('部品を読み込めません')); }; document.head.appendChild(s); }); }
  function sha256hex(str) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
  var docRef = null;
  function connect(pass) {
    return addScript(SDK + 'firebase-app-compat.js').then(function () { return addScript(SDK + 'firebase-auth-compat.js'); }).then(function () { return addScript(SDK + 'firebase-firestore-compat.js'); })
      .then(function () { if (!firebase.apps.length) firebase.initializeApp(CFG); return firebase.auth().signInAnonymously(); })
      .then(function () { return sha256hex('keiei-office-v1::' + pass); })
      .then(function (id) { docRef = firebase.firestore().collection('keiei_stores').doc(id); return docRef; });
  }
  function askPass(title, cb) {
    var w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(30,34,40,.45);display:flex;align-items:center;justify-content:center;padding:16px';
    w.innerHTML = '<div style="background:#fff;border:2px solid #3d4248;border-radius:10px;padding:18px;max-width:340px;width:100%;font-size:14px;line-height:1.7"><div style="font-weight:700;margin-bottom:6px">' + title + '</div><div style="font-size:12px;color:#6b7280;margin-bottom:8px">FF管理などと同じ合言葉を入れてください。この端末のブラウザの中にだけ覚えます。</div><input type="password" id="sh-pass" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:16px;padding:8px;border:2px solid #3d4248;border-radius:6px"><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="sh-no" style="font:inherit;padding:6px 14px;border:2px solid #3d4248;border-radius:6px;background:#fff;cursor:pointer">やめる</button><button id="sh-ok" style="font:inherit;padding:6px 14px;border:2px solid #3d4248;border-radius:6px;background:#3d4248;color:#fff;cursor:pointer">決定</button></div></div>';
    document.body.appendChild(w);
    var done = function (v) { w.remove(); cb(v); };
    w.querySelector('#sh-no').onclick = function () { done(null); };
    w.querySelector('#sh-ok').onclick = function () { var v = w.querySelector('#sh-pass').value.trim(); if (v) done(v); };
    w.querySelector('#sh-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') w.querySelector('#sh-ok').click(); });
    w.querySelector('#sh-pass').focus();
  }
  function cutS(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }

  // ---------------- 送る側（このパソコン） ----------------
  function payload() {
    var T = window.TEAM, S = window.STATE;
    if (!T || !S) return null;
    var pick = function (m) { return m ? { id: m.id, nick: m.nick, name: m.name, color: m.color, sprite: m.sprite } : null; };
    var team = { stores: T.stores || [], owner: pick(T.owner), boss: pick(T.boss), members: (T.members || []).map(pick) };
    var one = function (a, withTask) { a = a || {}; var o = { status: a.status === 'working' ? 'working' : 'idle', since: a.since || 0, done: Number(a.done || 0) }; if (withTask) o.task = cutS(a.task, 40); if (a.status === 'working' && a.lastTool) o.lastTool = a.lastTool; return o; };
    var agents = {}; Object.keys(S.agents || {}).forEach(function (id) { var isMem = team.members.some(function (m) { return m.id === id; }); if (isMem || (S.agents[id] || {}).status === 'working') agents[id] = one(S.agents[id], isMem); });
    return { team: team, state: { boss: one(S.boss, false), agents: agents, log: [] } };
  }
  var send = { on: false, last: '', lastAt: 0, timer: null, err: '' };
  function sendTick() {
    if (!send.on || !docRef) return;
    var p = payload(); if (!p) return;
    var sig = JSON.stringify(p), now = Date.now();
    if ((sig === send.last && now - send.lastAt < BEAT) || now - send.lastAt < MIN_GAP) return;
    p = JSON.parse(sig);      // 中身の無い項目（undefined）を落とす（そのままだと保存先に断られる）
    send.last = sig; send.lastAt = now; p.state.updatedAt = now;
    docRef.set({ v: 1, t: now, team: p.team, state: p.state }).then(function () { send.err = ''; paintBtn(); }).catch(function (e) { send.err = (e && e.message) || String(e); paintBtn(); });
  }
  function paintBtn() {
    var b = $('share-btn'); if (!b) return;
    b.textContent = '📡 ほかの端末で見る：' + (send.on ? (send.err ? '送れません' : '入') : '切');
    b.title = send.on ? (send.err ? send.err : '最後に送った時刻 ' + (send.lastAt ? new Date(send.lastAt).toLocaleTimeString('ja-JP') : 'まだ') + '　押すと止めます') : '押すと、オフィスの様子だけを ほかの端末へ送ります';
    b.style.background = send.on && !send.err ? '#3d4248' : '#fff'; b.style.color = send.on && !send.err ? '#fff' : '#3d4248';
  }
  function startSend(pass) {
    connect(pass).then(function () { send.on = true; ls('office_share', '1'); send.last = ''; send.lastAt = 0; clearInterval(send.timer); send.timer = setInterval(sendTick, 5000); sendTick(); paintBtn(); })
      .catch(function (e) { send.on = false; send.err = (e && e.message) || String(e); paintBtn(); alert('つながりませんでした：' + send.err); });
  }
  function initSender() {
    var live = $('live'); if (!live || !live.parentNode) return;
    var b = document.createElement('button'); b.id = 'share-btn';
    b.style.cssText = 'font:inherit;font-size:12px;padding:3px 10px;border:2px solid #3d4248;border-radius:14px;cursor:pointer;margin-left:10px;white-space:nowrap';
    live.parentNode.appendChild(b); paintBtn();
    b.onclick = function () {
      if (send.on) { send.on = false; clearInterval(send.timer); ls('office_share', null); paintBtn(); return; }
      var p = ls('office_pass');
      if (p) startSend(p); else askPass('ほかの端末でオフィスを見る', function (v) { if (!v) return; ls('office_pass', v); startSend(v); });
    };
    if (ls('office_share') === '1' && ls('office_pass')) startSend(ls('office_pass'));     // 前に入にしていたら、開いた時に自動で続ける
  }

  // ---------------- 見る側（公開ページ） ----------------
  function note(msg) {
    var n = $('sh-note');
    if (!n) { n = document.createElement('div'); n.id = 'sh-note'; n.style.cssText = 'margin:8px 0;padding:8px 12px;border:2px dashed #8d9299;border-radius:8px;font-size:13px;color:#3d4248;background:#fff'; var t = $('tab-office'); if (t) t.insertBefore(n, t.firstChild); }
    n.innerHTML = msg; n.style.display = msg ? '' : 'none';
  }
  function initViewer() {
    var st = document.createElement('style');
    st.textContent = '#tabs,#week,#rdetail,#fold-flow,#fold-log{display:none!important}';
    document.head.appendChild(st);
    try { if (typeof window.showTab === 'function') window.showTab('office'); } catch (e) {}
    var go = function (pass) {
      note('つないでいます…');
      connect(pass).then(function (ref) {
        ref.onSnapshot(function (snap) {
          if (!snap.exists) { note('まだ何も送られていません。パソコンのダッシュボードで「📡 ほかの端末で見る」を入にしてください。<br>（合言葉がちがう時も、この表示になります。<a href="#" id="sh-re">合言葉を入れ直す</a>）'); var a = $('sh-re'); if (a) a.onclick = function (e) { e.preventDefault(); ls('office_pass', null); location.reload(); }; return; }
          var d = snap.data() || {};
          window.__AI_TEAM = d.team || null; window.__AI_STATE = d.state || {};
          window.TEAM = window.__AI_TEAM; window.STATE = window.__AI_STATE;
          var old = Date.now() - (d.t || 0) > BEAT * 2 + 60000;
          note(old ? '⚠ パソコンからの更新が止まっています（最後は ' + new Date(d.t || 0).toLocaleString('ja-JP') + '）。パソコンのダッシュボードが閉じているか、📡 が切になっています。' : '');
          try { window.poll(); } catch (e) { console.warn(e); }
        }, function (e) { note('受け取れません：' + ((e && e.message) || e)); });
        // 更新が止まったことに気づけるよう、1分ごとに見直す
        setInterval(function () { var s = window.STATE; if (s && s.updatedAt && Date.now() - s.updatedAt > BEAT * 2 + 60000) note('⚠ パソコンからの更新が止まっています（最後は ' + new Date(s.updatedAt).toLocaleString('ja-JP') + '）。'); }, 60000);
      }).catch(function (e) { note('つながりませんでした：' + ((e && e.message) || e)); });
    };
    var p = ls('office_pass') || ls('v2_pass') || ls('unified_pass');     // この端末で アプリに入っている合言葉があれば、そのまま使う
    if (p) go(p); else askPass('オフィスを見る', function (v) { if (!v) { note('合言葉が要ります。読み込み直すと、もう一度入れられます。'); return; } ls('office_pass', v); go(v); });
  }

  var start = function () { if (LOCAL) initSender(); else initViewer(); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
