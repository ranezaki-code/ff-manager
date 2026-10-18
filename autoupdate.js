/* 新しい版が公開されたら、自動で読み込み直す（全ページ共通・2026-10-05）。
   しくみ：自分のページの更新日時（Last-Modified）をサーバーに問い合わせ、開いた時より新しければ、
   入力中でない時に1回だけ読み込み直す。古い版を開いたままの端末が残らないようにするため。
   - 5分おき／画面に戻った時／回線が戻った時に確かめる
   - 2回続けて「新しい」と出た時だけ読み込み直す（配信の切り替わり途中での行ったり来たりを防ぐ）
   - 同じページの自動の読み込み直しは10分に1回まで（万一の繰り返しを防ぐ）
   - 打鍵・入力から15秒以内（入力欄にカーソルがある時は60秒以内）は待つ。入力途中の値は各ページの入力途中ガードが戻す
   - 2026-10-18：中の画面（iframe）の打鍵・入力欄も 入口は 見る。中の画面が window.__autoupdateHold（関数）を持ち、それが true を返す間（ワークスケジュールの登録の窓が開いている間 など）は 待つ
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
  var firstHit = 0, lastInput = 0, checking = false, waiting = false;

  /* 2026-10-18（店長「全部おすすめで」）：中の画面（iframe）の入力も 入口が 見る。窓を開いている間は 待つ（中の画面が window.__autoupdateHold を 持つ時）。
     今まで 入口の自動の読み込み直しは、中の画面の打鍵も 入力欄の カーソルも 見えず（iframe の中の出来事は 外の document に 届かない）、入力の途中でも 読み込み直していた。
     待たせる関数を持たない中の画面（FF管理 など）は 今までと同じ（何も しない）。 */
  function note(){ lastInput = Date.now(); try { if (window.parent && window.parent !== window && typeof window.parent.__auNote === 'function') window.parent.__auNote(); } catch (e) {} }
  window.__auNote = note;
  ['keydown', 'input', 'compositionstart', 'compositionupdate'].forEach(function(ev){ document.addEventListener(ev, note, true); });

  function innerActive(){
    var a = document.activeElement, n = 0;
    try { while (a && a.tagName === 'IFRAME' && a.contentDocument && n++ < 4) a = a.contentDocument.activeElement; } catch (e) {}
    return a;
  }
  function held(){
    try {
      if (typeof window.__autoupdateHold === 'function' && window.__autoupdateHold()) return true;
      var fr = document.getElementsByTagName('iframe');
      for (var i = 0; i < fr.length; i++) { var w = fr[i].contentWindow; if (w && typeof w.__autoupdateHold === 'function' && w.__autoupdateHold()) return true; }
    } catch (e) {}
    return false;
  }
  function editing(){
    var a = innerActive(), idle = Date.now() - lastInput;
    var inField = !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
    return held() || idle < 15000 || (inField && idle < 60000);
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
        // 1回目に気づいてから CONFIRM_MS 以上あけた2回目でも「新しい」時だけ読み込み直す
        // （画面に戻った時の確認などが続けて走っても、間をあけずに2回と数えない）
        if (!firstHit) { firstHit = Date.now(); setTimeout(check, CONFIRM_MS + 200); }
        else if (Date.now() - firstHit >= CONFIRM_MS) tryReload();
      } else firstHit = 0;
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
