/* オフィスの絵「斜め見下ろし（2.5D）」　2026-10-10（ギア）
   ダッシュボード（index.html）の「🏢 オフィス」のタブに、斜め上から見下ろした立体のオフィスを Canvas で描く部品。
   ・元は見本 office_iso.html（店長が 10/10 に「このオフィスの見た目すごくいい」と言った絵）。床・家具・人・名札・吹き出しの描き方は見本のまま写した。
   ・この部品は、ファイルを読まない・どこにも書かない・ブラウザの覚えも使わない。名簿と状態は index.html が渡す（IsoOffice.update）。
     だから state.js を読むのは今までどおり index.html だけ（読む人を増やさない）。見る側（?viewer=1・公開ページ）でも同じ入口で動く。
   ・同じ事実を2か所に書かないよう、ドット絵（SPRITES）・ことば（toolWords・SPOTS の acts・HABITS・CHAT）・席の決め方（seatOf）・
     役割の説明の中身は index.html の物を使う（mount の時に受け取る）。この部品が持つのは「斜めにした時の位置と描き方」だけ。
   ・外へ出す入口は window.IsoOffice だけ（mount／update／select／stop／demoState／info）。中の名前は外に出ない（index.html の同じ名前とぶつからない）。
   ・絵の大きさは、入れ物の幅と「高さの上限」（index.html の OFFICE_H）から決める（下の layout）。
   ・描き直し：歩いている人・飛んでいる紙がある間だけ細かく（1秒に約30回）。だれも動いていない時は 0.5秒に1回（ひとこと・トレーニング中は 0.25秒）で、
     前と同じ絵なら描かない。ブラウザを裏にした時・ほかのタブを開いている時は止める。
*/
(function(){
'use strict';

// ================= index.html から受け取る物（mount の時） =================
var H = null;                    // index.html 側の入口（いちばん下の mount の説明を見る）
var TEAM = null, STATE = {};     // 名簿と状態（update のたびに受け取る。この部品は読みこまない）
var SPRITES = {}, HABITS = {}, CHAT = [], SPOTS = [], XP_PER_TASK = 20, HMAX = 700;
function memberOf(id){ return TEAM ? H.memberOf(id) : null; }
function seatOf(id){ return TEAM ? H.seatOf(id) : null; }
function toolWords(tool, hint){ return H.toolWords(tool, hint); }
function cut(s, n){ return H.cut(s, n); }
function esc(v){ return H.esc(v); }

// 同じ絵・同じ色の決まりを、Canvas に1マスずつ塗る（ps＝1マスの画面上の大きさ。eyesOpen＝false でまばたき）
function paintBot(g, color, sprite, crown, ps, eyesOpen){
  var c = color || '#9ca3af', rows = SPRITES[sprite] || SPRITES.ghost, H = rows.length, W = 12, x, y, ch;
  var pal = { w:'#ffffff', k:'#1a1a1a', K:'#1a1a1a', y:'#f5b301', p:'#f58ca8', s:'#f2c9a0' };
  function at(x, y){ return (y < 0 || y >= H || x < 0 || x >= W) ? '.' : (rows[y].charAt(x) || '.'); }
  function px(x, y, f){ g.fillStyle = f; g.fillRect((x+1)*ps, (y+3)*ps, ps, ps); }
  for (y = -1; y <= H; y++) for (x = -1; x <= W; x++){
    ch = at(x, y);
    if (ch === '.'){
      if (at(x-1, y) !== '.' || at(x+1, y) !== '.' || at(x, y-1) !== '.' || at(x, y+1) !== '.') px(x, y, '#3b2f2a');
      continue;
    }
    if (ch === 'K') px(x, y, c);
    if (ch !== 'K' || eyesOpen) px(x, y, pal[ch] || c);
    if (ch === 'b') px(x, y, 'rgba(0,0,0,.3)');
    else if (ch === 'a' || ch === 'w' || ch === 's'){
      if (at(x, y-1) === '.') px(x, y, 'rgba(255,255,255,.22)');
      else if (at(x+1, y) === '.' || at(x, y+1) === '.') px(x, y, 'rgba(0,0,0,.14)');
    }
  }
  if (crown){
    g.fillStyle = '#f5b301';
    [[4,0,1,2],[5.5,0,1,2],[7,0,1,2],[4,1,4,1.5]].forEach(function(r){ g.fillRect(Math.round((r[0]+1)*ps), Math.round(r[1]*ps), Math.round(r[2]*ps), Math.round(r[3]*ps)); });
  }
}

// 位置はすべて％（平面のオフィスと同じ。横 0〜100・縦 0〜100、足元が基準）。描く時だけ斜めに置きかえる
var OFFICE = { sig: '', chars: {}, prev: {}, lastPrompt: 0, fx: [], desk: {}, trn: false };
var Y_BACK = 28, Y_FRONT = 70, AISLES = [24, 62];
// 休み場所の位置（12か所。並びは index.html の SPOTS と同じ。ことば＝acts・emo などは index.html の物を使う）。
// 斜めにすると「奥の人の名札」が「手前の人の顔」にちょうど重なる5か所だけ、平面のオフィスから少しずらしてある
// （冷蔵ケース前の2つ目 x41→46.5／コーヒーマシン前 y25→22／ランニングマシン y69→65／ダンベル前 x14→20／マット x16,y73→x15,y68）
var SPOT_POS = [[29, 26], [46.5, 26], [57, 26], [70, 26], [6, 22], [4, 43], [16, 43], [5, 65], [20, 62], [15, 68], [69, 66], [93, 68]];
// 自主点検（週1回のふり返り）で集まる場所。平面のオフィスの「横4.6％きざみ・4人×2列」は、斜めにすると となりとの間が
// 画面上で約33pxになり、7人が1かたまりに重なる。床の上で 横7.5％ × 縦15.5 の格子（2列目は1％ずらす）にすると、
// 画面上ではどの2人も絵1つ分（56px）ほど はなれる。奥の列＝ランニングマシンの上・ダンベル棚の前・マットの奥の3人、
// 手前の列＝トレーニングと作業スペースの間に4人（8人目から先は手前の列を右へのばす）
// だれがどこに立つか：手前の列のすぐ手前は机の席なので、「その席の本人」が立つ（名簿の1〜3番目＝手前の列の2〜4番目）。
// こうすると、机で作業中の人と自主点検の人が同時にいても、机の人の真後ろに ほかの人が隠れない。残りの人は 手前の左はし と 奥の列
var TRAIN_ORDER = [4, 5, 6, 3, 0, 1, 2];
function trainSpot(k){
  if (k < TRAIN_ORDER.length) k = TRAIN_ORDER[k];
  return k < 3 ? { x: 4.75 + k * 7.5, y: 62.5 } : { x: 5.75 + (k - 3) * 7.5, y: 78 };
}

// ================= 斜め見下ろしの描き方 =================
// 部屋は平面のオフィスと同じ方眼（横200×縦100。床は縦14〜100、縦0〜14は奥の壁）。10 が床の1マス。
// 画面へは 横=(x−y)・縦=(x+y)/2−高さ で置く（ひし形のマス）。面は「上・左手前・右手前」の3つに明暗を付ける。
// 字：見本と同じ見た目になるよう MS ゴシックを先に書く。MS ゴシックの無い端末（スマホなど）では、ダッシュボードと同じ DotGothic16 になる
var FONT = '"MS Gothic","DotGothic16","Yu Gothic UI",monospace';
var INK = '#3d4248';
var V = { W: 0, H: 0, dpr: 1, tw: 0, th: 0, zs: 0, ox: 0, oy: 0, ps: 2, lw: 1, F: 13, fs: 13, small: false, fine: true, gen: 0, rw: 0, rdpr: 0, cssW: 0, cssH: 0 };
var WH = 22, WT = 2.4;   // 壁の高さ・厚み
var boxEl = null, worldEl = null, floorCv = null, stageCv = null, floorG = null, stageG = null, statusEl = null, cardEl = null;
var PERF = { n: 0, sum: 0, max: 0, last: 0, objs: 0, faces: 0 }, FACES = 0;

function P(x, y, z){ var u = x / 10, v = (y - 14) / 10; return [V.ox + (u - v) * V.tw / 2, V.oy + (u + v) * V.th / 2 - (z || 0) * V.zs]; }
function R(v){ return Math.round(v); }
var MIX = {};
function mix(hex, to, t){   // to：0＝黒へ、255＝白へ
  var k = hex + to + t, v = MIX[k];
  if (v) return v;
  var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  v = 'rgb(' + R(r + (to - r) * t) + ',' + R(g + (to - g) * t) + ',' + R(b + (to - b) * t) + ')';
  return MIX[k] = v;
}
function quad(g, pts, fill, line){
  FACES++;
  g.beginPath(); g.moveTo(R(pts[0][0]), R(pts[0][1]));
  for (var i = 1; i < pts.length; i++) g.lineTo(R(pts[i][0]), R(pts[i][1]));
  g.closePath();
  if (fill){ g.fillStyle = fill; g.fill(); }
  if (line){ g.strokeStyle = line === true ? INK : line; g.stroke(); }
}
function faceTop(g, x0, y0, x1, y1, z, fill, line){ quad(g, [P(x0,y0,z), P(x1,y0,z), P(x1,y1,z), P(x0,y1,z)], fill, line); }
function faceY(g, y, x0, x1, z0, z1, fill, line){ quad(g, [P(x0,y,z1), P(x1,y,z1), P(x1,y,z0), P(x0,y,z0)], fill, line); }   // 左手前を向いた面
function faceX(g, x, y0, y1, z0, z1, fill, line){ quad(g, [P(x,y0,z1), P(x,y1,z1), P(x,y1,z0), P(x,y0,z0)], fill, line); }   // 右手前を向いた面
function box(g, x0, y0, x1, y1, z0, z1, c, line){   // c＝色1つ（明暗は自動）か [上, 左手前, 右手前]
  var t, l, r;
  if (typeof c === 'string'){ t = mix(c, 255, 0.16); l = c; r = mix(c, 0, 0.14); } else { t = c[0]; l = c[1]; r = c[2]; }
  faceY(g, y1, x0, x1, z0, z1, l, line); faceX(g, x1, y0, y1, z0, z1, r, line); faceTop(g, x0, y0, x1, y1, z1, t, line);
}
function shadow(g, x0, y0, x1, y1){   // 床に落ちる影（手前側に少しはみ出す）
  quad(g, [P(x0+1.4,y1,0), P(x1,y1,0), P(x1,y0+1.4,0), P(x1+1.6,y0+1.4,0), P(x1+1.6,y1+1.6,0), P(x0+1.4,y1+1.6,0)], 'rgba(30,34,40,.13)');
}
function seg(g, a, b, col, w){ g.beginPath(); g.moveTo(R(a[0]), R(a[1])); g.lineTo(R(b[0]), R(b[1])); g.strokeStyle = col; g.lineWidth = w || V.lw; g.stroke(); g.lineWidth = V.lw; }
function isoEllipse(g, x, y, z, r, fill, line){   // 床と平行な丸
  var c = P(x, y, z), rx = r * V.tw / 20 * Math.SQRT2;
  FACES++;
  g.beginPath(); g.ellipse(R(c[0]), R(c[1]), rx, rx / 2, 0, 0, 6.2832);
  if (fill){ g.fillStyle = fill; g.fill(); }
  if (line){ g.strokeStyle = line === true ? INK : line; g.stroke(); }
}
function disc(g, cx, cy, r, fill, line){ FACES++; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fillStyle = fill; g.fill(); if (line){ g.strokeStyle = INK; g.stroke(); } }
function rr(g, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---- 絵の大きさを決める（入れ物の幅と、高さの上限 HMAX から） ----
// 部屋ぜんたい（壁・床の厚みこみ）は、マスの幅を 1 として 横 14.6 × 縦 8.84。
// ・広い時：マスは「幅」と「HMAX」の小さい方で決まる。枠の高さは 幅×0.66（上限 HMAX）。
//   入れ物の幅が 1060px・HMAX が 700 なら 高さ 700・マス 70px・人の絵 56×64px で、見本を 1060×700 で開いた時と同じ絵になる。
// ・せまい時（マスが 44px 未満＝入れ物の幅が およそ 666px 未満。スマホなど）：横幅いっぱいにちぢめる（はみ出さない）。
//   13px の吹き出しを絵の中に出すと こみ合うので、作業中の文は絵の中に出さない（ぬりつぶした名札と光るモニターで分かる。
//   仕事の名前は、すぐ下のメンバー一覧に出ている）。「作業中 ◯人」の行は、絵の下に置く。
//   役割の説明は絵の中に出さない（一覧の下の説明だけ。今までの平面のオフィスと同じ）。
function even(v){ return Math.max(16, Math.floor(v / 2) * 2); }   // マスの幅は偶数（ひし形の線がきれいに出る）
function layout(){
  var W = boxEl.clientWidth, raw = window.devicePixelRatio || 1;
  V.rw = W; V.rdpr = raw;                      // 作り直すかどうかは、入れ物の幅とブラウザの拡大率で決める（refit）
  if (!W) return false;                        // 見えていない間（ほかのタブを開いている時）は決めない
  W = Math.max(240, W);
  var padX = 12, padT = 14, padB = 14, cssH;
  var tw = even(Math.min((W - 2 * padX) / 14.6, (HMAX - padT - padB) / 8.84)), small = tw < 44;
  if (small){
    padX = 4; padT = 10; padB = 8;
    tw = even(Math.min((W - 2 * padX) / 14.6, (HMAX - padT - padB) / 8.84));
    cssH = padT + Math.ceil(8.84 * tw) + padB;
  } else cssH = Math.max(padT + Math.ceil(8.84 * tw) + padB, Math.min(HMAX, Math.round(W * 0.66)));
  var dpr = Math.min(small ? 3 : 2, Math.max(1, raw));   // 小さな絵は、画素3倍のスマホでもくっきり描く
  var freeW = Math.max(0, W - 2 * padX - 14.6 * tw), freeH = Math.max(0, cssH - padT - padB - 8.84 * tw);
  V.dpr = dpr; V.W = Math.round(W * dpr); V.H = Math.round(cssH * dpr); V.small = small; V.fine = tw >= 40;
  V.cssW = W; V.cssH = cssH;
  V.tw = tw * dpr; V.th = V.tw / 2; V.zs = V.tw * 0.055;
  V.ox = Math.round((padX + freeW / 2 + 4.45 * tw) * dpr);
  V.oy = Math.round((padT + freeH * 0.5 + 1.34 * tw) * dpr);
  V.ps = Math.max(1, Math.round(Math.max(tw / 18, 1.9) * dpr));   // ドット絵の1マス（整数にして、つぶれを防ぐ）
  V.lw = Math.max(1, Math.round(tw / 44 * dpr));
  V.fs = tw < 30 ? 11 : 13;                    // 字の大きさ（px）。とても小さな絵（スマホの縦）では 11px
  V.F = Math.round(V.fs * dpr);
  V.gen++;
  boxEl.className = 'iso-box' + (small ? ' small' : '');
  worldEl.style.width = W + 'px'; worldEl.style.height = cssH + 'px';
  floorCv.style.width = stageCv.style.width = W + 'px'; floorCv.style.height = stageCv.style.height = cssH + 'px';
  floorCv.width = stageCv.width = V.W; floorCv.height = stageCv.height = V.H;
  drawStatic(floorG);
  WRAP = {}; lastKey = '';
  return true;
}
// 入れ物の幅・ブラウザの拡大率が変わったら、その場で作り直す（絵が引きのばされない・ぼやけないように）。作り直したら true
function refit(){
  var W = boxEl.clientWidth;
  if (!W || (W === V.rw && (window.devicePixelRatio || 1) === V.rdpr)) return false;
  if (!layout()) return false;
  buildScene();
  return true;
}
// 絵の左下の1行：いま作業中の人（せまい時は絵の下に置く）
var WORKING = [], SIDE_H = null, DEMO_ON = false;
function renderSide(){
  if (!statusEl) return;
  var n = WORKING.length, h = '';
  if (TEAM) h = '<i></i>' + (n ? '作業中 ' + n + '人：' + esc(WORKING.join('・')) : 'いまは みんな待ち') + (DEMO_ON ? '<b>デモ（仮の状態）</b>' : '');
  if (h === SIDE_H) return;
  SIDE_H = h; statusEl.className = 'iso-status' + (n ? ' on' : ''); statusEl.innerHTML = h;
}

// ---- 動かない物（床・壁・壁ぎわの棚）。1回だけ描いて下の Canvas に置く ----
function drawStatic(g){
  var i, j, k, x0, z, hh, fine = V.fine;
  var cols = ['#b9bdc3','#8d9299','#dcdee1','#6f757d','#eeeeec','#a7abb1','#c9ccd1','#7d848c'];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, V.W, V.H);
  g.save(); if (V.lw % 2) g.translate(0.5, 0.5);
  g.lineWidth = V.lw; g.lineJoin = 'round';
  // 部屋の下の影と、床の厚み
  g.save(); g.translate(0, R(V.tw * 0.1)); quad(g, [P(-WT,14-WT,-4), P(200,14-WT,-4), P(200,100,-4), P(-WT,100,-4)], 'rgba(60,45,25,.14)'); g.restore();
  faceY(g, 100, -WT, 200, -4, 0, '#b9bdc3', true); faceX(g, 200, 14-WT, 100, -4, 0, '#a2a7ad', true);
  // 売場の床（グレーの市松。1マス＝ひし形1つ）
  faceTop(g, 0, 14, 200, 100, 0, '#f4f4f2');
  for (i = 0; i < 20; i++) for (j = 0; j < 7; j++) if ((i + j) % 2) faceTop(g, i*10, 14 + j*10, i*10 + 10, 24 + j*10, 0, '#eaeae8');
  // 休憩室
  faceTop(g, 0, 14, 40, 48, 0, '#ebe9e5');
  for (j = 1; j < 8; j++) seg(g, P(0, 14.4 + j*4.2), P(40, 14.4 + j*4.2), '#dddad4');
  // トレーニング（ゴムの床）
  faceTop(g, 0, 49.5, 42, 78, 0, '#d6d8dc');
  for (i = 0; i < 6; i++) for (j = 0; j < 4; j++) if ((i + j) % 2) faceTop(g, i*7, 49.5 + j*7.1, i*7 + 7, 56.6 + j*7.1, 0, '#cfd1d6');
  // 事務所
  faceTop(g, 160, 14, 200, 48, 0, '#e1e2e5');
  for (j = 0; j < 8; j++) for (i = 0; i < 8; i++) if ((i + j) % 2) faceTop(g, 160 + i*5, 14.4 + j*4.2, 165 + i*5, 18.6 + j*4.2, 0, '#dbdcdf');
  // 作業スペース（カーペット）
  faceTop(g, 0, 78, 200, 100, 0, '#e3e4e7');
  for (i = 1; i < 20; i++) seg(g, P(i*10, 78.4), P(i*10, 100), '#d6d8dc');
  seg(g, P(0, 78), P(200, 78), '#b9bdc3');
  // 入口のマット・ストレッチのマット（床に平らな物）
  faceTop(g, 186, 53, 197, 73, 0, '#5a6068', true);
  for (k = 0; k < 4; k++) seg(g, P(187.9 + k*2.4, 54.5), P(187.9 + k*2.4, 71.5), '#7d848c');
  faceTop(g, 26, 65.5, 39, 73.5, 0, '#a7abb1', true);
  seg(g, P(27.2, 66.8), P(37.8, 66.8), '#8d9299'); seg(g, P(27.2, 72.2), P(37.8, 72.2), '#8d9299');
  quad(g, [P(0,14,0), P(200,14,0), P(200,100,0), P(0,100,0)], null, true);

  // 壁（奥＝右上へ伸びる面、左＝左下へ伸びる面）
  faceX(g, 0, 14, 100, 0, WH, '#e9eaec'); faceX(g, 0, 14, 100, WH - 2.6, WH, '#33383d'); faceX(g, 0, 14, 100, 0, 1.6, '#c4c7cc');
  faceX(g, 0, 14, 100, 0, WH, null, true);
  faceY(g, 14, 0, 200, 0, WH, '#fbfbfa'); faceY(g, 14, 0, 200, WH - 2.6, WH, '#3a3f45'); faceY(g, 14, 0, 200, WH - 3.2, WH - 2.6, '#c9ccd1'); faceY(g, 14, 0, 200, 0, 1.6, '#d4d6da');
  faceY(g, 14, 0, 200, 0, WH, null, true);
  faceY(g, 100, -WT, 0, -4, WH, '#d4d6da', true); faceX(g, 200, 14 - WT, 14, -4, WH, '#b4b8be', true);
  quad(g, [P(-WT,14-WT,WH), P(200,14-WT,WH), P(200,14,WH), P(0,14,WH), P(0,100,WH), P(-WT,100,WH)], '#c9ccd1', true);
  // 壁の飾り：左の壁の窓（休憩室）と鏡（トレーニング）、奥の壁のホワイトボードと窓（事務所）
  faceX(g, 0, 22, 40, 8.5, 18.5, '#fbfbfa', true); faceX(g, 0, 23, 30.5, 9.4, 17.6, '#d5dde3'); faceX(g, 0, 31.5, 39, 9.4, 17.6, '#d5dde3');
  faceX(g, 0, 24.5, 27, 14.5, 15.5, '#ffffff'); faceX(g, 0, 33, 36, 12, 13, '#ffffff');
  faceX(g, 0, 54, 74, 3, 13.6, '#dfe5e9', true);
  quad(g, [P(0,57,13.6), P(0,60,13.6), P(0,65,3), P(0,62,3)], 'rgba(255,255,255,.55)');
  faceY(g, 14, 161, 173.5, 8.5, 18, '#fbfbfa', true);
  seg(g, P(162.4,14,16), P(168,14,16), '#6f757d'); seg(g, P(169.4,14,16), P(172,14,16), '#a7abb1'); seg(g, P(162.4,14,13.6), P(171,14,13.6), '#8d9299'); seg(g, P(162.4,14,11.2), P(169,14,11.2), '#c4c7cc');
  faceY(g, 14, 161, 173.5, 7.6, 8.5, '#b9bdc3', true);
  faceY(g, 14, 175, 185.6, 8.5, 18.5, '#fbfbfa', true); faceY(g, 14, 175.8, 180, 9.4, 17.6, '#d5dde3'); faceY(g, 14, 180.6, 184.8, 9.4, 17.6, '#d5dde3');
  faceY(g, 14, 176.5, 178.6, 14.6, 15.5, '#ffffff'); faceY(g, 14, 181.8, 184, 12, 12.9, '#ffffff');
  // 部屋の名前（壁の札。広い画面だけ。小さな画面では絵がこみ合うので出さない）
  if (!V.small){
    g.font = V.F + 'px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle';
    var u = V.tw / 20, sign = function(left, at, z, t){   // left＝左の壁（手前から奥へ読む）、それ以外は奥の壁
      var wU = g.measureText(t).width / u + 1.6, p;
      if (left){ faceX(g, 0, at, at - wU, z - 2.4, z + 2.4, '#fbfbfa', true); p = P(0, at - 0.8, z); g.save(); g.setTransform(1, -0.5, 0, 1, R(p[0]), R(p[1])); }
      else { faceY(g, 14, at, at + wU, z - 2.4, z + 2.4, '#fbfbfa', true); p = P(at + 0.8, 14, z); g.save(); g.setTransform(1, 0.5, 0, 1, R(p[0]), R(p[1])); }
      g.fillStyle = '#6f757d'; g.fillText(t, 0, V.dpr); g.restore();
    };
    sign(false, 16.4, 15, '休憩室'); sign(false, 186.6, 15.6, '事務所');
    // 左の壁：「トレーニング」と、その手前に「作業スペース」。2枚が入らない小さな画面では「トレーニング」だけ
    var wS = g.measureText('作業スペース').width / u + 1.6, wT = g.measureText('トレーニング').width / u + 1.6;
    if (98.6 - wS - 2 - wT >= 46){ sign(true, 98.6, 16.4, '作業スペース'); sign(true, 96.6 - wS, 16.4, 'トレーニング'); }
    else sign(true, 76.6, 16.4, 'トレーニング');
  }

  // 休憩室のカウンターとコーヒーマシン
  shadow(g, 3, 14, 37, 20);
  box(g, 3, 14, 37, 20, 0, 8, ['#a7abb1','#8d9299','#7d848c'], true);
  box(g, 6, 14.6, 15, 19.4, 8, 17.4, ['#4b5057','#3a3f45','#2f3338'], true);
  faceY(g, 19.4, 7.5, 13.5, 14.2, 16.2, '#6f757d'); faceY(g, 19.4, 8.7, 12.3, 9, 12.4, '#22262a'); faceY(g, 19.4, 9.5, 11.5, 9, 10.4, '#fbfbfa');
  for (k = 0; k < 3; k++){ box(g, 19 + k*3.4, 15.4, 21.4 + k*3.4, 18, 8, 11.4, ['#6f757d','#fbfbfa','#dcdee1'], fine); }
  box(g, 31.4, 15, 35.6, 19, 8, 12.6, ['#e6e7e9','#d4d6da','#c0c4c9'], true);
  // 冷蔵ケース
  shadow(g, 46, 14, 100, 20);
  box(g, 46, 14, 100, 20, 0, 17, ['#f1f2f3','#e9ecee','#cfd4d8'], true);
  faceY(g, 20, 46, 100, 15, 17, '#3a3f45'); faceY(g, 20, 46, 100, 0, 1.4, '#a7abb1');
  for (i = 0; i < 4; i++){
    x0 = 47 + i*13.25;
    faceY(g, 20, x0, x0 + 12.25, 1.8, 14.2, '#dfe5e9', fine);
    for (j = 0; j < 3; j++){
      z = 10.6 - j*4.1;
      for (k = 0; k < 5; k++){
        faceY(g, 20, x0 + 0.9 + k*2.2, x0 + 2.4 + k*2.2, z, z + 2.4, cols[(i*3 + j*2 + k) % cols.length]);
        if (fine) faceY(g, 20, x0 + 1.3 + k*2.2, x0 + 2 + k*2.2, z + 2.4, z + 3, '#fbfbfa');
      }
      seg(g, P(x0, 20, z), P(x0 + 12.25, 20, z), '#a7abb1');
    }
    quad(g, [P(x0+1,20,1.8), P(x0+4,20,14.2), P(x0+6,20,14.2), P(x0+3,20,1.8)], 'rgba(255,255,255,.3)');
    if (fine) faceY(g, 20, x0 + 11, x0 + 11.5, 5.5, 9.5, '#5a6068');
  }
  faceY(g, 20, 46, 100, 0, 17, null, true);
  // 商品棚
  shadow(g, 104, 14, 154, 20);
  box(g, 104, 14, 154, 20, 0, 16.4, ['#e6e7e9','#d4d6da','#c0c4c9'], true);
  faceY(g, 20, 104, 154, 14.8, 16.4, '#6f757d');
  for (j = 0; j < 3; j++){
    z = 10.6 - j*4.6;
    for (i = 0; i < 15; i++){ hh = 2.2 + ((i*7 + j*3) % 3) * 0.5; faceY(g, 20, 105.2 + i*3.2, 107.6 + i*3.2, z, z + hh, cols[(i*2 + j*3) % cols.length]); }
    faceY(g, 20, 104.4, 153.6, z - 0.8, z, '#fbfbfa', fine);
  }
  faceY(g, 20, 104, 154, 0, 16.4, null, true);
  // 書類棚（事務所）
  shadow(g, 190, 15, 198, 26.5);
  box(g, 190, 15, 198, 26.5, 0, 11, ['#dcdee1','#c4c7cc','#b0b4ba'], true);
  for (j = 0; j < 3; j++){
    if (j) seg(g, P(190, 26.5, j*3.67), P(198, 26.5, j*3.67), INK);
    faceY(g, 26.5, 193, 195, 1.6 + j*3.67, 2.2 + j*3.67, '#6f757d');
  }
  g.restore();
}

// ---- 動く物と重なる家具（毎回、奥から手前の順に並べて描く） ----
var SCENE = [];
function glow(color, now, ms){ return Math.floor(now / ms) % 2 ? mix(color, 255, 0.32) : color; }   // 光の切りかえは 0.5秒・1秒きざみ（render の tq の区切りに合わせる）
function buildScene(){
  var L = SCENE = [], thin = V.fine ? true : null;
  var cols = ['#b9bdc3','#8d9299','#dcdee1','#6f757d','#eeeeec','#a7abb1','#c9ccd1','#7d848c'];
  function add(x0, y0, x1, y1, draw){ L.push({ x0: x0, y0: y0, x1: x1, y1: y1, draw: draw }); }
  // 低い仕切り（休憩室・トレーニング・事務所）。背を低くして、奥の人が隠れないように。事務所の手前は、店長席の机が見えるように まん中を空けた
  [[40,14,42,21],[40,35,42,49.5],[0,47.5,40,49.5],[42,49.5,44,58.5],[158,14,160,21],[158,35,160,49.5],[160,47.5,168.5,49.5],[189.5,47.5,200,49.5]].forEach(function(r){
    add(r[0], r[1], r[2], r[3], function(g){ box(g, r[0], r[1], r[2], r[3], 0, 3.6, ['#dcdee1','#c4c7cc','#b0b4ba'], true); });
  });
  // 休憩室：丸テーブルと、いす2つ（休みの人が座る場所）
  add(14.4, 30.9, 25.6, 42.1, function(g){
    isoEllipse(g, 20.8, 37.3, 0, 6, 'rgba(30,34,40,.13)');
    box(g, 19, 35.5, 21, 37.5, 0, 5.2, '#8d9299');
    isoEllipse(g, 20, 36.5, 5.2, 5.6, '#b9bdc3', true); isoEllipse(g, 20, 36.5, 6, 5.6, '#dcdee1', true); isoEllipse(g, 19, 35.5, 6, 2.6, '#eeeeec');
    box(g, 19.4, 36, 21, 37.4, 6, 7.6, ['#fbfbfa','#eeeeec','#dcdee1'], thin);
  });
  [[8,43],[32,43]].forEach(function(s){ stool(s[0], s[1]); });
  function stool(x, y){ add(x - 2.4, y - 2.4, x + 2.4, y + 2.4, function(g){ box(g, x - 2.2, y - 2.2, x + 2.2, y + 2.2, 0, 3.2, ['#8d9299','#6f757d','#5a6068'], true); }); }
  // レジ（社長席）：ホットケース・レジ・コーヒーマシン。チロルの作業中はレジの画面が光る
  add(61, 47.5, 115, 53.5, function(g, now){
    shadow(g, 61, 47.5, 115, 53.5);
    box(g, 61, 47.5, 115, 53.5, 0, 6.5, ['#f1f2f3','#e1e3e6','#cfd2d6'], true);
    faceY(g, 53.5, 61, 115, 0, 2.2, '#3a3f45', true); faceX(g, 115, 47.5, 53.5, 0, 2.2, '#2f3338', true);
    box(g, 64, 48.3, 77, 52.7, 6.5, 13.5, ['rgba(250,250,250,.92)','rgba(240,242,244,.88)','rgba(222,226,230,.9)'], true);
    faceY(g, 52.7, 65, 76, 11, 11.9, '#8d9299'); faceY(g, 52.7, 65, 76, 9, 9.9, '#b9bdc3'); faceY(g, 52.7, 65, 76, 7.1, 8, '#6f757d');
    box(g, 100, 48.6, 105, 52.4, 6.5, 10.6, ['#4b5057','#3a3f45','#2f3338'], true);
    faceY(g, 52.4, 100.8, 104.2, 8, 9.9, OFFICE.desk.boss ? glow('#9af0c0', now, 500) : '#6f7a83');
    box(g, 108.5, 48.4, 113, 52.4, 6.5, 12.4, ['#5a6068','#4b5057','#3a3f45'], true);
    faceY(g, 52.4, 109.5, 112, 9.8, 11.2, '#c9ccd1');
  });
  // 島の棚（ゴンドラ）とエンド。縦の通り道（x=124）にかからないよう、平面のオフィスより少し右に置いた
  add(132, 51.5, 162, 61.5, function(g){
    var i;
    shadow(g, 132, 51.5, 162, 61.5);
    box(g, 132, 51.5, 159, 61.5, 0, 9, ['#e6e7e9','#d4d6da','#c0c4c9'], true);
    for (i = 0; i < 9; i++){
      faceY(g, 61.5, 133.2 + i*2.85, 135.4 + i*2.85, 5.4, 7.8, cols[(i + 2) % cols.length]);
      faceY(g, 61.5, 133.2 + i*2.85, 135.4 + i*2.85, 1.3, 3.7, cols[(i*3 + 1) % cols.length]);
    }
    faceY(g, 61.5, 132.4, 158.6, 4.6, 5.2, '#fbfbfa'); faceY(g, 61.5, 132.4, 158.6, 0.5, 1.1, '#fbfbfa');
    box(g, 159, 51.5, 162, 61.5, 0, 9, ['#4b5057','#3a3f45','#33383d'], true);
    faceX(g, 162, 53, 55.4, 5, 7.4, '#fbfbfa'); faceX(g, 162, 57, 59.4, 5, 7.4, '#a7abb1');
  });
  // 植木
  [[56, 62], [164.5, 41]].forEach(function(p){
    var cx = p[0], cy = p[1];
    add(cx - 2.4, cy - 2.4, cx + 2.4, cy + 2.4, function(g){
      var u = V.tw / 20, c = P(cx, cy, 8.4);
      isoEllipse(g, cx + 0.8, cy + 0.8, 0, 3.4, 'rgba(30,34,40,.13)');
      box(g, cx - 2, cy - 2, cx + 2, cy + 2, 0, 4.6, ['#a7abb1','#8d9299','#7d848c'], true);
      disc(g, R(c[0]), R(c[1]), 4.4 * u, '#7f9686', true); disc(g, R(c[0] - 2.2 * u), R(c[1] + 1.9 * u), 2.6 * u, '#6c8373'); disc(g, R(c[0] + 1.4 * u), R(c[1] - 1.6 * u), 1.6 * u, '#9db3a4');
    });
  });
  // トレーニング：ダンベル棚・ランニングマシン
  add(18, 51, 39, 57.6, function(g){
    var k;
    shadow(g, 18, 51, 39, 57.6);
    box(g, 18, 51, 39, 57.6, 0, 6.6, ['#c9ccd1','#b9bdc3','#a7abb1'], true);
    seg(g, P(18, 57.6, 3.3), P(39, 57.6, 3.3), INK);
    for (k = 0; k < 4; k++){
      faceY(g, 57.6, 19.4 + k*5, 20.4 + k*5, 4.1, 5.9, '#3a3f45'); faceY(g, 57.6, 20.4 + k*5, 22 + k*5, 4.6, 5.4, '#8d9299'); faceY(g, 57.6, 22 + k*5, 23 + k*5, 4.1, 5.9, '#3a3f45');
      faceY(g, 57.6, 19.4 + k*5, 20.6 + k*5, 0.6, 2.7, '#4b5057'); faceY(g, 57.6, 20.6 + k*5, 21.9 + k*5, 1.3, 2, '#8d9299'); faceY(g, 57.6, 21.9 + k*5, 23.1 + k*5, 0.6, 2.7, '#4b5057');
    }
  });
  add(3, 58.8, 18, 73, function(g){
    shadow(g, 3, 61, 18, 73);
    box(g, 3, 59.4, 4.4, 61, 0, 10.6, '#8d9299', thin); box(g, 16.6, 59.4, 18, 61, 0, 10.6, '#8d9299', thin);
    box(g, 3, 58.8, 18, 61.2, 10.4, 12.8, ['#5a6068','#4b5057','#3a3f45'], true);
    faceY(g, 61.2, 8.5, 12.5, 11, 12.2, '#c9ccd1');
    box(g, 3, 61, 18, 73, 0, 2, ['#3a3f45','#33383d','#2a2e33'], true);
    faceTop(g, 4.3, 62.2, 16.7, 71.8, 2, '#5a6068'); seg(g, P(4.3, 67, 2), P(16.7, 67, 2), '#3a3f45');
  });
  // 作業スペース：コピー機・ごみ箱
  add(1.5, 83, 11.5, 95, function(g){
    shadow(g, 1.5, 83, 11.5, 95);
    box(g, 1.5, 83, 11.5, 95, 0, 12, ['#e6e7e9','#d4d6da','#c0c4c9'], true);
    faceTop(g, 2.5, 84, 10.5, 90.6, 12, '#3a3f45'); faceTop(g, 8.4, 91.8, 10.2, 94, 12, '#c9ccd1');
    seg(g, P(11.5, 83, 7.6), P(11.5, 95, 7.6), INK); seg(g, P(11.5, 83, 3.4), P(11.5, 95, 3.4), INK);
    faceX(g, 11.5, 85, 93, 5.1, 5.9, '#fbfbfa', thin);
  });
  add(187, 89, 196.6, 95, function(g){
    shadow(g, 187, 89, 196.6, 95);
    box(g, 187, 89, 191.4, 95, 0, 6, ['#6f757d','#a7abb1','#8d9299'], true);
    box(g, 192.2, 89, 196.6, 95, 0, 6, ['#4b5057','#6f757d','#5a6068'], true);
  });
  // 入口（右手前のへりの自動ドア。ガラスなので向こうが透ける）
  add(199, 51, 201, 75, function(g){
    faceX(g, 200, 52, 74, 0, 14, 'rgba(213,221,227,.32)', thin);
    seg(g, P(200, 63, 0), P(200, 63, 14), INK);
    box(g, 199.2, 51, 200.2, 52, 0, 15, '#8d9299', thin); box(g, 199.2, 74, 200.2, 75, 0, 15, '#8d9299', thin);
    box(g, 199.2, 51, 200.2, 75, 14, 15.2, '#8d9299', thin);
  });
  // 席：店長席と、メンバーの席（人は机の向こう側に座る。モニターは作業中に本人の色で点滅）
  function desk(id, color, depth){
    var s = seatOf(id); if (!s) return;
    var X = s.x * 2, Y = s.y, x0 = X - 7, x1 = X + 9, y0 = Y + 3.5, y1 = y0 + depth, h = 6;
    stool(X, Y);
    add(x0, y0, x1, y1, function(g, now){
      var on = OFFICE.desk[id], mc = id === 'owner' ? glow('#aeb6bf', now, 1000) : (on ? glow(color, now, 500) : '#3a3f45');
      shadow(g, x0, y0, x1, y1);
      box(g, x0, y0, x1, y1, 0, h, ['#eceded','#c9ccd1','#b4b8be'], true);
      faceY(g, y1, x0 + 2.5, x1 - 2.5, 1.8, 3.8, color);
      faceTop(g, X + 1, y0 + 1.2, X + 5, y0 + 4.2, h, '#fbfbfa', thin);
      box(g, X + 6.2, y1 - 2.2, X + 7.8, y1 - 0.8, h, h + 1.8, color, thin);
      box(g, x0 + 1.5, y0 + 2.2, x0 + 2.3, y0 + 3.2, h, h + 1.4, '#22262a');
      box(g, x0 + 1.2, y0 + 0.6, x0 + 2.5, y0 + 4.6, h + 1.2, h + 7, ['#4b5057','#3a3f45', mc], true);
    });
  }
  if (TEAM){
    desk('owner', TEAM.owner.color || '#9ca3af', 4.6);
    TEAM.members.forEach(function(m){ desk(m.id, m.color || '#9ca3af', 6); });
  }
}

// ---- 奥から手前への並べかえ（箱どうしを比べて、手前の物を後に描く） ----
function orderOf(a, b){   // 1＝a を先に描く、-1＝b を先に、0＝どちらでもよい
  var E = 0.01, ax = a.x1 <= b.x0 + E, bx = b.x1 <= a.x0 + E, ay = a.y1 <= b.y0 + E, by = b.y1 <= a.y0 + E;
  var aB = ax || ay, bB = bx || by;
  if (aB && !bB) return 1;
  if (bB && !aB) return -1;
  if (aB && bB) return 0;            // 斜めに離れている（画面では左右に分かれる）
  if (a.ch && !b.ch) return -1;      // 同じ場所にいる時は、人を後に描く（いすの上に座る）
  if (b.ch && !a.ch) return 1;
  return a.d <= b.d ? 1 : -1;
}
function sortItems(a){
  var n = a.length, i, j, r, k, best, indeg = [], out = [], done = [], res = [];
  for (i = 0; i < n; i++){ indeg[i] = 0; out[i] = []; done[i] = 0; a[i].d = a[i].x0 + a[i].x1 + a[i].y0 + a[i].y1; }
  for (i = 0; i < n; i++) for (j = i + 1; j < n; j++){
    r = orderOf(a[i], a[j]);
    if (r > 0){ out[i].push(j); indeg[j]++; } else if (r < 0){ out[j].push(i); indeg[i]++; }
  }
  for (k = 0; k < n; k++){
    best = -1;
    for (i = 0; i < n; i++) if (!done[i] && indeg[i] <= 0 && (best < 0 || a[i].d < a[best].d)) best = i;
    if (best < 0) for (i = 0; i < n; i++) if (!done[i] && (best < 0 || a[i].d < a[best].d)) best = i;
    done[best] = 1; res.push(a[best]);
    for (j = 0; j < out[best].length; j++) indeg[out[best][j]]--;
  }
  return res;
}

// ---- キャラクターの絵（向き2つ × 目の開け閉め2つを先に作っておく） ----
var SPR = {};
function spriteSet(color, sprite, crown){
  var ps = V.ps, key = [color, sprite, crown ? 1 : 0, ps].join('|');
  if (SPR[key]) return SPR[key];
  function make(open, flip){
    var cv = document.createElement('canvas'); cv.width = 14 * ps; cv.height = 16 * ps;
    var g = cv.getContext('2d');
    if (flip){ g.translate(cv.width, 0); g.scale(-1, 1); }
    paintBot(g, color, sprite, crown, ps, open);
    return cv;
  }
  return SPR[key] = { w: 14 * ps, h: 16 * ps, a: [make(true, false), make(false, false), make(true, true), make(false, true)] };
}

// ================= メンバーの動き（index.html の updateOffice まわりと同じ決め方） =================
function place(c, x, y){ c.x = x; c.y = y; }
function visPos(c, now){   // いま画面に見えている位置（歩いている途中は、区間の中を一定の速さで進む）
  var t = c.tw;
  if (!t) return { x: c.x, y: c.y };
  var k = (now - t.t0) / t.dur;
  if (k >= 1) return { x: t.x1, y: t.y1 };
  if (k < 0) k = 0;
  return { x: t.x0 + (t.x1 - t.x0) * k, y: t.y0 + (t.y1 - t.y0) * k };
}
// 通路を通って歩く（奥の通路・手前の通路・縦の通り道2本）。床のマスに沿って、縦か横にだけ動く
function routeTo(c, t){
  var cp = c.y < 52 ? Y_BACK : Y_FRONT, cq = t.y < 52 ? Y_BACK : Y_FRONT, pts = [];
  if (cp === cq){ pts.push({ x: c.x, y: cp }, { x: t.x, y: cp }); }
  else {
    var ax = Math.abs(AISLES[0] - c.x) < Math.abs(AISLES[1] - c.x) ? AISLES[0] : AISLES[1];
    pts.push({ x: c.x, y: cp }, { x: ax, y: cp }, { x: ax, y: cq }, { x: t.x, y: cq });
  }
  pts.push({ x: t.x, y: t.y });
  return pts.filter(function(p, i){ var q = i ? pts[i-1] : c; return Math.abs(p.x - q.x) > 0.3 || Math.abs(p.y - q.y) > 0.3; });
}
function walkTo(c, target, done){
  var id = ++c.moveId, v = visPos(c, Date.now());
  c.tw = null; place(c, v.x, v.y);   // 歩いている途中で行き先が変わった時は、今いる所から歩き直す
  var pts = routeTo(c, target);
  c.say.t = ''; c.say.cls = 'say'; c.k.train = false;
  (function next(){
    if (id !== c.moveId) return;
    var p = pts.shift();
    if (!p){ c.k.walk = false; c.tw = null; if (done) done(); return; }
    var dx = (p.x - c.x) * 2, dy = p.y - c.y, sec = Math.max(0.15, Math.sqrt(dx*dx + dy*dy) / 13);   // 速さ一定
    if (Math.abs(dx - dy) > 0.6) c.k.flip = (dx - dy) < 0;   // 画面の上で左へ進む時は左向き
    c.k.walk = true;
    c.tw = { x0: c.x, y0: c.y, x1: p.x, y1: p.y, t0: Date.now(), dur: sec * 1000 };
    place(c, p.x, p.y);
    setTimeout(next, sec * 1000 + 30);
  })();
}
function freeSpot(c){
  if (c.spot != null){ SPOTS[c.spot].by = null; c.spot = null; }
}
// 空いている休み場所。自主点検でトレーニングに人が並んでいる間は、トレーニングの3か所を使わない（並んでいる人と同じ場所に重なるため）
function openSpots(){
  var open = [];
  SPOTS.forEach(function(p, i){ if (!p.by && !(p.train && OFFICE.trn)) open.push(i); });
  return open;
}
// おたすけ（席の無い応援）の場所は島の棚の前。2人いる時は横に並べる（同じ場所に重ねない）。3人目からは1人目の場所
function helperSeat(c){
  var used = {};
  Object.keys(OFFICE.chars).forEach(function(id){ var o = OFFICE.chars[id]; if (o !== c && o.seated && o.hslot != null) used[o.hslot] = 1; });
  c.hslot = used[0] && !used[1] ? 1 : 0;
  return { x: 77 + c.hslot * 6.7, y: 63 };
}
function goIdle(c, id){
  var open = openSpots();
  if (!open.length) return;
  var i = open[Math.floor(Math.random() * open.length)], p = SPOTS[i];
  freeSpot(c); p.by = id; c.spot = i;
  walkTo(c, p, function(){
    var cls = p.train ? 'say kata' : 'say emo';
    if (p.train && c.spot === i) c.k.train = true;   // トレーニング中は小さく体を動かす
    if (p.emo){ c.say.cls = cls; c.say.t = p.emo; setTimeout(function(){ if (c.say.cls === cls) c.say.t = ''; }, 3500); }
    c.nextAct = Date.now() + 5000 + Math.random() * 6000;
  });
  c.nextMove = Date.now() + 35000 + Math.random() * 55000;   // 次に動くのは 35〜90 秒後（ばらばらに）
}
function ensureChar(id, m, crown){
  var c = OFFICE.chars[id];
  if (c) return c;
  c = OFFICE.chars[id] = { id: id, m: m, crown: !!crown, click: !!memberOf(id), say: { t: '', cls: 'say' },
    k: { walk: false, work: false, train: false, busy: false, flip: false },
    x: 0, y: 0, seated: false, moveId: 0, spot: null, tw: null, blink: Math.floor(Math.random() * 20) * 250,
    nextMove: Date.now() + 15000 + Math.random() * 60000 };
  var p = seatOf(id);
  if (id !== 'owner'){
    var open = openSpots();
    if (open.length){ var i = open[Math.floor(Math.random() * open.length)]; SPOTS[i].by = id; c.spot = i; p = SPOTS[i]; }
  }
  if (!p) p = { x: 95, y: 74 };
  place(c, p.x, p.y);
  return c;
}
function removeChar(id){ var c = OFFICE.chars[id]; if (!c) return; c.moveId++; freeSpot(c); delete OFFICE.chars[id]; delete OFFICE.desk[id]; }
function fx(cls, text, from, to){
  OFFICE.fx.push({ cls: cls, text: text, x0: from.x, y0: from.y, x1: to ? to.x : from.x, y1: to ? to.y : from.y, move: !!to, t0: Date.now(), life: to ? 1400 : 2700 });
}
function buildOffice(){
  buildScene();
  Object.keys(OFFICE.chars).forEach(function(id){ OFFICE.chars[id].moveId++; });
  OFFICE.chars = {}; OFFICE.desk = {}; SPOTS.forEach(function(p){ p.by = null; });
}
function updateOffice(){
  var sig = [TEAM.owner.sprite, TEAM.boss.sprite, TEAM.boss.color].concat(TEAM.members.map(function(m){ return m.id+m.sprite+m.color+m.nick; })).join('|');
  if (sig !== OFFICE.sig){ OFFICE.sig = sig; OFFICE.prev = {}; buildOffice(); }
  var st = STATE || {}, agents = st.agents || {}, boss = st.boss || {};
  var list = [{ id: 'owner', m: TEAM.owner, s: {} }, { id: 'boss', m: TEAM.boss, s: boss, crown: true }];
  TEAM.members.forEach(function(m){ list.push({ id: m.id, m: m, s: agents[m.id] || {} }); });
  // 名簿に無い応援スタッフ（おたすけ）は、動いている間だけ出てくる
  Object.keys(agents).forEach(function(id){
    if (memberOf(id)) return;
    if (agents[id].status === 'working') list.push({ id: id, m: { nick: 'おたすけ', color: '#9ca3af', sprite: 'ghost' }, s: agents[id] });
    else if (OFFICE.chars[id]) removeChar(id);
  });
  OFFICE.trn = list.some(function(o){ return o.id !== 'owner' && o.s.status === 'working' && /自主点検/.test(o.s.task || ''); });
  list.forEach(function(o){
    var c = ensureChar(o.id, o.m, o.crown), working = o.s.status === 'working', was = OFFICE.prev[o.id];
    OFFICE.desk[o.id] = working;
    if (o.id === 'owner') return;
    var text = cut(o.id === 'boss' ? (toolWords(o.s.lastTool, '') || '考えています') : (o.s.task || '作業中'), 18);
    if (working){
      c.text = text;
      if (!c.seated){
        c.seated = true; freeSpot(c);
        // 自主点検（週1回のふり返り）の間は、席ではなくトレーニングルームにいる
        // 立つ場所は名簿の順をもとに trainSpot が割りふる。名簿に無い人（チロル・おたすけ）は、メンバーの後ろに並ぶ
        var tr = /自主点検/.test(o.s.task || ''), ti = TEAM.members.length + (o.id === 'boss' ? 0 : 1);
        TEAM.members.forEach(function(m, k){ if (m.id === o.id) ti = k; });
        // おたすけ（席の無い応援）は島の棚の前。平面のオフィスの (69,66) は休み場所の1つと同じ座標で、斜めにすると完全に重なるため、右へずらした
        var seat = tr ? trainSpot(ti) : (seatOf(o.id) || helperSeat(c));
        c.train = tr;
        if (was === false && o.id !== 'boss' && OFFICE.chars.boss) fx('paper', '📄', OFFICE.chars.boss, seat);
        c.seat = seat; c.k.busy = false;
        var sit = function(){ c.k.flip = false; c.k.walk = false; c.k[c.train ? 'train' : 'work'] = true; c.say.cls = 'say'; c.say.t = c.train ? '' : (c.text || ''); };
        c.sit = sit; c.due = Date.now() + 20000;   // 20秒たっても席に着いていなければ、席へ直接戻す
        walkTo(c, seat, sit);
      } else if (c.k.work) { c.say.cls = 'say'; c.say.t = text; }
      else if (!c.k.train && c.due && Date.now() > c.due){ c.moveId++; c.tw = null; place(c, c.seat.x, c.seat.y); c.sit(); c.due = 0; }
    } else if (c.seated){
      c.seated = false; c.k.work = false; c.k.train = false; c.say.t = ''; c.say.cls = 'say'; c.due = 0;
      if (was === true && o.id !== 'boss') fx('pop', '✔ +' + XP_PER_TASK + 'XP', c);
      c.nextMove = Date.now() + 4000 + Math.random() * 5000;   // 少し席で一息ついてから離れる
    }
    OFFICE.prev[o.id] = working;
  });
  // 自主点検が始まった時にトレーニングの休み場所にいる人は、早めに ほかの場所へ移る
  if (OFFICE.trn) Object.keys(OFFICE.chars).forEach(function(id){
    var c = OFFICE.chars[id];
    if (!c.seated && c.spot != null && SPOTS[c.spot].train) c.nextMove = Math.min(c.nextMove, Date.now() + 1000 + Math.random() * 3000);
  });
  // 店長が話しかけた時は、店長の上に吹き出しを数秒出す
  var lp = (st.log || []).filter(function(l){ return l.type === 'prompt'; }).pop(), oc = OFFICE.chars.owner;
  if (lp && oc && lp.t !== OFFICE.lastPrompt){
    var fresh = OFFICE.lastPrompt !== 0 || Date.now() - lp.t < 15000;
    OFFICE.lastPrompt = lp.t;
    if (fresh){ oc.say.cls = 'say'; oc.say.t = '💬 ' + cut(lp.text, 16); clearTimeout(oc.st); oc.st = setTimeout(function(){ oc.say.t = ''; }, 7000); }
  }
  // 絵の左下の1行：いま作業中の人
  WORKING = list.filter(function(o){ return o.id !== 'owner' && o.s.status === 'working'; }).map(function(o){ return o.m.nick || o.m.name; });
  renderSide();
  if (shown()){ lastKey = ''; render(Date.now()); }   // 変わった時は、次のコマを待たずにすぐ描く
  kick();
}
function speak(c, words){
  c.say.cls = 'say kata'; c.say.t = words; c.k.busy = true;
  setTimeout(function(){ c.k.busy = false; if (c.say.cls === 'say kata' && c.say.t === words){ c.say.t = ''; } }, 2800);
}
// 待機中は、たまに1人ずつ別の場所へ歩く（全員が同時には動かない）。2秒ごとに呼ぶ
function behave(){
  if (!TEAM || document.hidden) return;
  var now = Date.now(), moved = false;
  Object.keys(OFFICE.chars).forEach(function(id){
    var c = OFFICE.chars[id];
    if (moved || id === 'owner' || c.seated || now < c.nextMove) return;
    goIdle(c, id); moved = true;
  });
  // 待機中は、いる場所に合ったことをする（ときどき小さくひとこと。休憩室で2人そろうとおしゃべり）
  Object.keys(OFFICE.chars).forEach(function(id){
    var c = OFFICE.chars[id], p = c.spot != null ? SPOTS[c.spot] : null;
    if (id === 'owner' || c.seated || !p || c.k.walk || !c.nextAct || now < c.nextAct || c.say.t) return;
    var words, mate = p.chat != null && SPOTS[p.chat].by ? OFFICE.chars[SPOTS[p.chat].by] : null;
    if (mate && !mate.seated && !mate.k.walk && !mate.say.t && Math.random() < 0.6){
      var pair = CHAT[Math.floor(Math.random() * CHAT.length)];
      words = pair[0];
      (function(m, w){ setTimeout(function(){ if (!m.seated && !m.k.walk && !m.say.t) speak(m, w); }, 1500); m.nextAct = now + 9000 + Math.random() * 6000; })(mate, pair[1]);
    } else {
      var pool = (HABITS[id] && Math.random() < 0.35) ? HABITS[id] : (p.acts || []);
      words = pool[Math.floor(Math.random() * pool.length)];
    }
    if (words) speak(c, words);
    c.nextAct = now + 8000 + Math.random() * 9000;
  });
  // 店長は事務所でひっそり作業している（ときどき小さく「カタカタ」と出る）
  var oc = OFFICE.chars.owner;
  if (oc){
    oc.k.work = true;
    if (!oc.nextKata) oc.nextKata = now + 6000;
    if (now > oc.nextKata && !oc.say.t){
      oc.say.cls = 'say kata'; oc.say.t = 'ｶﾀｶﾀ…';
      setTimeout(function(){ if (oc.say.cls === 'say kata'){ oc.say.t = ''; oc.say.cls = 'say'; } }, 2600);
      oc.nextKata = now + 20000 + Math.random() * 30000;
    }
  }
  kick();   // 歩き出した・ひとことが出た時に、すぐ描く
}

// ================= 1コマを描く =================
var lastKey = '', lastDraw = 0, HITS = [], WRAP = {}, BUBS = [], SEATR = null;
function textW(g, t){ return g.measureText(t).width; }
function wrapLines(g, text, maxW){   // 吹き出しは短く：2行まで。空白の所か、まん中あたりで折る。入りきらない分は「…」
  var key = text + '|' + maxW, v = WRAP[key];
  if (v) return v;
  var ch = Array.from(String(text).trim()), lines, i, a, b, best = -1, bw = 1e9, full = textW(g, ch.join(''));
  if (full <= maxW) lines = [ch.join('')];
  else {
    for (i = 1; i < ch.length - 1; i++) if (ch[i] === ' ' || ch[i] === '　'){   // 空白で折って、両方とも入るなら そこで折る
      a = textW(g, ch.slice(0, i).join('')); b = textW(g, ch.slice(i + 1).join(''));
      if (a <= maxW && b <= maxW && Math.max(a, b) < bw){ bw = Math.max(a, b); best = i; }
    }
    if (best > 0) lines = [ch.slice(0, best).join(''), ch.slice(best + 1).join('')];
    else {
      for (i = 1; i < ch.length; i++) if (textW(g, ch.slice(0, i).join('')) >= Math.min(maxW, full / 2) - 1) break;
      if (textW(g, ch.slice(0, i).join('')) > maxW) i--;
      a = ch.slice(0, i).join('').trim(); b = ch.slice(i);
      if (textW(g, b.join('')) > maxW){ while (b.length > 1 && textW(g, b.join('') + '…') > maxW) b.pop(); b.push('…'); }
      lines = [a, b.join('').trim()];
    }
  }
  v = { lines: lines, w: 0 };
  lines.forEach(function(l){ v.w = Math.max(v.w, textW(g, l)); });
  return WRAP[key] = v;
}
function overlap(a, b){   // 2つの四角が重なる広さ
  var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
function render(now){
  var g = stageG, ids = Object.keys(OFFICE.chars), key = V.gen + '#', i, c, v, items, list = [];
  var anyOn = false;
  for (i in OFFICE.desk) if (OFFICE.desk[i]) anyOn = true;
  // 動きの区切り（tq）：歩いている人・紙がある間は、今の時刻のまま（なめらかに）。だれも動いていない間は 0.5秒（か 0.25秒）きざみにそろえ、
  // まばたき・足ぶみ・モニターの光が その区切りでだけ切りかわるようにする（描く回数を減らすため）。wink＝目を閉じている長さ
  var gap = anyMoving() ? 0 : calmGap(), tq = gap ? Math.floor(now / gap) * gap : now, wink = gap || 250;
  // どの絵を出すか（位置・足ぶみ・まばたき）を先に決め、前のコマと同じなら描かない
  for (i = 0; i < ids.length; i++){
    c = OFFICE.chars[ids[i]]; v = visPos(c, now);
    c.vx = v.x; c.vy = v.y;
    c.bob = c.k.walk ? Math.floor(tq / 180) % 2 * 2 : c.k.train ? Math.floor(tq / 250) % 2 * 2 : c.k.busy ? Math.floor(tq / 250) % 2 : c.k.work ? Math.floor(tq / 500) % 2 : 0;
    c.shut = ((tq + c.blink) % 5000) < wink ? 1 : 0;
    key += c.id + ':' + Math.round(v.x * 8) + ',' + Math.round(v.y * 8) + ',' + c.bob + c.shut + (c.k.flip ? 'f' : '') + (c.seated ? 's' : '') + c.say.cls + c.say.t + ';';
  }
  key += (anyOn ? Math.floor(tq / 500) % 2 : '') + '/' + Math.floor(tq / 1000) % 2 + '/' + (OFFICE.fx.length ? now : '') + '/' + SEL;
  lastDraw = now;
  if (key === lastKey) return;
  lastKey = key;
  var t0 = performance.now();
  FACES = 0;

  items = SCENE.slice();
  for (i = 0; i < ids.length; i++){
    c = OFFICE.chars[ids[i]];
    items.push({ ch: c, x0: c.vx * 2 - 3, x1: c.vx * 2 + 3, y0: c.vy - 1.2, y1: c.vy + 1.2 });
  }
  items = sortItems(items);

  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, V.W, V.H);
  g.imageSmoothingEnabled = false;
  g.save(); if (V.lw % 2) g.translate(0.5, 0.5);
  g.lineWidth = V.lw; g.lineJoin = 'round';
  HITS = [];
  for (i = 0; i < items.length; i++){
    if (items[i].ch){ g.restore(); drawChar(g, items[i].ch); list.push(items[i].ch); g.save(); if (V.lw % 2) g.translate(0.5, 0.5); g.lineWidth = V.lw; g.lineJoin = 'round'; }
    else items[i].draw(g, tq);
  }
  g.restore();
  drawLabels(g, list);
  drawFx(g, now);

  var ms = performance.now() - t0;
  PERF.n++; PERF.sum += ms; PERF.last = ms; if (PERF.n > 3 && ms > PERF.max) PERF.max = ms; PERF.objs = items.length; PERF.faces = FACES;
}
function drawChar(g, c){
  var set = spriteSet(c.m.color || '#9ca3af', c.m.sprite || 'ghost', c.crown), ps = V.ps;
  var p = P(c.vx * 2, c.vy, 0), cx = Math.round(p[0]), cy = Math.round(p[1]);
  var bob = Math.round(c.bob * Math.max(1, ps / 2) / 2);
  var x = cx - set.w / 2, y0 = cy - set.h + Math.round(ps / 2), y = y0 - bob;   // 札や吹き出しは、足ぶみでは揺らさない（y0 を基準にする）
  // 足元の丸い影
  g.fillStyle = 'rgba(60,45,25,.22)';
  g.beginPath(); g.ellipse(cx, cy, set.w * 0.36, set.w * 0.15, 0, 0, 6.2832); g.fill();
  c.img = set.a[(c.k.flip ? 2 : 0) + c.shut]; c.ix = x; c.iy = y;
  g.drawImage(c.img, x, y);
  c.sx = cx; c.sy = cy; c.top = y0 + (c.crown ? 0 : 2 * ps); c.sw = set.w;
  c.head = { x: x, y: y0, w: set.w, h: 12 * ps };   // 顔のあたり（吹き出しで隠さない所）
  // 名札で隠さない所：顔（耳の先〜口）と王冠。足のあたりは、名札が少しかかってもよい
  c.face = { x: cx - 6.5 * ps, y: y0 + 2 * ps, w: 13 * ps, h: 10 * ps };
  c.crownR = c.crown ? { x: cx - 3.5 * ps, y: y0, w: 6 * ps, h: 2.5 * ps } : null;
  c.legs = { x: cx - 6 * ps, y: y0 + 12 * ps, w: 12 * ps, h: 3.5 * ps };
  if (c.click) HITS.push({ id: c.id, x: x, y: y, w: set.w, h: set.h });
}
// 名札の置き場所を決める。基本は足元のすぐ下。そこが ほかの人の顔や ほかの名札に重なる時は、
// 少し横 → 1〜2段下 → 頭の上 → 体の横 の中から、いちばん重ならない所を選ぶ。
// （名札は人の絵より後に描くので、手前の人の頭の後ろに隠れない。歩いている人の名札は動かさない＝通るたびに ほかの名札が動くと落ち着かないため）
function placeTags(g, list){
  var d = V.dpr, ps = V.ps, h = (V.fs + 4) * d, st = h + 2 * d, DX = [0, -14, 14, -26, 26], still = [], tags = [];
  var i, j, k, n, c, o, w, x0, cand, r, q, cost, hit, face, best, bc, bh, bf;
  function fit(x, y, w){ return { x: Math.max(2, Math.min(V.W - w - 2, Math.round(x))), y: Math.max(2, Math.min(V.H - h - 2, Math.round(y))), w: w, h: h }; }
  for (i = 0; i < list.length; i++){
    c = list[i]; w = Math.ceil(textW(g, c.m.nick || c.m.name)) + (V.fs - 3) * d;
    if (c.k.walk){ c.tag = fit(c.sx - w / 2, c.sy + 4 * d, w); c.tagHide = false; c.tagK = -1; }
    else { c.tagW = w; still.push(c); }
  }
  // 置く順：作業中の人 → 手前の人 → 奥の人（先に置いた名札が優先）
  still.sort(function(a, b){ return (b.seated ? 1 : 0) - (a.seated ? 1 : 0) || (b.sy - a.sy) || (a.id < b.id ? -1 : 1); });
  for (i = 0; i < still.length; i++){
    c = still[i]; w = c.tagW; x0 = c.sx - w / 2; cand = [];
    for (n = 0; n < 3; n++) for (k = 0; k < 5; k++) cand.push([x0 + DX[k] * d, c.sy + 4 * d + n * st, n * 300 + (k + 1 >> 1) * 120 + k]);     // 足元の下（横へ少し・1〜2段下）
    for (n = 0; n < 2; n++) for (k = 0; k < 3; k++) cand.push([x0 + DX[k] * d, c.top - 4 * d - h - n * st, 420 + n * 380 + k * 60]);           // 頭の上
    cand.push([c.sx + 6.5 * ps + 3 * d, c.sy - h - d, 520], [c.sx - 6.5 * ps - 3 * d - w, c.sy - h - d, 522]);                                    // 体の横（右・左）
    best = null; bc = 1e15; bh = 0; bf = 0;
    for (k = 0; k < cand.length; k++){
      r = fit(cand[k][0], cand[k][1], w); q = { x: r.x - d, y: r.y - d, w: w + 2 * d, h: h + 2 * d };
      cost = cand[k][2] * d * d; hit = 0; face = 0;
      for (j = 0; j < tags.length; j++) hit += overlap(q, tags[j]);   // q＝まわりに1pxのすきまを足した大きさ（名札どうしを くっつけない）
      for (j = 0; j < still.length; j++){
        o = still[j];
        face += overlap(r, o.face) + (o.crownR ? overlap(r, o.crownR) : 0);
        if (o !== c) cost += overlap(r, o.legs) * 6;
      }
      cost += hit * 100 + face * 30;
      if (c.tagK === k) cost -= 300 * d * d;   // 前に置いた場所を少し有利にする（近くの人が歩き出す・止まるたびに、名札が行ったり来たりしないように）
      if (cost < bc){ bc = cost; best = r; bf = face; n = k; }
    }
    c.tagK = n;
    // せまい画面で、どこに置いても ほかの名札に重なるか 顔を大きく隠す時は、その間だけ出さない（作業中の人と、押した人の名札は必ず出す）
    for (bh = 0, j = 0; j < tags.length; j++) bh += overlap(best, tags[j]);
    c.tag = best; c.tagHide = V.small && c.id !== SEL && !c.seated && (bh > w * h * 0.08 || bf > w * h * 0.3);
    if (!c.tagHide) tags.push(best);
  }
}
function drawTag(g, c){   // 名札（作業中の人は、本人の色でぬりつぶす）
  var d = V.dpr, t = c.tag, col = c.m.color || '#9ca3af';
  rr(g, t.x + 0.5, t.y + 0.5, t.w, t.h, 8 * d);
  g.fillStyle = c.seated ? mix(col, 0, 0.1) : 'rgba(255,253,248,.94)'; g.fill();
  g.lineWidth = d; g.strokeStyle = col; g.stroke();
  g.fillStyle = c.seated ? '#ffffff' : col; g.fillText(c.m.nick || c.m.name, t.x + t.w / 2, t.y + t.h / 2 + d);
  if (c.click) HITS.push({ id: c.id, x: t.x, y: t.y, w: t.w, h: t.h });
}
function drawLabels(g, list){
  var d = V.dpr, F = V.F, i, j, c, o, col, w, h, x, y, bubbles = [], placed = [], b, n, r, q;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = F + 'px ' + FONT;
  var em = textW(g, 'あ');
  // 名前の札。止まっている人の分を先に描く（歩いている人の分は、吹き出しの後で描く）
  placeTags(g, list);
  for (i = 0; i < list.length; i++){
    c = list[i];
    if (!c.k.walk && !c.tagHide) drawTag(g, c);
    c.sayTop = !c.tagHide && c.tag.y < c.top ? c.tag.y - 2 * d : c.top;   // 名札を頭の上に出した時は、ひとこと・吹き出しを その上に出す
  }
  // 待ちの間の小さなひとこと（枠なし）
  for (i = 0; i < list.length; i++){
    c = list[i];
    if (!c.say.t || c.say.cls !== 'say') c.bubK = -1;
    if (!c.say.t) continue;
    if (c.say.cls === 'say emo'){
      g.font = Math.round((V.fs + 3) * d) + 'px "Segoe UI Emoji","Apple Color Emoji",' + FONT;
      g.fillText(c.say.t, c.sx, c.sayTop - 11 * d);
    } else if (c.say.cls === 'say kata'){
      g.font = Math.round((V.fs + 1) * d) + 'px ' + FONT;
      x = Math.max(2 + textW(g, c.say.t) / 2, Math.min(V.W - 2 - textW(g, c.say.t) / 2, c.sx));
      g.lineWidth = 4 * d; g.strokeStyle = 'rgba(255,255,255,.92)'; g.strokeText(c.say.t, x, c.sayTop - 10 * d);
      g.fillStyle = '#5f666e'; g.fillText(c.say.t, x, c.sayTop - 10 * d);
    } else if (!V.small || c.id === 'owner') bubbles.push(c);   // 小さな画面（V.small）では、作業中の文を絵の中に出さない（すぐ下のメンバー一覧に出ている。絵の中は、ぬりつぶした名札と光るモニターで分かる）
  }
  // 作業中の吹き出し：頭の上（右寄り・左寄り・まん中 × 高さ数段）と、頭の右どなり・左どなりから、
  // ほかの吹き出し・顔・名札にいちばん重ならない所を選ぶ（歩いている人はよけない。通るたびに吹き出しが動いて落ち着かないため）
  g.font = F + 'px ' + FONT;
  bubbles.sort(function(a, b){ return b.sy - a.sy; });
  var UPS = [0, 14, 28, 42, 58, 76, 96, 120], side;
  for (i = 0; i < bubbles.length; i++){
    c = bubbles[i];
    // 小さな画面で絵の中に出すのは、店長が話しかけた時の小さな「💬」だけ
    var wl = wrapLines(g, V.small ? '💬' : c.say.t, 11 * em + 2), best = null, bc = 1e12, cost, hit, narrow = wl.w < 54 * d;
    w = Math.ceil(wl.w) + 16 * d; h = wl.lines.length * (V.fs + 4) * d + 8 * d;
    for (n = 0; n < UPS.length + 2; n++) for (q = 0; q < 3; q++){
      side = n < UPS.length ? 0 : (n === UPS.length ? 1 : -1);
      if (side ? q > 0 : ((narrow && q < 2) || (V.small && n > 2))) continue;   // 短い吹き出しは まん中だけ。小さな画面の「💬」は、頭のすぐ上（少し上まで）か となりだけ
      if (side){
        x = Math.round(side > 0 ? c.sx + c.sw / 2 + 9 * d : c.sx - c.sw / 2 - 9 * d - w); y = Math.round(c.top + 4 * V.ps - h / 2);
        if (x < 3 || x + w > V.W - 3) continue;
        cost = 200 * d * d;
      } else {
        x = Math.round(q === 0 ? c.sx - 24 * d : q === 1 ? c.sx + 24 * d - w : c.sx - w / 2);
        x = Math.max(3, Math.min(V.W - w - 3, x));
        y = c.sayTop - 9 * d - h - UPS[n] * d;
        cost = UPS[n] * d * w * 0.05 + q * 2;
      }
      y = Math.max(3, y);
      r = { x: x - 3 * d, y: y - 3 * d, w: w + 6 * d, h: h + 6 * d }; hit = [0, 0, 0];   // 重なる広さ：[ほかの吹き出し, 名札, 顔]
      for (b = 0; b < placed.length; b++) hit[0] += overlap(r, placed[b]);
      for (j = 0; j < list.length; j++){
        o = list[j];
        if (o.k.walk) continue;
        if (o !== c) hit[2] += overlap(r, o.head);
        if (!o.tagHide) hit[1] += overlap(r, o.tag);
      }
      // 名札には乗せない（待ちの人の名前が読めなくなるため。吹き出しどうしの次に重く見る）
      cost += hit[0] * 1000 + hit[1] * 400 + hit[2] * 10;
      // 一度決めた場所は少し有利にして、重なりが大きく増えた時だけ動かす（近くの人が歩き出す・止まるたびに、吹き出しが切り替わらないように）
      if (c.bubK === n * 3 + q) cost -= 4000 * d * d;
      if (cost < bc){ bc = cost; best = { x: x, y: y, w: w, h: h, c: c, lines: wl.lines, moved: !side && n > 0, side: side, hit: hit, k: n * 3 + q }; }
    }
    c.bubK = best ? best.k : -1;
    // 小さな画面の「💬」は、近くに空きが無ければ出さない（遠くへ飛ばしたり 人の顔に乗せたりしない）
    if (best && !(V.small && (best.hit[0] > 0 || best.hit[1] > w * h * 0.1 || best.hit[2] > w * h * 0.3))) placed.push(best);
  }
  for (i = placed.length - 1; i >= 0; i--){
    b = placed[i]; c = b.c; col = c.m.color || '#9ca3af';
    var tx = Math.max(b.x + 10 * d, Math.min(b.x + b.w - 10 * d, c.sx)), ty = Math.max(b.y + 9 * d, Math.min(b.y + b.h - 9 * d, c.top + 4 * V.ps));
    if (b.moved){   // 上へずらした時は、本人まで点線
      g.save(); g.setLineDash([2 * d, 3 * d]); g.lineWidth = 2 * d; g.strokeStyle = col;
      g.beginPath(); g.moveTo(tx, b.y + b.h); g.lineTo(tx, c.sayTop - 2 * d); g.stroke(); g.restore();
    }
    rr(g, b.x, b.y + 2 * d, b.w, b.h, 8 * d); g.fillStyle = 'rgba(60,45,25,.15)'; g.fill();
    rr(g, b.x, b.y, b.w, b.h, 8 * d); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2 * d; g.strokeStyle = col; g.stroke();
    if (b.side){    // 頭のとなりに出した時は、横向きのしっぽ
      x = b.side > 0 ? b.x : b.x + b.w;
      g.beginPath(); g.moveTo(x + b.side * d, ty - 5 * d); g.lineTo(x - b.side * 7 * d, ty); g.lineTo(x + b.side * d, ty + 5 * d);
      g.fillStyle = '#ffffff'; g.fill(); g.stroke();
      g.fillRect(b.side > 0 ? x : x - 2 * d, ty - 4 * d, 2 * d, 8 * d);
    } else if (!b.moved){   // しっぽ
      g.beginPath(); g.moveTo(tx - 5 * d, b.y + b.h - d); g.lineTo(tx, b.y + b.h + 6 * d); g.lineTo(tx + 5 * d, b.y + b.h - d);
      g.fillStyle = '#ffffff'; g.fill(); g.stroke();
      g.fillRect(tx - 4 * d, b.y + b.h - 2 * d, 8 * d, 2 * d);
    }
    g.fillStyle = '#4a3a2a';
    for (n = 0; n < b.lines.length; n++) g.fillText(b.lines[n], b.x + b.w / 2, b.y + 4 * d + (V.fs + 4) * d * (n + 0.5) + d);
  }
  BUBS = placed;
  // 歩いている人は、吹き出しの手前を通る（吹き出しの下に隠れない）。吹き出しに重なる所だけ、絵を上に描き直す。名札も後に描く
  for (i = 0; i < list.length; i++){
    c = list[i];
    if (!c.k.walk) continue;
    r = { x: c.ix, y: c.iy, w: c.sw, h: 16 * V.ps };
    for (j = 0; j < placed.length; j++){
      b = placed[j];
      if (!overlap(r, { x: b.x - 2 * d, y: b.y - 2 * d, w: b.w + 4 * d, h: b.h + 10 * d })) continue;
      g.save(); g.beginPath(); g.rect(b.x - 2 * d, b.y - 2 * d, b.w + 4 * d, b.h + 10 * d); g.clip();
      g.drawImage(c.img, c.ix, c.iy); g.restore();
    }
    drawTag(g, c);
  }
  // 押した人の席に「◯◯の席」と出す（役割の説明を開いている間だけ）
  // （とても小さな絵＝スマホの縦では出さない。本人の名札に重なるため。平面のオフィスも、スマホでは席の名前を出していなかった）
  var sm = SEL && TEAM ? memberOf(SEL) : null, ss = sm && V.fs >= 13 ? seatOf(SEL) : null;
  SEATR = null;
  if (ss){
    var st = SEL === 'boss' ? 'レジ（社長席）' : SEL === 'owner' ? '店長席' : (sm.nick || sm.name) + 'の席';
    var sp = SEL === 'boss' ? P(ss.x * 2, 53.5, 0) : P(ss.x * 2 + 1, ss.y + 3.5 + (SEL === 'owner' ? 4.6 : 6), 0);
    col = sm.color || '#9ca3af'; w = Math.ceil(textW(g, st)) + 14 * d; h = (V.fs + 6) * d;
    x = Math.max(3, Math.min(V.W - w - 3, Math.round(sp[0] - w / 2))); y = Math.min(V.H - h - 3, Math.round(sp[1] + 7 * d));
    g.beginPath(); g.moveTo(x + w / 2 - 6 * d, y + d); g.lineTo(x + w / 2, y - 6 * d); g.lineTo(x + w / 2 + 6 * d, y + d); g.closePath(); g.fillStyle = col; g.fill();
    rr(g, x, y, w, h, 4 * d); g.fillStyle = '#fffdf8'; g.fill(); g.lineWidth = 2 * d; g.strokeStyle = col; g.stroke();
    g.fillStyle = '#4a3a2a'; g.fillText(st, x + w / 2, y + h / 2 + d);
    SEATR = { id: SEL, x: x, y: y - 6 * d, w: w, h: h + 6 * d };   // 印の場所（役割の説明を置く角を選ぶ時に、ここを隠さない）
  }
}
function drawFx(g, now){
  var d = V.dpr, i, f, k, e, p, w, h, y, a;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (i = OFFICE.fx.length - 1; i >= 0; i--){
    f = OFFICE.fx[i];
    if (now - f.t0 > f.life){ OFFICE.fx.splice(i, 1); continue; }
    if (f.move){   // 📄 がチロルから席へ飛ぶ（1.2秒）
      k = Math.min(1, (now - f.t0) / 1200); e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      p = P((f.x0 + (f.x1 - f.x0) * e) * 2, f.y0 + (f.y1 - f.y0) * e, 15 + 9 * Math.sin(Math.PI * e));
      g.font = Math.round(Math.max(16, Math.min(22, V.tw / d * 0.28)) * d) + 'px "Segoe UI Emoji","Apple Color Emoji",' + FONT;
      g.fillStyle = '#4a3a2a'; g.fillText(f.text, Math.round(p[0]), Math.round(p[1]));
    } else {      // 「✔ +20XP」が浮かんで消える（2.6秒）
      k = Math.min(1, (now - f.t0) / 2600); a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
      p = P(f.x0 * 2, f.y0, 0);
      g.font = V.F + 'px ' + FONT;
      w = Math.ceil(textW(g, f.text)) + 16 * d; h = (V.fs + 6) * d; y = p[1] - 16 * V.ps - 6 * d - h - 28 * d * (1 - Math.pow(1 - k, 2));
      g.globalAlpha = Math.max(0, a);
      rr(g, Math.round(p[0] - w / 2), Math.round(y), w, h, 8 * d); g.fillStyle = '#e9f7e6'; g.fill(); g.lineWidth = 2 * d; g.strokeStyle = '#2f9e5b'; g.stroke();
      g.fillStyle = '#2f9e5b'; g.fillText(f.text, Math.round(p[0]), Math.round(y + h / 2 + d));
      g.globalAlpha = 1;
    }
  }
}

// ---- 描画の回し方 ----
// ・歩いている人・飛んでいる紙がある間：画面の書きかえに合わせて細かく描く（30ms あける＝1秒に約30回）。
// ・だれも動いていない間：タイマーで 0.5秒に1回（ひとこと・トレーニング中は 0.25秒に1回）だけ見て、前と同じ絵なら描かない。
//   まばたき・タイピングの足ぶみ・モニターの光は、この区切りに合わせて切りかわる（render の tq）。
// ・見えていない間（ブラウザが裏・ほかのタブを開いている・入れ物の大きさが 0）は止める。戻った時は kick が動かす。
var RUN = false, RAF = 0, TMR = 0, IV = 0, RO = null, FAILS = 0;
function anyMoving(){
  if (OFFICE.fx.length) return true;
  for (var id in OFFICE.chars) if (OFFICE.chars[id].k.walk) return true;
  return false;
}
function calmGap(){
  for (var id in OFFICE.chars){ var k = OFFICE.chars[id].k; if (k.train || k.busy) return 250; }
  return 500;
}
function shown(){ return RUN && !document.hidden && stageCv.clientWidth > 0 && stageCv.clientHeight > 0; }
function frame(){
  RAF = 0; TMR = 0;
  if (!shown()) return;
  var now = Date.now();
  try {
    if (refit()){ render(now); placeCard(); FAILS = 0; }
    else if (!anyMoving() || now - lastDraw >= 30){ render(now); FAILS = 0; }   // FAILS は「描けた時」だけ 0 に戻す（間をあけて飛ばしたコマでは戻さない）
  } catch (e){ fail(e); if (!RUN) return; }
  if (anyMoving()) RAF = requestAnimationFrame(frame);
  else { var gap = calmGap(); TMR = setTimeout(frame, gap - (Date.now() % gap) + 4); }
}
function kick(){   // 次の書きかえで1回描いて、回し直す（何かが変わった時・見えるようになった時に呼ぶ）
  if (!RUN) return;
  if (TMR){ clearTimeout(TMR); TMR = 0; }
  if (!RAF && shown()) RAF = requestAnimationFrame(frame);
}
// 描くのに3回続けて失敗したら、この部品を止めて index.html に知らせる（index.html は平面のオフィスに戻す）
function fail(e){
  try { console.warn('オフィス（斜め見下ろし）：' + (e && e.message ? e.message : e)); } catch (x) {}
  lastKey = '';            // 途中で止まった絵を残さない：次のコマで必ず描き直す（「前と同じ絵」と見なして飛ばさない）
  if (++FAILS < 3) return;
  var h = H; stop();
  if (h && h.onError){ try { h.onError(e); } catch (x) {} }
}
function onVisible(){
  if (!RUN) return;
  if (document.hidden){ if (RAF){ cancelAnimationFrame(RAF); RAF = 0; } if (TMR){ clearTimeout(TMR); TMR = 0; } return; }
  // 画面を裏にしている間に歩きが止まっていた人は、席へ直接置く
  Object.keys(OFFICE.chars).forEach(function(id){ var c = OFFICE.chars[id]; if (c.seated && c.seat && c.sit && !c.k.work && !c.k.train){ c.moveId++; c.tw = null; place(c, c.seat.x, c.seat.y); c.sit(); c.due = 0; } });
  lastKey = ''; kick();
}
function onFonts(){   // Web の字（DotGothic16）が届いたら、字の幅の覚えを捨てて描き直す（先に別の字で描いた壁の札・名札を直す）
  if (!RUN || !V.W) return;
  try { WRAP = {}; lastKey = ''; drawStatic(floorG); if (shown()) render(Date.now()); } catch (e) {}
}

// ================= メンバーを押した時 =================
// 絵の中の人・名札を押す → index.html の selectMember（H.onPick）→ index.html が select(id) を呼び返す。
// 選ぶ人を決めるのは index.html だけ（一覧の行・「とじる」も index.html が受ける）。この部品は、押された事を知らせるのと、
// 「◯◯の席」の印・絵の中の役割の説明（H.cardHtml が返した中身。見る側では空）を出すだけ
var SEL = '';
function renderCard(){ cardEl.innerHTML = SEL && H.cardHtml ? (H.cardHtml(SEL) || '') : ''; }
// 役割の説明を置く角を選ぶ（広い時）。右上・右下・左上・左下のうち、押した本人（絵・名札・吹き出し）を隠さず、
// ほかの人にも いちばん重ならない角。開いた時と、絵の大きさが変わった時に決める（人が歩くたびには動かさない）。せまい時は出さない
function placeCard(){
  var css = cardEl.style;
  css.left = css.top = '';
  if (!SEL || V.small || !cardEl.firstChild) return;
  var d = V.dpr, W = V.cssW, HH = V.cssH, w = cardEl.offsetWidth, h = cardEl.offsetHeight;
  var spots = [[W - w - 8, 8], [W - w - 8, HH - h - 8], [8, 8], [8, HH - h - 40]], best = 0, bc = 1e15, i, id, c, k, r, cost;
  for (i = 0; i < 4; i++){
    spots[i][1] = Math.max(8, spots[i][1]);
    r = { x: spots[i][0] * d, y: spots[i][1] * d, w: w * d, h: h * d }; cost = i;
    for (id in OFFICE.chars){
      c = OFFICE.chars[id];
      if (c.sx == null || !c.tag) continue;
      k = id === SEL ? 40 : 1;
      cost += k * (overlap(r, { x: c.ix, y: c.iy, w: c.sw, h: 16 * V.ps }) + (c.tagHide ? 0 : 2 * overlap(r, c.tag)));
    }
    for (k = 0; k < BUBS.length; k++) cost += (BUBS[k].c.id === SEL ? 40 : 2) * overlap(r, BUBS[k]);
    if (SEATR && SEATR.id === SEL) cost += 40 * overlap(r, SEATR);   // 押した人の「◯◯の席」の印も隠さない（本人が席を離れている時）
    if (cost < bc){ bc = cost; best = i; }
  }
  css.left = spots[best][0] + 'px'; css.top = spots[best][1] + 'px';
}
function select(id){
  if (!RUN) return;
  SEL = id || ''; renderCard();
  if (shown()){ lastKey = ''; render(Date.now()); }
  placeCard(); kick();
}
function hitAt(e){
  var b = stageCv.getBoundingClientRect(), x = (e.clientX - b.left) * V.dpr, y = (e.clientY - b.top) * V.dpr, i, h;   // 押した所を、絵の左上からの位置（絵の画素）に直す
  for (i = HITS.length - 1; i >= 0; i--){ h = HITS[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h.id; }
  return '';
}
function onClick(e){ var id = hitAt(e); if (id && H.onPick) H.onPick(id); }
function onMove(e){ stageCv.style.cursor = hitAt(e) ? 'pointer' : 'default'; }

// ================= 確かめ用の仮の状態（index.html が URL の ?demo= を見て呼ぶ。その時 index.html は state.js を読まない） =================
// mode：'1'＝3人が作業中（22秒後から30秒ごとに1人が仕事を始め、8秒後に別の1人が終わる＝📄 と ✔ の確かめ）
// 　　　'0'＝全員待ち／'2'＝全員が作業中（吹き出しの重なりの確かめ。1人は自主点検、応援も1人）／'3'＝全員が自主点検（並びの確かめ）
var DEMO_TASK = { research: '2店舗 外部要因のリサーチ', planner: '新村 清算書の数字まとめ', strategy: '新村 今週の作戦づくり', pop: '2店舗 売場マップとPOPを作成', 'crew-info': 'クルー向けお知らせの図解', 'crew-care': '面談の準備', 'system-dev': 'アプリの動作確認' };
var DEMO_ST = null, DEMO_T0 = 0, DEMO_CYC = -1, DEMO_END = 0, DEMO_NEXT = 0;
function demoState(team, mode){
  var now = Date.now(), ids = team.members.map(function(m){ return m.id; }), D = DEMO_ST;
  mode = String(mode == null || mode === '' ? '1' : mode);
  DEMO_ON = true;
  function start(id){ D.agents[id] = { status: 'working', task: DEMO_TASK[id] || '作業中', since: now }; }
  function stop1(id){ D.agents[id] = { status: 'idle', task: '', since: 0 }; }
  if (!D){
    DEMO_T0 = now;
    D = DEMO_ST = { boss: { status: 'idle' }, agents: {}, log: [], updatedAt: now };
    ids.forEach(stop1);
    if (mode === '3'){
      D.boss = { status: 'working', lastTool: 'Agent', since: now };
      ids.forEach(function(id){ start(id); D.agents[id].task = '自主点検（週1回のふり返り）'; });
    } else if (mode === '2'){
      D.boss = { status: 'working', lastTool: 'Agent', since: now };
      ids.forEach(start);
      if (D.agents['crew-care']) D.agents['crew-care'].task = '自主点検（週1回のふり返り）';
      D.agents['general-purpose'] = { status: 'working', task: '調べものの手伝い', since: now };
    } else if (mode !== '0'){
      D.boss = { status: 'working', lastTool: 'Read', since: now };
      ['strategy', 'pop'].forEach(function(id){ if (D.agents[id]) start(id); });
      D.log.push({ t: now, who: 'owner', type: 'prompt', text: 'オフィスを立体にした見本を見せて' });
    }
  }
  if (mode !== '0' && mode !== '2' && mode !== '3'){
    var cyc = Math.floor((now - DEMO_T0 - 22000) / 30000);
    if (cyc >= 0 && cyc !== DEMO_CYC){
      DEMO_CYC = cyc;
      for (var n = 0; n < ids.length; n++){ var id = ids[(DEMO_NEXT + n) % ids.length]; if (D.agents[id].status !== 'working'){ start(id); DEMO_NEXT = (DEMO_NEXT + n + 1) % ids.length; break; } }
      DEMO_END = now + 8000;
    }
    if (DEMO_END && now >= DEMO_END){
      DEMO_END = 0;
      var old = null;
      ids.forEach(function(id){ var a = D.agents[id]; if (a.status === 'working' && (!old || a.since < D.agents[old].since)) old = id; });
      if (old) stop1(old);
    }
  }
  return D;
}

// ================= 入口（index.html から呼ぶ） =================
// 見た目（入れ物の中だけに効く。名前はすべて iso- で始める）
var CSS = '.iso-box{position:relative;overflow:hidden;background-color:var(--bg,#f6efe2);background-image:radial-gradient(var(--grid,#ecdfc9) 1.5px,transparent 1.5px);background-size:16px 16px}' +
  '.iso-world{position:relative}' +
  '.iso-world canvas{position:absolute;left:0;top:0;display:block}' +
  '.iso-status{position:absolute;left:8px;bottom:8px;z-index:3;font-size:13px;line-height:1.4;color:var(--ink,#4a3a2a);background:rgba(255,250,240,.9);border:2px solid var(--line,#e3d3b8);border-radius:4px;padding:2px 8px;max-width:calc(100% - 16px)}' +
  '.iso-status:empty{display:none}' +
  '.iso-status i{display:inline-block;width:10px;height:10px;background:var(--sub,#9a8a74);margin-right:6px}' +
  '.iso-status.on i{background:var(--work,#2f9e5b);animation:iso-blink 1s steps(2) infinite}' +
  '.iso-status b{font-weight:400;color:#a23a17;margin-left:10px}' +
  '@keyframes iso-blink{50%{opacity:.25}}' +
  '.iso-card{position:absolute;left:8px;top:8px;z-index:4;width:340px;max-width:calc(100% - 16px);max-height:calc(100% - 16px);overflow:auto}' +
  '.iso-card:empty{display:none}' +
  '.iso-card .rdesc{box-shadow:3px 3px 0 rgba(60,45,25,.15)}' +
  '.iso-box.small .iso-status{position:static;display:block;max-width:none;margin:0 6px 6px;padding:1px 4px;border:0;background:transparent}' +
  '.iso-box.small .iso-status:empty{display:none}' +
  // せまい時は、絵の中（絵の下）に役割の説明を出さない。一覧の下の説明（index.html の #rdetail）だけにする
  // （絵の下に出すと枠が 300〜400px のびて、押した一覧の行が下へ動いてしまうため。2026-10-10 点検の指摘）
  '.iso-box.small .iso-card{display:none}';
// mount(o)：入れ物 o.el の中に絵を作って動かし始める。失敗した時は例外を投げる（index.html は平面のオフィスのままにする）。
//   o.height＝枠の高さの上限(px)／o.SPRITES・o.SPOTS・o.HABITS・o.CHAT・o.XP＝index.html の絵とことば／
//   o.memberOf(id)・o.seatOf(id)・o.toolWords(tool,hint)・o.cut(s,n)・o.esc(v)＝index.html の関数／
//   o.cardHtml(id)＝絵の中に出す役割の説明（出さない時は ''）／o.onPick(id)＝人が押された時／o.onError(e)＝描けなくなった時
function mount(o){
  if (RUN) return;
  if (!o || !o.el) throw new Error('入れ物がありません');
  H = o; SPRITES = o.SPRITES || {}; HABITS = o.HABITS || {}; CHAT = o.CHAT || []; XP_PER_TASK = o.XP || 20;
  HMAX = Math.max(240, Number(o.height) || 700);
  SPOTS = (o.SPOTS || []).map(function(p, i){ var q = SPOT_POS[i]; return { x: q ? q[0] : p.x, y: q ? q[1] : p.y, emo: p.emo, acts: p.acts, train: p.train, chat: p.chat, by: null }; });
  if (!document.getElementById('iso-css')){ var st = document.createElement('style'); st.id = 'iso-css'; st.textContent = CSS; document.head.appendChild(st); }
  boxEl = o.el; boxEl.className = 'iso-box';
  boxEl.innerHTML = '<div class="iso-world"><canvas aria-hidden="true"></canvas><canvas role="img" aria-label="オフィスの絵。メンバーを押すと役割の説明が出ます"></canvas></div><div class="iso-status"></div><div class="iso-card"></div>';
  worldEl = boxEl.firstChild; floorCv = worldEl.firstChild; stageCv = worldEl.lastChild; statusEl = boxEl.children[1]; cardEl = boxEl.children[2];
  floorG = floorCv.getContext('2d'); stageG = stageCv.getContext('2d');
  if (!floorG || !stageG) throw new Error('Canvas が使えません');
  SIDE_H = null; SEATR = null;   // 止めてから付け直した時も、「作業中 ◯人」の行を出し直す（前に出した文を覚えたままにしない）
  RUN = true; FAILS = 0;
  try { if (layout()){ buildScene(); render(Date.now()); } }
  catch (e){ stop(); throw e; }
  stageCv.addEventListener('click', onClick);
  stageCv.addEventListener('mousemove', onMove);
  document.addEventListener('visibilitychange', onVisible);
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);
  // 入れ物の大きさが変わった時（窓の大きさ・タブの切りかえ）は、次の書きかえで作り直す（frame の中の refit）
  if (window.ResizeObserver){ RO = new ResizeObserver(function(){ kick(); }); RO.observe(boxEl); }
  else window.addEventListener('resize', kick);
  IV = setInterval(function(){ if (!RUN) return; try { behave(); } catch (e){ fail(e); } }, 2000);
  kick();
}
// update(team, state)：名簿と状態を渡す（index.html の render から。state.js が変わった時と、1分ごと）。失敗した時は例外を投げる
function update(team, state){
  if (!RUN || !team) return;
  TEAM = team; STATE = state || {};
  updateOffice();
}
function stop(){
  RUN = false;
  if (RAF){ cancelAnimationFrame(RAF); RAF = 0; }
  if (TMR){ clearTimeout(TMR); TMR = 0; }
  if (IV){ clearInterval(IV); IV = 0; }
  if (RO){ RO.disconnect(); RO = null; } else window.removeEventListener('resize', kick);
  document.removeEventListener('visibilitychange', onVisible);
  if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts);
  Object.keys(OFFICE.chars).forEach(function(id){ OFFICE.chars[id].moveId++; });
  OFFICE = { sig: '', chars: {}, prev: {}, lastPrompt: 0, fx: [], desk: {}, trn: false };
  if (boxEl){ boxEl.innerHTML = ''; boxEl.className = ''; }
  H = null; TEAM = null;
}
// info()：確かめ用。いまの大きさ・人の位置（画面の px）・描いた回数を返す（読むだけ）
function info(){
  var d = V.dpr || 1;
  return { on: RUN, w: V.cssW, h: V.cssH, tile: V.tw / d, sprite: [14 * V.ps / d, 16 * V.ps / d], dpr: d, small: V.small, sel: SEL, working: WORKING.slice(),
    chars: Object.keys(OFFICE.chars).map(function(id){
      var c = OFFICE.chars[id];
      return { id: id, name: c.m.nick || c.m.name, x: c.sx == null ? null : Math.round(c.sx / d), y: c.sy == null ? null : Math.round((c.sy - c.sw / 2) / d),
        seated: !!c.seated, walk: !!c.k.walk, work: !!c.k.work, train: !!c.k.train, say: c.say.t || '', tag: c.tag ? !c.tagHide : null, click: !!c.click };
    }),
    bubbles: BUBS.length, fx: OFFICE.fx.length, moving: anyMoving(), raf: !!RAF, timer: !!TMR,
    draws: PERF.n, msAvg: PERF.n ? Math.round(PERF.sum / PERF.n * 100) / 100 : 0, msMax: Math.round(PERF.max * 100) / 100, objs: PERF.objs, faces: PERF.faces };
}
window.IsoOffice = { mount: mount, update: update, select: select, stop: stop, demoState: demoState, info: info };
})();
