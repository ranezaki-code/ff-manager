/* 新しいシステム（v2）：ワークスケジュールのデータの「分け方・組み立て方」　2026-10-05
   1日ぶんのタスク／人ごとのゲームの記録／作業ごとの点検の記録／そのほかの項目1つ ＝ それぞれ記録1件。
   ・1日ぶんのタスクの中は、タスクの id で突き合わせて1件ずつ・欄ごとに合成される（core.js の merge3）。
     → 2台が同じ日の別のタスクを同時にさわっても、片方がタスクを足しても、両方残る。
   ・人ごとの記録の名前には、氏名そのものを使わない（氏名から作った短い印を使い、氏名は中身に持つ）。履歴の一覧にも氏名を出さない。
   ・最終保存の時刻（_modifiedAt）は端末ごとの値なので、保存先には置かない（保存のたびに全端末で書き換えが起きるのを避ける）。
   ・計算には一切さわらない（計算は ws/index.html の写しがそのまま行う）。 */
(function (g) {
  'use strict';
  var V2 = g.V2, S = JSON.stringify;
  function clone(x) { return x === undefined ? undefined : JSON.parse(S(x)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function tag(s) { var h = 5381, h2 = 52711; s = String(s); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h = ((h * 33) ^ c) >>> 0; h2 = ((h2 * 31) + c) >>> 0; } return h.toString(36) + h2.toString(36); }
  function ordered(keys, order) { var seen = {}, out = []; (order || []).forEach(function (k) { if (keys.indexOf(k) >= 0 && !seen[k]) { seen[k] = 1; out.push(k); } }); keys.filter(function (k) { return !seen[k]; }).sort().forEach(function (k) { out.push(k); }); return out; }
  var MAPS = [['tasks', 'd:', function (k) { return k; }], ['gameProfiles', 'g:', tag], ['areaChecks', 'a:', function (k) { return k; }]];

  V2.defineSpec('ws', {
    normalize: function (st) { st = clone(st || {}); if (isObj(st)) delete st._modifiedAt; return st; },
    split: function (st0, prev, coll) {
      var st = clone(st0 || {}), out = {}, order = { top: [] };
      if (coll && coll.local && st._modifiedAt !== undefined) coll.local.modifiedAt = st._modifiedAt;
      delete st._modifiedAt; order.top = Object.keys(st);
      var done = {};
      MAPS.forEach(function (m) {
        var name = m[0], o = st[name]; if (!isObj(o)) return; done[name] = 1; order[name] = Object.keys(o);
        Object.keys(o).forEach(function (k) { out[m[1] + m[2](k)] = S({ k: k, v: o[k] }); });
      });
      Object.keys(st).forEach(function (k) { if (!done[k]) out['s:' + k] = S(st[k]); });
      out['s:__order'] = S(order);
      return out;
    },
    join: function (recs, coll) {
      var order = {}; try { order = recs['s:__order'] ? JSON.parse(recs['s:__order']) : {}; } catch (e) { order = {}; }
      var maps = {}, top = {};
      MAPS.forEach(function (m) { maps[m[0]] = {}; });
      Object.keys(recs).forEach(function (r) {
        var v; try { v = JSON.parse(recs[r]); } catch (e) { return; }
        for (var i = 0; i < MAPS.length; i++) { if (r.indexOf(MAPS[i][1]) === 0) { maps[MAPS[i][0]][v.k] = v.v; return; } }
        if (r.indexOf('s:') === 0 && r !== 's:__order') top[r.slice(2)] = v;
      });
      var topKeys = (order.top || []).slice(), st = {};
      var val = function (k) {
        if (k in top) return top[k];
        if (k in maps) { var keys = Object.keys(maps[k]); if (!keys.length && topKeys.indexOf(k) < 0) return undefined; var o = {}; ordered(keys, order[k]).forEach(function (x) { o[x] = maps[k][x]; }); return o; }
        return undefined;
      };
      topKeys.concat(Object.keys(top), MAPS.map(function (m) { return m[0]; })).forEach(function (k) { if (k in st) return; var v = val(k); if (v !== undefined) st[k] = v; });
      if (coll && coll.local && coll.local.modifiedAt !== undefined) st._modifiedAt = coll.local.modifiedAt;
      return st;
    },
    label: function (key) {
      if (key.indexOf('d:') === 0) return key.slice(2) + ' のタスク';
      if (key.indexOf('g:') === 0) return '人ごとのゲームの記録';
      if (key.indexOf('a:') === 0) return '点検の記録';
      var N = { 's:staff': '従業員の一覧', 's:recurringTasks': '繰り返しタスク', 's:categories': 'カテゴリ', 's:presets': 'プリセット', 's:requestTasks': '依頼タスク', 's:breakLogs': '休憩の記録', 's:activeBreak': '休憩中の印', 's:gameSettings': 'ポイントの設定', 's:storeState': 'チームの記録', 's:thanksLog': '感謝の記録', 's:amWorks': '売場マップの作業', 's:amMap': '売場マップ', 's:amRoles': '巡回の役割', 's:__order': '並びの控え' };
      return N[key] || ('設定 ' + key.slice(2));
    }
  });
})(window);
