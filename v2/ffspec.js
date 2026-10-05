/* 新しいシステム（v2）：FF管理のデータの「分け方・組み立て方」　2026-10-05
   商品1つ／週1つ／その週の天気・イベント調整／時間帯別購入率1日ぶん／そのほかの項目1つ ＝ それぞれ記録1件。
   ・いまの保存は「開いている週」の中身を2か所（S.ji など と S.weeks[週]）に持つ。新しい持ち方では「週1つ」の記録に一本化し、
     読み込む時に、その端末が開いている週（coll.local.activeWeek。端末ごと）の中身を S.ji などへ組み立てる。
     → 画面のコードは今までどおり S.ji・S.cust などを読める。
   ・週の名前は、記録の名前では 2026-10-06 の形（日付順に並ぶ）。中には元の名前（2026.10.6）も持つ。行き来はこのファイルの weekIso だけ。
   ・計算には一切さわらない（計算は ff/index.html の写しがそのまま行う）。 */
(function (g) {
  'use strict';
  var V2 = g.V2, S = JSON.stringify;
  function clone(x) { return x === undefined ? undefined : JSON.parse(S(x)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var MIR = ['ji', 'cust', 'checks', 'skipped', 'orderChecks', 'soldOuts', 'leftovers', 'weekStart'];
  function weekIso(k) { var m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(String(k)); return m ? m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]) : 'x' + String(k); }
  function weekNum(k) { var p = String(k).split('.'); return (+p[0] || 0) * 10000 + (+p[1] || 0) * 100 + (+p[2] || 0); }
  function ordered(keys, order, cmp) {
    var seen = {}, out = [];
    (order || []).forEach(function (k) { if (keys.indexOf(k) >= 0 && !seen[k]) { seen[k] = 1; out.push(k); } });
    keys.filter(function (k) { return !seen[k]; }).sort(cmp || undefined).forEach(function (k) { out.push(k); });
    return out;
  }
  var cmpW = function (a, b) { return weekNum(a) - weekNum(b); };

  V2.defineSpec('ff', {
    weekIso: weekIso, MIR: MIR,
    // 「開いている週」の2か所持ちを1本にした形（いまの保存処理 syncActiveWeek と同じ重ね方）
    normalize: function (st) {
      st = clone(st || {}); var act = st.activeWeek;
      if (act && isObj(st.weeks)) { var w = isObj(st.weeks[act]) ? st.weeks[act] : {}; MIR.forEach(function (m) { if (st[m] !== undefined) w[m] = st[m]; }); st.weeks[act] = w;
        // 古い形のデータ：外側に無くて週の中にだけある項目（売れ残りの記録など）は、週の中身を外側にも持つ形にそろえる（組み立て直しと同じ形・中身は消さない）
        MIR.forEach(function (m) { if (st[m] === undefined && w[m] !== undefined) st[m] = clone(w[m]); }); }
      return st;
    },
    split: function (st0, prev, coll) {
      var st = this.normalize(st0), out = {}, order = { top: Object.keys(st), weeks: [], gaibu: [], hourRate: {} };
      var pmList = Array.isArray(st.PM), wObj = isObj(st.weeks), gObj = isObj(st.gaibu), hObj = isObj(st.hourRate);
      if (pmList) V2.splitList(st.PM, 'p:', function (p, i) { return (p && p.id != null) ? p.id : 'noid' + i; }, prev, out);
      if (wObj) Object.keys(st.weeks).forEach(function (k) { order.weeks.push(k); out['w:' + weekIso(k)] = S({ k: k, v: st.weeks[k] }); });
      if (gObj) Object.keys(st.gaibu).forEach(function (k) { order.gaibu.push(k); out['g:' + weekIso(k)] = S({ k: k, v: st.gaibu[k] }); });
      if (hObj) Object.keys(st.hourRate).forEach(function (c) {
        var m = st.hourRate[c]; order.hourRate[c] = isObj(m) ? Object.keys(m) : null;
        if (!isObj(m)) { out['h:' + c + ':*'] = S({ c: c, raw: m }); return; }
        Object.keys(m).forEach(function (d) { out['h:' + c + ':' + d] = S({ c: c, d: d, v: m[d] }); });
      });
      Object.keys(st).forEach(function (k) {
        if ((k === 'PM' && pmList) || (k === 'weeks' && wObj) || (k === 'gaibu' && gObj) || (k === 'hourRate' && hObj)) return;
        if (k === 'activeWeek') return;
        if (MIR.indexOf(k) >= 0 && st.activeWeek && wObj) return;      // 開いている週の中身は「週1つ」の記録にある
        out['s:' + k] = S(st[k]);
      });
      out['s:__order'] = S(order);       // 並びの控え（組み立て直した時に、元と同じ並びにするため）
      // 開いている週は端末ごと。記録には「最初の目安」だけを残し、あとの切り替えでは書き換えない
      out['s:__active'] = (prev && prev['s:__active'] !== undefined) ? prev['s:__active'] : S(st.activeWeek === undefined ? null : st.activeWeek);
      if (prev && prev['s:__setup'] !== undefined) out['s:__setup'] = prev['s:__setup'];     // 初期設定の済み印は、保存では消さない
      if (coll && coll.local && st.activeWeek) coll.local.activeWeek = st.activeWeek;
      return out;
    },
    join: function (recs, coll) {
      var order = {}; try { order = recs['s:__order'] ? JSON.parse(recs['s:__order']) : {}; } catch (e) { order = {}; }
      var weeks = {}, gaibu = {}, hr = {}, hrRaw = {}, top = {};
      Object.keys(recs).forEach(function (r) {
        var v; try { v = JSON.parse(recs[r]); } catch (e) { return; }
        if (r.indexOf('w:') === 0) weeks[v.k] = v.v;
        else if (r.indexOf('g:') === 0) gaibu[v.k] = v.v;
        else if (r.indexOf('h:') === 0) { if ('raw' in v) hrRaw[v.c] = v.raw; else (hr[v.c] = hr[v.c] || {})[v.d] = v.v; }
        else if (r.indexOf('s:') === 0 && r !== 's:__order' && r !== 's:__active' && r !== 's:__setup') top[r.slice(2)] = v;
      });
      var topKeys = (order.top || []).slice(), inTop = function (k) { return topKeys.indexOf(k) >= 0; };
      var W = {}; ordered(Object.keys(weeks), order.weeks, cmpW).forEach(function (k) { W[k] = weeks[k]; });
      var G = {}; ordered(Object.keys(gaibu), order.gaibu, cmpW).forEach(function (k) { G[k] = gaibu[k]; });
      var oh = order.hourRate || {}, H = {};
      ordered(Object.keys(hr).concat(Object.keys(hrRaw)).concat(Object.keys(oh).filter(function (c) { return isObj(oh[c]) || Array.isArray(oh[c]); })).filter(function (c, i, a) { return a.indexOf(c) === i; }), Object.keys(oh)).forEach(function (c) {
        if (c in hrRaw) { H[c] = hrRaw[c]; return; }
        var o = {}; ordered(Object.keys(hr[c] || {}), oh[c]).forEach(function (d) { o[d] = hr[c][d]; });
        if (Object.keys(o).length || (c in oh)) H[c] = o;
      });
      var hint = null; try { hint = recs['s:__active'] !== undefined ? JSON.parse(recs['s:__active']) : null; } catch (e) {}
      var wk = Object.keys(W), act = (coll && coll.local && coll.local.activeWeek) || '';
      if (!(act && (act in W))) act = (hint && (hint in W)) ? hint : (wk.length ? wk.slice().sort(cmpW)[wk.length - 1] : (hint === null ? undefined : hint));
      var PM = V2.joinList(recs, 'p:');
      var val = function (k) {
        if (k === 'PM') return ('PM' in top) ? top.PM : ((inTop('PM') || PM.length) ? PM : undefined);
        if (k === 'weeks') return ('weeks' in top) ? top.weeks : ((inTop('weeks') || wk.length) ? W : undefined);
        if (k === 'gaibu') return ('gaibu' in top) ? top.gaibu : ((inTop('gaibu') || Object.keys(G).length) ? G : undefined);
        if (k === 'hourRate') return ('hourRate' in top) ? top.hourRate : ((inTop('hourRate') || Object.keys(H).length) ? H : undefined);
        if (k === 'activeWeek') return act;
        if (MIR.indexOf(k) >= 0 && !(k in top)) { var w = act !== undefined ? W[act] : null; return (w && w[k] !== undefined) ? clone(w[k]) : undefined; }
        return top[k];
      };
      var st = {}, all = topKeys.concat(Object.keys(top), ['PM', 'weeks', 'activeWeek'], MIR);
      all.forEach(function (k) { if (k in st) return; var v = val(k); if (v !== undefined) st[k] = v; });
      return st;
    },
    label: function (key, d) {
      try {
        var v = JSON.parse(d);
        if (key.indexOf('p:') === 0) return '商品 ' + ((v.v && v.v.name) || '(名前なし)');
        if (key.indexOf('w:') === 0) return '週 ' + key.slice(2) + ' の実績・客数・記録';
        if (key.indexOf('g:') === 0) return '週 ' + key.slice(2) + ' の天気・イベント調整';
        if (key.indexOf('h:') === 0) return '時間帯別購入率 ' + key.slice(2);
      } catch (e) {}
      var N = { 's:budget': '予算・投資の設定', 's:catCfg': 'カテゴリの作成時間帯', 's:catOn': 'カテゴリのオン・オフ', 's:rules': 'ルール補正', 's:ext': '外部要因（旧）', 's:discountSchedule': '値引きの曜日', 's:storeName': '店舗名', 's:__order': '並びの控え', 's:__active': '開く週の目安', 's:__setup': '初期設定の済み印', 's:deleted': '消した印' };
      return N[key] || ('設定 ' + key.slice(2));
    }
  });
})(window);
