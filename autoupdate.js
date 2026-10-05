/* 新しい版が公開されたら、自動で読み込み直す（全ページ共通・2026-10-05）。
   しくみ：自分のページの更新日時（Last-Modified）をサーバーに問い合わせ、開いた時より新しければ、
   入力中でない時に1回だけ読み込み直す。古い版を開いたままの端末が残らないようにするため。
   - 5分おき／画面に戻った時／回線が戻った時に確かめる
   - 2回続けて「新しい」と出た時だけ読み込み直す（配信の切り替わり途中での行ったり来たりを防ぐ）
   - 同じページの自動の読み込み直しは10分に1回まで（万一の繰り返しを防ぐ）
   - 打鍵・入力から15秒以内（入力欄にカーソルがある時は60秒以内）は待つ。入力途中の値は各ページの入力途中ガードが戻す
   - 更新日時を返さないサーバー（手元の確認用サーバーなど）や file:// では何もしない */
(function(){
  'use strict';
  if (!/^https?:$/.test(location.protocol)) return;
  var TEST = /(^|[#&])autoupdate-test($|&)/.test(location.hash);   // 動作確認用：開いた版を1時間前の物として扱う
  var loadedAt = Date.parse(document.lastModified) || 0;
  if (!loadedAt) return;
  if (TEST) loadedAt -= 3600000;
  var KEY = '__autoupdate::' + location.pathname;
  var CHECK_MS = TEST ? 4000 : 5 * 60 * 1000, CONFIRM_MS = TEST ? 3000 : 60 * 1000, LIMIT_MS = 10 * 60 * 1000;
  var hits = 0, lastInput = 0, checking = false, waiting = false;

  function note(){ lastInput = Date.now(); }
  ['keydown', 'input', 'compositionstart', 'compositionupdate'].forEach(function(ev){ document.addEventListener(ev, note, true); });

  function editing(){
    var a = document.activeElement, idle = Date.now() - lastInput;
    var inField = !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
    return idle < 15000 || (inField && idle < 60000);
  }
  function ss(k, v){
    try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); }
    catch (e) { return null; }
    return v;
  }
  function recentlyReloaded(){ return Date.now() - (+ss(KEY) || 0) < LIMIT_MS; }

  function tryReload(){
    if (recentlyReloaded()) return;
    if (editing()) { if (!waiting) { waiting = true; setTimeout(function(){ waiting = false; tryReload(); }, 5000); } return; }
    if (ss(KEY, String(Date.now())) === null) return;   // 記録できない時は読み込み直さない（繰り返しを防げないため）
    ss(KEY + '::done', '1');
    location.reload();
  }

  function check(){
    if (checking || recentlyReloaded()) return;
    checking = true;
    var url = location.pathname + (location.pathname.indexOf('?') < 0 ? '?' : '&') + '_au=' + Date.now();
    fetch(url, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }).then(function(r){
      checking = false;
      if (!r.ok) return;
      var lm = Date.parse(r.headers.get('Last-Modified') || '');
      if (!lm) return;
      if (lm - loadedAt > 5000) {
        hits++;
        if (hits >= 2) tryReload(); else setTimeout(check, CONFIRM_MS);
      } else hits = 0;
    }).catch(function(){ checking = false; });
  }

  setTimeout(check, TEST ? 1500 : 30000);
  setInterval(check, CHECK_MS);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) check(); });
  window.addEventListener('online', check);

  // 読み込み直した直後に、小さく知らせる
  if (ss(KEY + '::done') === '1') {
    ss(KEY + '::done', null);
    var show = function(){
      var d = document.createElement('div');
      d.textContent = '新しい版に更新しました';
      d.setAttribute('role', 'status');
      d.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;background:#1f2937;color:#fff;font-size:13px;padding:8px 16px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:none';
      (document.body || document.documentElement).appendChild(d);
      setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 4000);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
})();
