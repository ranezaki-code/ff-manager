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
   ・2階（2026-10-12。店長「同じ部屋のサイズでそのまま二階ができると思ってた。そのぶんすこし壁を高くして1階の視認性も確保する」）：
     1階と同じ形・同じ大きさの部屋を、真上に重ねる（下の F2）。1階の壁は2階の床まで高く、手前の2面は切ってあるので、2階の床の下から1階が見える。
     1階とは「リフト」でつなぐ。席・休み場所が どちらの階かは、index.html の seatOf（up: 1）と、下の SPOT_POS が決める。
     描く順は「1階の物 → 2階の床と壁（先に1回描いておいた絵 f2Cv）→ 2階の物 → 名札・吹き出し」。絵の縦の長さは、2階の高さの分だけ長くなる（layout の EXTRA）。
   ・部屋の入れかえ（2026-10-12。店長「2階に事務所とトレーニング、休憩室等を配置して、1階は本格的な作業部屋にしたい。一階のかべのデザインが不自然なので調整してください」）：
     2階＝トレーニング・休憩室・事務所（店長の机）と、手前の廊下。1階＝作業部屋（メンバー全員の机・チロルの机・サーバーの棚・点検の台・作戦ボード・打ち合わせの机・売場の見本の棚）。
     家具・色・札は、今までの物を置きかえただけ（新しい色は足していない）。待ちの人は、1階と2階の休み場所にいる（階は あまり変えない。リフトは1人ずつ乗る）。
     1階の壁は、床から2階の床まで1枚の面にして、前の低い壁の黒い帯と継ぎ目をなくし、高さ・幅・間かくをそろえた窓と柱型を並べた。
     リフトは左手前のすみへ動かした（右にあった時は、柱とガラスが奥の物の前を横切っていた）。
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
var Y_BACK = 28, Y_FRONT = 70, AISLES = [40, 60];   // 1階の通り道：奥（縦28）・手前（縦70）と、2つをつなぐ縦の通り道（横 40％・60％＝奥の机の列のすき間）
// 2階。1階と同じ形・同じ大きさ（横 0〜200・縦 14〜100）を、真上に重ねる。2階＝トレーニング・休憩室・事務所と廊下、1階＝作業部屋。
// z＝2階の床の高さ（＝1階の壁の高さ）。wh＝2階の壁の高さ。
//   2階に部屋が来たので、wh を 14 → 22（1階にあった時と同じ。窓・壁の札・コーヒーマシンが入る高さ）にし、その分 z を 101 → 93 にした。
//   z＋wh が前と同じなので、絵の縦の長さ・マスの大きさ・人の絵の大きさ・枠の高さは変わらない。
//   z を小さくすると、1階の奥から順に、2階の床のへりに隠れる：93 なら、奥の壁ぎわの棚（高さ16）と、その前に立つ人が隠れない。88 より小さいと、奥に立つ人の頭が隠れる。
// glass＝2階の床の透け具合（0＝透けない。0.5 なら半分透けて、下の1階が見える）。
// aisle＝2階の廊下（縦）。リフト（1階⇔2階）：横 lx（％）・乗る所 ly・乗り口 lin（縦）。climb＝上り下りの秒数。
//   リフトは左手前のすみ（机の列の左どなり）。ここなら、柱とガラスが、奥の机や人の前を横切らない。
var F2 = { z: 93, wh: 22, glass: 0, aisle: 82, lx: 6, ly: 91, lin: 82, climb: 2.6 };
var EXTRA = (F2.z + F2.wh - 22) * 0.055;   // 2階の分、絵が縦に長くなる量（マスの幅を1として）。1階だけの時の壁の高さ 22 との差
var LIFT = { res: [], seq: 0, free: 0 };   // リフトの順番（1人ずつ乗る）。res＝順番の一覧（walkTo が取り、liftPlan が並べる）。free＝今ある順番が ぜんぶ終わる時刻
// 休み場所の位置（12か所。並びは index.html の SPOTS と同じ。ことば＝acts・emo などは index.html の物を使う）。[横％, 縦, 階（1＝2階）]
// 1階（作業部屋）：点検の台の前／作戦ボードの前／売場の見本の棚の前×2／通路（そうじ）／入口のそば
// 2階：休憩室のコーヒーマシンの前・丸テーブルのいす×2／トレーニングのランニングマシン・ダンベル棚の前・マット
// 斜めにすると「奥の人の名札」が「手前の人の顔」に重なるので、奥の列の机に座る人の すぐ後ろ〜左ななめ後ろ（横で 26 左 〜 2 右）には置いていない
var SPOT_POS = [[35, 26], [55, 26], [80, 26], [93, 26], [45, 22, 1], [48, 52.5, 1], [60, 52.5, 1], [7.5, 35, 1], [18.25, 27, 1], [28.25, 54, 1], [69, 66], [93, 68]];
// 自主点検（週1回のふり返り）で集まる場所＝2階のトレーニングの手前。床の上で 横7.5％ × 縦15.5 の格子（5人×2列。2列目は1％ずらす）。
// 画面上では、どの2人も絵1つ分ほど はなれる。11人目から先は、手前の廊下に並ぶ
function trainSpot(k){
  var r = Math.floor(k / 5), i = k % 5;
  return r < 2 ? { x: 4.75 + i * 7.5 + r, y: 52 + r * 15.5, up: 1 } : { x: 44 + (k - 10) * 7.5, y: 86, up: 1 };
}

// ================= 斜め見下ろしの描き方 =================
// 部屋は平面のオフィスと同じ方眼（横200×縦100。床は縦14〜100、縦0〜14は奥の壁）。10 が床の1マス。
// 画面へは 横=(x−y)・縦=(x+y)/2−高さ で置く（ひし形のマス）。面は「上・左手前・右手前」の3つに明暗を付ける。
// 字：見本と同じ見た目になるよう MS ゴシックを先に書く。MS ゴシックの無い端末（スマホなど）では、ダッシュボードと同じ DotGothic16 になる
var FONT = '"MS Gothic","DotGothic16","Yu Gothic UI",monospace';
var INK = '#3d4248';
var V = { W: 0, H: 0, dpr: 1, tw: 0, th: 0, zs: 0, ox: 0, oy: 0, ps: 2, lw: 1, F: 13, fs: 13, small: false, fine: true, gen: 0, rw: 0, rdpr: 0, cssW: 0, cssH: 0 };
var WT = 2.4;   // 壁の厚み
var boxEl = null, worldEl = null, floorCv = null, stageCv = null, floorG = null, stageG = null, statusEl = null, cardEl = null;
var f2Cv = null, f2G = null;   // 2階の動かない物（壁・床の線・壁ぎわの物）を先に1回描いておく絵。画面には出さず、render が1階の物の後に重ねる
var PERF = { n: 0, sum: 0, max: 0, last: 0, objs: 0, faces: 0 }, FACES = 0;

var ZB = 0;   // 2階の物を描いている間だけ F2.z（床の高さ）。それ以外は 0。lift() と drawStatic2 が出し入れする
function P(x, y, z){ var u = x / 10, v = (y - 14) / 10; return [V.ox + (u - v) * V.tw / 2, V.oy + (u + v) * V.th / 2 - ((z || 0) + ZB) * V.zs]; }
function lift(fn){ return function(g, now){ ZB = F2.z; try { fn(g, now); } finally { ZB = 0; } }; }   // 2階の物の描き方を包む
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
// 部屋ぜんたい（壁・床の厚みこみ）は、マスの幅を 1 として 横 14.6 × 縦 TALL（1階だけなら 8.84。2階の分 EXTRA だけ長い）。
// ・広い時：マスは「幅」と「HMAX」の小さい方で決まる。枠の高さは、絵が入る高さ（上限 HMAX）。
//   2階ができて絵が縦に長くなったので、パソコンでは「HMAX で決まる」事が多い（HMAX 870・F2.z＋F2.wh＝115 なら マス 60px・人の絵 42×48px）。
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
  var padX = 12, padT = 14, padB = 14, cssH, TALL = 8.84 + EXTRA;
  var tw = even(Math.min((W - 2 * padX) / 14.6, (HMAX - padT - padB) / TALL)), small = tw < 44;
  if (small){
    padX = 4; padT = 10; padB = 8;
    tw = even(Math.min((W - 2 * padX) / 14.6, (HMAX - padT - padB) / TALL));
    cssH = padT + Math.ceil(TALL * tw) + padB;
  } else cssH = Math.max(padT + Math.ceil(TALL * tw) + padB, Math.min(HMAX, Math.round(W * 0.66)));
  var dpr = Math.min(small ? 3 : 2, Math.max(1, raw));   // 小さな絵は、画素3倍のスマホでもくっきり描く
  var freeW = Math.max(0, W - 2 * padX - 14.6 * tw), freeH = Math.max(0, cssH - padT - padB - TALL * tw);
  V.dpr = dpr; V.W = Math.round(W * dpr); V.H = Math.round(cssH * dpr); V.small = small; V.fine = tw >= 40;
  V.cssW = W; V.cssH = cssH;
  V.tw = tw * dpr; V.th = V.tw / 2; V.zs = V.tw * 0.055;
  V.ox = Math.round((padX + freeW / 2 + 4.45 * tw) * dpr);
  V.oy = Math.round((padT + freeH * 0.5 + (1.34 + EXTRA) * tw) * dpr);   // 2階の分だけ、1階を下へ下げる
  V.ps = Math.max(1, Math.round(Math.max(tw / 18, 1.9) * dpr));   // ドット絵の1マス（整数にして、つぶれを防ぐ）
  V.lw = Math.max(1, Math.round(tw / 44 * dpr));
  V.fs = tw < 30 ? 11 : 13;                    // 字の大きさ（px）。とても小さな絵（スマホの縦）では 11px
  V.F = Math.round(V.fs * dpr);
  V.gen++;
  boxEl.className = 'iso-box' + (small ? ' small' : '');
  worldEl.style.width = W + 'px'; worldEl.style.height = cssH + 'px';
  floorCv.style.width = stageCv.style.width = W + 'px'; floorCv.style.height = stageCv.style.height = cssH + 'px';
  floorCv.width = stageCv.width = V.W; floorCv.height = stageCv.height = V.H;
  f2Cv.width = V.W; f2Cv.height = V.H;
  drawStatic(floorG);
  drawStatic2(f2G);
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

// 壁の札（部屋の名前）。left＝左の壁（手前から奥へ読む）、それ以外は奥の壁。at＝札の始まり（左の壁は縦、奥の壁は横）、z＝札のまん中の高さ
function wallSign(g, left, at, z, t){
  var u = V.tw / 20, wU, p;
  g.font = V.F + 'px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle';
  wU = g.measureText(t).width / u + 1.6;
  if (left){ faceX(g, 0, at, at - wU, z - 2.4, z + 2.4, '#fbfbfa', true); p = P(0, at - 0.8, z); g.save(); g.setTransform(1, -0.5, 0, 1, R(p[0]), R(p[1])); }
  else { faceY(g, 14, at, at + wU, z - 2.4, z + 2.4, '#fbfbfa', true); p = P(at + 0.8, 14, z); g.save(); g.setTransform(1, 0.5, 0, 1, R(p[0]), R(p[1])); }
  g.fillStyle = '#6f757d'; g.fillText(t, 0, V.dpr); g.restore();
}
// ---- 動かない物（床・壁・壁ぎわの棚）。1回だけ描いて下の Canvas に置く ----
// 1階＝作業部屋。奥の壁ぎわ（左から）：サーバーの棚3つ・点検の台・作戦ボード・売場の見本の棚
function drawStatic(g){
  var i, j, k, x0, z, hh, fine = V.fine, top = F2.z, soft = '#a7abb1';
  var cols = ['#b9bdc3','#8d9299','#dcdee1','#6f757d','#eeeeec','#a7abb1','#c9ccd1','#7d848c'];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, V.W, V.H);
  g.save(); if (V.lw % 2) g.translate(0.5, 0.5);
  g.lineWidth = V.lw; g.lineJoin = 'round';
  // 部屋の下の影と、床の厚み
  g.save(); g.translate(0, R(V.tw * 0.1)); quad(g, [P(-WT,14-WT,-4), P(200,14-WT,-4), P(200,100,-4), P(-WT,100,-4)], 'rgba(60,45,25,.14)'); g.restore();
  faceY(g, 100, -WT, 200, -4, 0, '#b9bdc3', true); faceX(g, 200, 14-WT, 100, -4, 0, '#a2a7ad', true);
  // 作業部屋の床（ぜんぶカーペット。前の「作業スペース」と同じ色と線）
  faceTop(g, 0, 14, 200, 100, 0, '#e3e4e7');
  for (i = 1; i < 20; i++) seg(g, P(i*10, 14.4), P(i*10, 100), '#d6d8dc');
  // 打ち合わせの所の敷物・入口のマット（床に平らな物）
  faceTop(g, 138, 33, 170, 59, 0, '#d6d8dc', fine);
  faceTop(g, 186, 56, 197, 76, 0, '#5a6068', true);
  for (k = 0; k < 4; k++) seg(g, P(187.9 + k*2.4, 57.5), P(187.9 + k*2.4, 74.5), '#7d848c');
  quad(g, [P(0,14,0), P(200,14,0), P(200,100,0), P(0,100,0)], null, true);

  // 壁（奥＝右上へ伸びる面、左＝左下へ伸びる面）。床から2階の床まで、1枚の面（途中に帯や継ぎ目を入れない）
  faceX(g, 0, 14, 100, 0, top, '#e9eaec'); faceX(g, 0, 14, 100, 0, 1.6, '#c4c7cc'); faceX(g, 0, 14, 100, 0, top, null, true);
  faceY(g, 14, 0, 200, 0, top, '#fbfbfa'); faceY(g, 14, 0, 200, 0, 1.6, '#d4d6da'); faceY(g, 14, 0, 200, 0, top, null, true);
  faceY(g, 100, -WT, 0, -4, top, '#d4d6da', true); faceX(g, 200, 14 - WT, 14, -4, top, '#b4b8be', true);   // 壁の切り口（左手前・右奥）
  // 柱型（壁の付け柱。床から2階の床の下まで）。左の壁は 21.5 ごと、奥の壁は 20 ごと。2階の床を、壁ぎわで ささえて見せる
  [35.5, 57, 78.5].forEach(function(y){ box(g, 0, y - 0.8, 1.2, y + 0.8, 0, top - 4, ['#eceded','#dcdee1','#c4c7cc'], soft); });
  for (i = 1; i < 10; i++) box(g, i*20 - 0.8, 14, i*20 + 0.8, 15.2, 0, top - 4, ['#eceded','#eeeeec','#dcdee1'], soft);
  // 高い窓：左の壁に4つ、奥の壁の右に4つ。下はし・上はし・幅・間かくを、2つの壁でそろえる（柱型と柱型のまん中に1つずつ）。
  // 2階の床の向こうになる所は、後から2階の絵が上に重なって隠れる（奥の壁の左の6つは、ぜんぶ隠れるので描かない）
  var W0 = 24, W1 = 68, WM = 46;
  [18.25, 39.75, 61.25, 82.75].forEach(function(y){
    faceX(g, 0, y, y + 13, W0, W1, '#fbfbfa', true);
    faceX(g, 0, y + 1, y + 12, W0 + 1, WM - 0.5, '#d5dde3'); faceX(g, 0, y + 1, y + 12, WM + 0.5, W1 - 1, '#d5dde3');
    faceX(g, 0, y + 2.6, y + 5.2, 60, 61.2, '#ffffff'); faceX(g, 0, y + 6, y + 9.4, 52, 53.2, '#ffffff'); faceX(g, 0, y + 3.4, y + 6.4, 36, 37.2, '#ffffff');
  });
  [123.5, 143.5, 163.5, 183.5].forEach(function(x){
    faceY(g, 14, x, x + 13, W0, W1, '#fbfbfa', true);
    faceY(g, 14, x + 1, x + 12, W0 + 1, WM - 0.5, '#d5dde3'); faceY(g, 14, x + 1, x + 12, WM + 0.5, W1 - 1, '#d5dde3');
    faceY(g, 14, x + 3.6, x + 7, 60, 61.2, '#ffffff'); faceY(g, 14, x + 7.8, x + 10.4, 52, 53.2, '#ffffff'); faceY(g, 14, x + 6.6, x + 9.6, 36, 37.2, '#ffffff');
  });
  // 窓の上の細い線（2つの壁をひと続きに回る）
  seg(g, P(0, 100, W1 + 4), P(0, 14, W1 + 4), '#c4c7cc'); seg(g, P(0, 14, W1 + 4), P(200, 14, W1 + 4), '#c9ccd1');
  // 部屋の名前（壁の札。広い画面だけ。小さな画面では絵がこみ合うので出さない）
  if (!V.small){ wallSign(g, true, 62, 16.4, '作業部屋'); wallSign(g, false, 148.5, 19.7, '売場の見本'); }

  // 奥の壁ぎわ：サーバーの棚（3つ。小さな明かり）
  for (i = 0; i < 3; i++){
    x0 = 6 + i * 12;
    shadow(g, x0, 14.4, x0 + 10, 18.4);
    box(g, x0, 14.4, x0 + 10, 18.4, 0, 11.4, ['#4b5057','#3a3f45','#2f3338'], true);
    for (k = 0; k < 3; k++){
      faceY(g, 18.4, x0 + 1.2, x0 + 8.8, 8.4 - k * 3.2, 10 - k * 3.2, '#5a6068');
      faceY(g, 18.4, x0 + 2, x0 + 3.1, 8.9 - k * 3.2, 9.5 - k * 3.2, (i + k) % 3 === 1 ? '#9af0c0' : '#c9ccd1');
      if (fine) seg(g, P(x0 + 4.2, 18.4, 9.2 - k * 3.2), P(x0 + 8, 18.4, 9.2 - k * 3.2), '#8d9299');
    }
  }
  // 奥の壁ぎわ：点検の台（ためす端末を並べる長い机）
  shadow(g, 46, 14.4, 76, 20);
  box(g, 46, 14.4, 76, 20, 0, 6, ['#eceded','#c9ccd1','#b4b8be'], true);
  for (k = 0; k < 4; k++){ box(g, 48.6 + k * 7, 15.4, 53 + k * 7, 16.4, 6, 10, ['#4b5057','#3a3f45','#2f3338'], fine); faceY(g, 16.4, 49.1 + k * 7, 52.5 + k * 7, 6.8, 9.4, k === 2 ? '#9af0c0' : '#aeb6bf'); faceTop(g, 49 + k * 7, 17.6, 52.2 + k * 7, 19.2, 6, '#fbfbfa', fine); }
  // 奥の壁ぎわ：作戦ボード（チロルの机の後ろ。足つきの白い板に、チェックの行）
  shadow(g, 84, 18.6, 116, 19.8);
  box(g, 85, 18.8, 86.2, 19.8, 0, 5, '#8d9299', fine); box(g, 113.8, 18.8, 115, 19.8, 0, 5, '#8d9299', fine);
  box(g, 84, 18.8, 116, 19.8, 5, 15.4, ['#dcdee1','#fbfbfa','#dcdee1'], true);
  for (k = 0; k < 3; k++){
    z = 13 - k * 2.6;
    faceY(g, 19.8, 86, 87.8, z - 0.7, z + 0.7, k < 2 ? '#8d9299' : '#fbfbfa', fine);
    seg(g, P(89.6, 19.8, z), P(k === 1 ? 101 : 106, 19.8, z), k ? '#a7abb1' : '#6f757d');
  }
  seg(g, P(108.5, 19.8, 12.6), P(113.5, 19.8, 12.6), '#c4c7cc'); seg(g, P(108.5, 19.8, 10), P(112, 19.8, 10), '#c4c7cc');
  faceY(g, 19.8, 84, 116, 4.2, 5, '#b9bdc3', true);
  // 奥の壁ぎわ（右）：売場の見本の棚（店にあった商品棚を1本だけ残した。POP や並べ方を ためす所）
  shadow(g, 146, 14, 196, 20);
  box(g, 146, 14, 196, 20, 0, 16.4, ['#e6e7e9','#d4d6da','#c0c4c9'], true);
  faceY(g, 20, 146, 196, 14.8, 16.4, '#6f757d');
  for (j = 0; j < 3; j++){
    z = 10.6 - j*4.6;
    for (i = 0; i < 15; i++){ hh = 2.2 + ((i*7 + j*3) % 3) * 0.5; faceY(g, 20, 147.2 + i*3.2, 149.6 + i*3.2, z, z + hh, cols[(i*2 + j*3) % cols.length]); }
    faceY(g, 20, 146.4, 195.6, z - 0.8, z, '#fbfbfa', fine);
  }
  faceY(g, 20, 146, 196, 0, 16.4, null, true);
  g.restore();
}
// 2階の動かない物（部屋の床・壁・窓と札・壁ぎわの物）。1階と同じ形を、F2.z だけ上に描く。
// 部屋は左から トレーニング（横 0〜76）・休憩室（78〜138）・事務所（140〜200）。手前（縦 76〜100）は廊下。床・家具・札は、1階にあった時と同じ物。
// 床の地の色（廊下のカーペット）は render が塗る（F2.glass で透かせるように、ここには入れない）。画面に出さない絵 f2Cv に1回描き、render が1階の物の後に重ねる
function drawStatic2(g){
  var wh = F2.wh, i, j, k, fine = V.fine, LX = F2.lx * 2;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, V.W, V.H);
  g.save(); if (V.lw % 2) g.translate(0.5, 0.5);
  g.lineWidth = V.lw; g.lineJoin = 'round';
  ZB = F2.z;
  try {
    // 床の厚み（手前の2面）
    faceY(g, 100, 0, 200, -4, 0, '#b9bdc3', true); faceX(g, 200, 14, 100, -4, 0, '#a2a7ad', true);
    // トレーニング（ゴムの床）
    faceTop(g, 0, 14, 76, 76, 0, '#d6d8dc');
    for (i = 0; i < 11; i++) for (j = 0; j < 9; j++) if ((i + j) % 2) faceTop(g, i*7, 14 + j*7.1, Math.min(76, i*7 + 7), Math.min(76, 21.1 + j*7.1), 0, '#cfd1d6');
    // 休憩室
    faceTop(g, 78, 14, 138, 76, 0, '#ebe9e5');
    for (j = 1; j < 15; j++) seg(g, P(78, 14.4 + j*4.2), P(138, 14.4 + j*4.2), '#dddad4');
    // 事務所
    faceTop(g, 140, 14, 200, 76, 0, '#e1e2e5');
    for (j = 0; j < 15; j++) for (i = 0; i < 12; i++) if ((i + j) % 2) faceTop(g, 140 + i*5, 14.4 + j*4.2, 145 + i*5, Math.min(76, 18.6 + j*4.2), 0, '#dbdcdf');
    // 廊下（カーペットの線）と、リフトの乗り場の印
    for (i = 1; i < 20; i++) seg(g, P(i*10, 76.4), P(i*10, 100), '#d6d8dc');
    seg(g, P(0, 76), P(200, 76), '#b9bdc3');
    faceTop(g, LX - 7, F2.ly - 5, LX + 7, F2.ly + 6.6, 0, '#d4d6da', true);
    // ストレッチのマット（床に平らな物）
    faceTop(g, 50, 50, 63, 58, 0, '#a7abb1', true);
    seg(g, P(51.2, 51.3), P(61.8, 51.3), '#8d9299'); seg(g, P(51.2, 56.7), P(61.8, 56.7), '#8d9299');
    quad(g, [P(0,14,0), P(200,14,0), P(200,100,0), P(0,100,0)], null, true);
    // 壁（左と奥。1階の壁の真上。上はしに黒い帯）
    faceX(g, 0, 14, 100, 0, wh, '#e9eaec'); faceX(g, 0, 14, 100, wh - 2.6, wh, '#33383d'); faceX(g, 0, 14, 100, 0, 1.6, '#c4c7cc');
    faceX(g, 0, 14, 100, 0, wh, null, true);
    faceY(g, 14, 0, 200, 0, wh, '#fbfbfa'); faceY(g, 14, 0, 200, wh - 2.6, wh, '#3a3f45'); faceY(g, 14, 0, 200, wh - 3.2, wh - 2.6, '#c9ccd1'); faceY(g, 14, 0, 200, 0, 1.6, '#d4d6da');
    faceY(g, 14, 0, 200, 0, wh, null, true);
    faceY(g, 100, -WT, 0, -4, wh, '#d4d6da', true); faceX(g, 200, 14 - WT, 14, -4, wh, '#b4b8be', true);
    quad(g, [P(-WT,14-WT,wh), P(200,14-WT,wh), P(200,14,wh), P(0,14,wh), P(0,100,wh), P(-WT,100,wh)], '#c9ccd1', true);
    // 壁の飾り（1階にあった時と同じ物）：左の壁＝窓と鏡（トレーニング）。奥の壁＝窓（トレーニング）・窓（休憩室）・ホワイトボードと窓（事務所）
    faceX(g, 0, 20, 38, 8.5, 18.5, '#fbfbfa', true); faceX(g, 0, 21, 28.5, 9.4, 17.6, '#d5dde3'); faceX(g, 0, 29.5, 37, 9.4, 17.6, '#d5dde3');
    faceX(g, 0, 22.5, 25, 14.5, 15.5, '#ffffff'); faceX(g, 0, 31, 34, 12, 13, '#ffffff');
    faceX(g, 0, 44, 64, 3, 13.6, '#dfe5e9', true);
    quad(g, [P(0,47,13.6), P(0,50,13.6), P(0,55,3), P(0,52,3)], 'rgba(255,255,255,.55)');
    [52, 118].forEach(function(x){
      faceY(g, 14, x, x + 18, 8.5, 18.5, '#fbfbfa', true); faceY(g, 14, x + 1, x + 8.5, 9.4, 17.6, '#d5dde3'); faceY(g, 14, x + 9.5, x + 17, 9.4, 17.6, '#d5dde3');
      faceY(g, 14, x + 2.5, x + 5, 14.5, 15.5, '#ffffff'); faceY(g, 14, x + 11, x + 14, 12, 13, '#ffffff');
    });
    faceY(g, 14, 161, 173.5, 8.5, 18, '#fbfbfa', true);
    seg(g, P(162.4,14,16), P(168,14,16), '#6f757d'); seg(g, P(169.4,14,16), P(172,14,16), '#a7abb1'); seg(g, P(162.4,14,13.6), P(171,14,13.6), '#8d9299'); seg(g, P(162.4,14,11.2), P(169,14,11.2), '#c4c7cc');
    faceY(g, 14, 161, 173.5, 7.6, 8.5, '#b9bdc3', true);
    faceY(g, 14, 175, 185.6, 8.5, 18.5, '#fbfbfa', true); faceY(g, 14, 175.8, 180, 9.4, 17.6, '#d5dde3'); faceY(g, 14, 180.6, 184.8, 9.4, 17.6, '#d5dde3');
    faceY(g, 14, 176.5, 178.6, 14.6, 15.5, '#ffffff'); faceY(g, 14, 181.8, 184, 12, 12.9, '#ffffff');
    // 部屋の名前（壁の札。広い画面だけ）
    if (!V.small){ wallSign(g, false, 94.4, 15, '休憩室'); wallSign(g, false, 186.6, 15.6, '事務所'); wallSign(g, true, 70, 16.4, 'トレーニング'); }
    // 休憩室のカウンターとコーヒーマシン
    shadow(g, 81, 14, 115, 20);
    box(g, 81, 14, 115, 20, 0, 8, ['#a7abb1','#8d9299','#7d848c'], true);
    box(g, 84, 14.6, 93, 19.4, 8, 17.4, ['#4b5057','#3a3f45','#2f3338'], true);
    faceY(g, 19.4, 85.5, 91.5, 14.2, 16.2, '#6f757d'); faceY(g, 19.4, 86.7, 90.3, 9, 12.4, '#22262a'); faceY(g, 19.4, 87.5, 89.5, 9, 10.4, '#fbfbfa');
    for (k = 0; k < 3; k++){ box(g, 97 + k*3.4, 15.4, 99.4 + k*3.4, 18, 8, 11.4, ['#6f757d','#fbfbfa','#dcdee1'], fine); }
    box(g, 109.4, 15, 113.6, 19, 8, 12.6, ['#e6e7e9','#d4d6da','#c0c4c9'], true);
    // 書類棚（事務所）
    shadow(g, 190, 15, 198, 26.5);
    box(g, 190, 15, 198, 26.5, 0, 11, ['#dcdee1','#c4c7cc','#b0b4ba'], true);
    for (j = 0; j < 3; j++){
      if (j) seg(g, P(190, 26.5, j*3.67), P(198, 26.5, j*3.67), INK);
      faceY(g, 26.5, 193, 195, 1.6 + j*3.67, 2.2 + j*3.67, '#6f757d');
    }
  } finally { ZB = 0; }
  g.restore();
}

// ---- 動く物と重なる家具（毎回、奥から手前の順に並べて描く） ----
var SCENE = [], SCENE2 = [], RIDERS = 0;   // 1階の物・2階の物・いまリフトに乗っている人数
function glow(color, now, ms){ return Math.floor(now / ms) % 2 ? mix(color, 255, 0.32) : color; }   // 光の切りかえは 0.5秒・1秒きざみ（render の tq の区切りに合わせる）
function buildScene(){
  var L = SCENE = [], L2 = SCENE2 = [], thin = V.fine ? true : null;
  // up を付けた物は2階の物：2階の一覧（SCENE2）に入れ、描く時に F2.z だけ持ち上げる
  function add(x0, y0, x1, y1, draw, up){ (up ? L2 : L).push({ x0: x0, y0: y0, x1: x1, y1: y1, draw: up ? lift(draw) : draw }); }
  function stool(x, y, up){ add(x - 2.4, y - 2.4, x + 2.4, y + 2.4, function(g){ box(g, x - 2.2, y - 2.2, x + 2.2, y + 2.2, 0, 3.2, ['#8d9299','#6f757d','#5a6068'], true); }, up); }
  // 丸テーブル（休憩室の物。1階の打ち合わせの机も同じ形）
  function roundTable(cx, cy, up){
    add(cx - 5.6, cy - 5.6, cx + 5.6, cy + 5.6, function(g){
      isoEllipse(g, cx + 0.8, cy + 0.8, 0, 6, 'rgba(30,34,40,.13)');
      box(g, cx - 1, cy - 1, cx + 1, cy + 1, 0, 5.2, '#8d9299');
      isoEllipse(g, cx, cy, 5.2, 5.6, '#b9bdc3', true); isoEllipse(g, cx, cy, 6, 5.6, '#dcdee1', true); isoEllipse(g, cx - 1, cy - 1, 6, 2.6, '#eeeeec');
      box(g, cx - 0.6, cy - 0.5, cx + 1, cy + 0.9, 6, 7.6, ['#fbfbfa','#eeeeec','#dcdee1'], thin);
    }, up);
  }
  function plant(cx, cy, up){
    add(cx - 2.4, cy - 2.4, cx + 2.4, cy + 2.4, function(g){
      var u = V.tw / 20, c = P(cx, cy, 8.4);
      isoEllipse(g, cx + 0.8, cy + 0.8, 0, 3.4, 'rgba(30,34,40,.13)');
      box(g, cx - 2, cy - 2, cx + 2, cy + 2, 0, 4.6, ['#a7abb1','#8d9299','#7d848c'], true);
      disc(g, R(c[0]), R(c[1]), 4.4 * u, '#7f9686', true); disc(g, R(c[0] - 2.2 * u), R(c[1] + 1.9 * u), 2.6 * u, '#6c8373'); disc(g, R(c[0] + 1.4 * u), R(c[1] - 1.6 * u), 1.6 * u, '#9db3a4');
    }, up);
  }

  // ===== 1階：作業部屋 =====
  // 打ち合わせの丸テーブルと いす（奥の右。おたすけ＝席の無い応援は、ここに座る。手前の角の柱の後ろにならない所）
  roundTable(154, 46);
  [[142, 52.5], [166, 52.5], [154, 37]].forEach(function(s){ stool(s[0], s[1]); });
  // 道具の棚（左の壁ぎわ）
  add(2, 22, 9, 48, function(g){
    var k;
    shadow(g, 2, 22, 9, 48);
    box(g, 2, 22, 9, 48, 0, 7, ['#dcdee1','#c4c7cc','#b0b4ba'], true);
    seg(g, P(9, 22, 3.5), P(9, 48, 3.5), INK);
    for (k = 0; k < 3; k++) box(g, 3.4, 25 + k * 8, 7.4, 29 + k * 8, 7, 9 + (k % 2), k === 1 ? '#6f757d' : '#a7abb1', thin);
  });
  // 植木（奥の壁ぎわ・手前の右）
  plant(131, 21); plant(180.5, 92);
  // コピー機・ごみ箱（机の列の右どなり）
  add(164, 84, 174, 96, function(g){
    shadow(g, 164, 84, 174, 96);
    box(g, 164, 84, 174, 96, 0, 12, ['#e6e7e9','#d4d6da','#c0c4c9'], true);
    faceTop(g, 165, 85, 173, 91.6, 12, '#3a3f45'); faceTop(g, 170.9, 92.8, 172.7, 95, 12, '#c9ccd1');
    seg(g, P(174, 84, 7.6), P(174, 96, 7.6), INK); seg(g, P(174, 84, 3.4), P(174, 96, 3.4), INK);
    faceX(g, 174, 86, 94, 5.1, 5.9, '#fbfbfa', thin);
  });
  add(187, 89, 196.6, 95, function(g){
    shadow(g, 187, 89, 196.6, 95);
    box(g, 187, 89, 191.4, 95, 0, 6, ['#6f757d','#a7abb1','#8d9299'], true);
    box(g, 192.2, 89, 196.6, 95, 0, 6, ['#4b5057','#6f757d','#5a6068'], true);
  });
  // 入口（右手前のへりの自動ドア。ガラスなので向こうが透ける）
  add(199, 54, 201, 78, function(g){
    faceX(g, 200, 55, 77, 0, 14, 'rgba(213,221,227,.32)', thin);
    seg(g, P(200, 66, 0), P(200, 66, 14), INK);
    box(g, 199.2, 54, 200.2, 55, 0, 15, '#8d9299', thin); box(g, 199.2, 77, 200.2, 78, 0, 15, '#8d9299', thin);
    box(g, 199.2, 54, 200.2, 78, 14, 15.2, '#8d9299', thin);
  });
  // 席：店長席（2階の事務所）・チロルの席（奥のまん中。少し広い机）・メンバーの席。人は机の向こう側に座る。モニターは作業中に点滅（メンバーは本人の色）
  function desk(id, color, depth, wide){
    var s = seatOf(id); if (!s) return;
    var X = s.x * 2, Y = s.y, x0 = X - 7 - (wide || 0), x1 = X + 9 + (wide || 0), y0 = Y + 3.5, y1 = y0 + depth, h = 6;
    stool(X, Y, s.up);
    add(x0, y0, x1, y1, function(g, now){
      var on = OFFICE.desk[id], mc = id === 'owner' ? glow('#aeb6bf', now, 1000) : id === 'boss' ? (on ? glow('#9af0c0', now, 500) : '#6f7a83') : (on ? glow(color, now, 500) : '#3a3f45');
      shadow(g, x0, y0, x1, y1);
      box(g, x0, y0, x1, y1, 0, h, ['#eceded','#c9ccd1','#b4b8be'], true);
      faceY(g, y1, x0 + 2.5, x1 - 2.5, 1.8, 3.8, color);
      faceTop(g, X + 1, y0 + 1.2, X + 5, y0 + 4.2, h, '#fbfbfa', thin);
      box(g, X + 6.2, y1 - 2.2, X + 7.8, y1 - 0.8, h, h + 1.8, color, thin);
      box(g, x0 + 1.5, y0 + 2.2, x0 + 2.3, y0 + 3.2, h, h + 1.4, '#22262a');
      box(g, x0 + 1.2, y0 + 0.6, x0 + 2.5, y0 + 4.6, h + 1.2, h + 7, ['#4b5057','#3a3f45', mc], true);
    }, s.up);
  }
  // リフト（1階⇔2階。机の列の左どなり）。奥の2本の柱と横木・ガラスの背板。人は柱の手前の台に乗って上り下りする
  var LX = F2.lx * 2, lx0 = LX - 8, lx1 = LX + 8, ly0 = F2.ly - 7, ly1 = F2.ly + 6.6;   // 横 4〜20・縦 84〜97.6
  add(lx0, ly0, lx1, ly0 + 1.2, function(g){
    var k;
    faceY(g, ly0 + 1.2, lx0 + 1.2, lx1 - 1.2, 0, F2.z - 4, 'rgba(213,221,227,.22)', thin);
    for (k = 12; k < F2.z - 6; k += 12) faceY(g, ly0 + 1.2, lx0 + 1.2, lx1 - 1.2, k, k + 0.8, '#a7abb1');
    box(g, lx0, ly0, lx0 + 1.2, ly0 + 1.2, 0, F2.z - 4, '#8d9299', thin); box(g, lx1 - 1.2, ly0, lx1, ly0 + 1.2, 0, F2.z - 4, '#8d9299', thin);
  });
  add(lx0 + 1, ly0 + 2, lx1 - 1, ly1, function(g){   // 1階の乗り場。だれも乗っていない時は、ここに台がある
    faceTop(g, lx0 + 1, ly0 + 2, lx1 - 1, ly1, 0, '#d4d6da', true);
    if (!RIDERS) box(g, lx0 + 1.6, ly0 + 2.6, lx1 - 1.6, ly1 - 0.6, 0, 1.2, ['#f1f2f3','#c9ccd1','#b4b8be'], true);
  });
  // 2階の床の手前の角をささえる柱（宙に浮いて見えないように）
  add(198.6, 98.6, 200, 100, function(g){ box(g, 198.6, 98.6, 200, 100, 0, F2.z - 4, ['#dcdee1','#c4c7cc','#b0b4ba'], true); });

  // ===== 2階：トレーニング・休憩室・事務所と廊下 =====
  add(lx0, ly0, lx1, ly0 + 1.2, function(g){   // リフトの柱の上の部分と、はり
    faceY(g, ly0 + 1.2, lx0 + 1.2, lx1 - 1.2, 0, 13, 'rgba(213,221,227,.32)', thin);
    box(g, lx0, ly0, lx0 + 1.2, ly0 + 1.2, 0, 13, '#8d9299', thin); box(g, lx1 - 1.2, ly0, lx1, ly0 + 1.2, 0, 13, '#8d9299', thin);
    box(g, lx0, ly0, lx1, ly0 + 1.2, 13, 14.6, ['#a7abb1','#8d9299','#7d848c'], true);
  }, 1);
  // 手前の2面の手すり
  add(0, 99.2, 199.2, 100, function(g){
    var a;
    for (a = 0; a <= 14; a++) box(g, a * 14.17, 99.2, a * 14.17 + 0.8, 100, 0, 3, '#b0b4ba', thin);
    box(g, 0, 99.2, 199.2, 100, 3, 3.7, ['#dcdee1','#c4c7cc','#b0b4ba'], true);
  }, 1);
  add(199.2, 14, 200, 100, function(g){
    var a;
    for (a = 0; a <= 6; a++) box(g, 199.2, 14 + a * 14.2, 200, 14.8 + a * 14.2, 0, 3, '#b0b4ba', thin);
    box(g, 199.2, 14, 200, 100, 3, 3.7, ['#dcdee1','#c4c7cc','#b0b4ba'], true);
  }, 1);
  // 低い仕切り（部屋と部屋の間・部屋の手前のはし）。背を低くして、奥の人が隠れないように。手前は広く空けて、廊下から出入りする
  [[76,14,78,76],[138,14,140,76],[78,74,86,76],[128,74,138,76],[140,74,152,76],[190,74,199.2,76]].forEach(function(r){
    add(r[0], r[1], r[2], r[3], function(g){ box(g, r[0], r[1], r[2], r[3], 0, 3.6, ['#dcdee1','#c4c7cc','#b0b4ba'], true); }, 1);
  });
  // トレーニング：ダンベル棚・ランニングマシン
  add(26, 15.5, 47, 22.1, function(g){
    var k;
    shadow(g, 26, 15.5, 47, 22.1);
    box(g, 26, 15.5, 47, 22.1, 0, 6.6, ['#c9ccd1','#b9bdc3','#a7abb1'], true);
    seg(g, P(26, 22.1, 3.3), P(47, 22.1, 3.3), INK);
    for (k = 0; k < 4; k++){
      faceY(g, 22.1, 27.4 + k*5, 28.4 + k*5, 4.1, 5.9, '#3a3f45'); faceY(g, 22.1, 28.4 + k*5, 30 + k*5, 4.6, 5.4, '#8d9299'); faceY(g, 22.1, 30 + k*5, 31 + k*5, 4.1, 5.9, '#3a3f45');
      faceY(g, 22.1, 27.4 + k*5, 28.6 + k*5, 0.6, 2.7, '#4b5057'); faceY(g, 22.1, 28.6 + k*5, 29.9 + k*5, 1.3, 2, '#8d9299'); faceY(g, 22.1, 29.9 + k*5, 31.1 + k*5, 0.6, 2.7, '#4b5057');
    }
  }, 1);
  add(8, 28.8, 23, 43, function(g){
    shadow(g, 8, 31, 23, 43);
    box(g, 8, 29.4, 9.4, 31, 0, 10.6, '#8d9299', thin); box(g, 21.6, 29.4, 23, 31, 0, 10.6, '#8d9299', thin);
    box(g, 8, 28.8, 23, 31.2, 10.4, 12.8, ['#5a6068','#4b5057','#3a3f45'], true);
    faceY(g, 31.2, 13.5, 17.5, 11, 12.2, '#c9ccd1');
    box(g, 8, 31, 23, 43, 0, 2, ['#3a3f45','#33383d','#2a2e33'], true);
    faceTop(g, 9.3, 32.2, 21.7, 41.8, 2, '#5a6068'); seg(g, P(9.3, 37, 2), P(21.7, 37, 2), '#3a3f45');
  }, 1);
  // 休憩室：丸テーブルと、いす2つ（休みの人が座る場所）
  roundTable(108, 46, 1);
  [[96, 52.5], [120, 52.5]].forEach(function(s){ stool(s[0], s[1], 1); });
  // 植木（トレーニング・休憩室・事務所・廊下の右）
  plant(70, 20, 1); plant(132, 21, 1); plant(164.5, 41, 1); plant(192, 92, 1);

  if (TEAM){
    desk('owner', TEAM.owner.color || '#9ca3af', 4.6);
    desk('boss', TEAM.boss.color || '#9ca3af', 6, 3);
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
function place(c, x, y, z){ c.x = x; c.y = y; c.z = z || 0; }   // z＝床からの高さ（1階は 0、2階は F2.z、リフトの途中は その間）
function visPos(c, now){   // いま画面に見えている位置（歩いている途中は、区間の中を一定の速さで進む）
  var t = c.tw;
  if (!t) return { x: c.x, y: c.y, z: c.z || 0 };
  var k = (now - t.t0) / t.dur;
  if (k >= 1) return { x: t.x1, y: t.y1, z: t.z1 };
  if (k < 0) k = 0;
  return { x: t.x0 + (t.x1 - t.x0) * k, y: t.y0 + (t.y1 - t.y0) * k, z: t.z0 + (t.z1 - t.z0) * k };
}
// 通路を通って歩く（奥の通路・手前の通路・縦の通り道2本）。床のマスに沿って、縦か横にだけ動く
// 1階の中の道（今までと同じ決め方）
function route1(c, t){
  var cp = c.y < 52 ? Y_BACK : Y_FRONT, cq = t.y < 52 ? Y_BACK : Y_FRONT, pts = [];
  if (cp === cq){ pts.push({ x: c.x, y: cp }, { x: t.x, y: cp }); }
  else {
    var ax = Math.abs(AISLES[0] - c.x) < Math.abs(AISLES[1] - c.x) ? AISLES[0] : AISLES[1];
    pts.push({ x: c.x, y: cp }, { x: ax, y: cp }, { x: ax, y: cq }, { x: t.x, y: cq });
  }
  pts.push({ x: t.x, y: t.y });
  return pts;
}
// 2階の中の道：手前の廊下（縦 F2.aisle）を通る。部屋の中の場所へは、廊下から まっすぐ奥へ入る
function route2(c, t){ return [{ x: c.x, y: F2.aisle }, { x: t.x, y: F2.aisle }, { x: t.x, y: t.y }]; }
// 行き先までの道。階がちがう時は、リフトを通る（乗り口 D → 台 C に乗る → 上り下り → 乗り口 D）。climb: 1 の点は「リフトで上り下りする区間」。
// 高さ z を書いていない点は、その前の点の高さのまま歩く
function routeTo(c, t){
  var D = { x: F2.lx, y: F2.lin }, C = { x: F2.lx, y: F2.ly }, pts;
  var riding = c.z > 0 && c.z < F2.z, cf = c.z >= F2.z ? 2 : 1, tf = t.up ? 2 : 1;
  if (riding){        // リフトの途中で行き先が変わった時は、今の高さから 行き先の階へ
    if (tf === 2) pts = [{ x: C.x, y: C.y, z: F2.z, climb: 1 }, { x: D.x, y: D.y, z: F2.z }].concat(route2(D, t));
    else pts = [{ x: C.x, y: C.y, z: 0, climb: 1 }, { x: D.x, y: D.y, z: 0 }].concat(route1(D, t));
  }
  else if (cf === tf) pts = cf === 2 ? route2(c, t) : route1(c, t);
  else if (tf === 2) pts = route1(c, D).concat([{ x: C.x, y: C.y }, { x: C.x, y: C.y, z: F2.z, climb: 1 }, { x: D.x, y: D.y, z: F2.z }], route2(D, t));
  else pts = route2(c, D).concat([{ x: C.x, y: C.y }, { x: C.x, y: C.y, z: 0, climb: 1 }, { x: D.x, y: D.y, z: 0 }], route1(D, t));
  return pts.filter(function(p, i){ var q = i ? pts[i-1] : c; return p.climb || Math.abs(p.x - q.x) > 0.3 || Math.abs(p.y - q.y) > 0.3; });
}
// ---- リフトの順番（1人ずつ乗る）----
// 階を変える人は、歩き出す前に順番を取る（LIFT.res）。前の人が上り下りし終わるまでは、今いる所で待ってから歩き出す
// （台に2人が重ならない・乗り口に行列を作らない）。
// 順番は人ごとに覚える。歩くのをやめた時・行き先が変わった時は返し（liftDrop）、待っている人を前へつめる（liftPlan）。
// 席へ直接戻された人・いなくなった人の順番は、次に決め直す時に捨てる（だから、順番が残って ほかの人が待たされる事は無い）。
function liftDrop(c){
  for (var i = LIFT.res.length - 1; i >= 0; i--) if (LIFT.res[i].c === c){ if (LIFT.res[i].timer) clearTimeout(LIFT.res[i].timer); LIFT.res.splice(i, 1); }
}
// 順番を決め直す：もう歩き出した人・乗っている人の時間は そのまま。待っている人を、申しこんだ順に、空いている いちばん早い時間へ入れる
function liftPlan(){
  var now = Date.now(), dur = (F2.climb + 2.4) * 1000, busy = [], waits = [], i, r;
  for (i = LIFT.res.length - 1; i >= 0; i--){
    r = LIFT.res[i];
    if (OFFICE.chars[r.c.id] !== r.c || r.c.moveId !== r.mid || (r.state !== 'wait' && r.end < now - 1500)){ if (r.timer) clearTimeout(r.timer); LIFT.res.splice(i, 1); }
    else if (r.state === 'wait') waits.push(r);
    else busy.push([r.at, r.end]);
  }
  waits.sort(function(a, b){ return a.seq - b.seq; });
  waits.forEach(function(r){
    var t = Math.max(now, r.ready) + r.tsec, k, dep;   // t＝いちばん早く台に着ける時刻
    busy.sort(function(a, b){ return a[0] - b[0]; });
    for (k = 0; k < busy.length; k++){ if (t + dur <= busy[k][0]) break; if (t < busy[k][1]) t = busy[k][1]; }
    r.at = t; r.end = t + dur; busy.push([t, t + dur]);
    dep = t - r.tsec;                                   // dep＝歩き出す時刻
    if (r.timer) clearTimeout(r.timer);
    r.c.waitTo = dep - now > 50 ? dep : 0;
    r.timer = setTimeout(r.go, Math.max(0, dep - now));
  });
  LIFT.free = 0; busy.forEach(function(b){ if (b[1] > LIFT.free) LIFT.free = b[1]; });
}
// 休み場所を「歩き出すまで」取っておく（順番を待つ間に、同じ場所へ ほかの人が来ないように）。c.hold＝取ってある場所の番号
function unhold(c){
  if (c.hold != null && SPOTS[c.hold] && SPOTS[c.hold].by === c.id) SPOTS[c.hold].by = null;
  c.hold = null;
}
function holdPlace(c){
  if (c.hold == null) c.hold = c.spot;
  else if (c.spot != null && c.spot !== c.hold && SPOTS[c.spot].by === c.id) SPOTS[c.spot].by = null;   // 行き先に決めただけで、まだ歩き出していなかった場所は返す
  c.spot = null;
}
// 今いる所（x, y）から、道 pts のとおりに歩いて、リフトの台に着くまでの秒数。リフトを通らない道は -1
function legSec(x, y, pts){
  var k, sec = 0, dx, dy;
  for (k = 0; k < pts.length && !pts[k].climb; k++){ dx = (pts[k].x - x) * 2; dy = pts[k].y - y; sec += Math.max(0.15, Math.sqrt(dx*dx + dy*dy) / 13) + 0.03; x = pts[k].x; y = pts[k].y; }
  return k > 0 && k < pts.length ? sec : -1;
}
// 返す値＝歩き出すまでに待つ時間（ms）
function walkTo(c, target, done){
  var id = ++c.moveId, now = Date.now(), v = visPos(c, now), leg = 0, pts, r, sec, S, pre, psec, k, dx, dy;
  liftDrop(c);                              // 前の行き先のために取っていた順番は返す
  c.tw = null; place(c, v.x, v.y, v.z);   // 歩いている途中で行き先が変わった時は、今いる所から歩き直す
  c.say.t = ''; c.say.cls = 'say'; c.k.train = false; c.waitTo = 0;
  if (c.hold != null && c.seat && Math.abs(c.x - c.seat.x) < 0.4 && Math.abs(c.y - c.seat.y) < 0.4 && (c.z >= F2.z ? 1 : 0) === (c.seat.up ? 1 : 0)) unhold(c);   // 席にいる人が取ったままの休み場所は返す（席へ直接戻された後に残った分）
  pts = routeTo(c, target);
  function run(list, fin){   // 道のとおりに歩く（次の run・次の walkTo が始まったら、そこでやめる）
    var my = ++leg;
    (function next(){
      if (id !== c.moveId || my !== leg) return;
      var p = list.shift();
      if (!p){ c.k.walk = false; c.tw = null; if (fin) fin(); return; }
      var pz = p.z == null ? c.z : p.z;
      var dx = (p.x - c.x) * 2, dy = p.y - c.y, sec = Math.max(0.15, Math.sqrt(dx*dx + dy*dy) / 13);   // 速さ一定
      if (p.climb) sec = Math.max(0.3, F2.climb * Math.abs(pz - c.z) / F2.z);   // リフトは、上り下りした高さで時間が決まる（向きは変えない）
      else if (Math.abs(dx - dy) > 0.6) c.k.flip = (dx - dy) < 0;   // 画面の上で左へ進む時は左向き
      c.k.walk = true;
      c.tw = { x0: c.x, y0: c.y, z0: c.z, x1: p.x, y1: p.y, z1: pz, t0: Date.now(), dur: sec * 1000 };
      place(c, p.x, p.y, pz);
      setTimeout(next, sec * 1000 + 30);
    })();
  }
  if (c.z > 0 && c.z < F2.z){   // リフトに乗っている途中で行き先が変わった：下り切る（上り切る）まで、リフトはこの人が使っている
    LIFT.res.push({ c: c, mid: id, seq: ++LIFT.seq, ready: now, tsec: 0, at: now, end: now + (F2.climb + 2.4) * 1000, state: 'go', timer: 0, go: null });
    unhold(c); run(pts, done); liftPlan();
    return 0;
  }
  sec = legSec(c.x, c.y, pts);
  if (sec < 0){ unhold(c); run(pts, done); liftPlan(); return 0; }   // リフトを通らない（順番を返した分、待っている人を前へつめる）
  // リフトを通る：順番を取る
  r = { c: c, mid: id, seq: ++LIFT.seq, ready: now, tsec: sec * 1000, at: 0, end: 0, state: 'wait', timer: 0, go: null };
  r.go = function(){   // 順番が来た：今いる所から歩き出す
    if (id !== c.moveId) return;
    r.timer = 0; r.state = 'go'; c.waitTo = 0; unhold(c);
    var q = visPos(c, Date.now()); c.tw = null; place(c, q.x, q.y, q.z);
    run(routeTo(c, target), done);
  };
  LIFT.res.push(r); liftPlan();
  if (r.at - r.tsec - now <= 50){ clearTimeout(r.timer); r.go(); return 0; }   // 待たずに行ける
  // 順番を待つ。歩いている途中だった人は、向かっていた休み場所（同じ階）まで歩いてから、そこで待つ（通路のまん中で止まらない）
  c.k.walk = false;
  S = c.hold != null ? SPOTS[c.hold] : null;
  if (S && (S.up ? 1 : 0) === (c.z >= F2.z ? 1 : 0) && (Math.abs(S.x - c.x) > 0.4 || Math.abs(S.y - c.y) > 0.4)){
    pre = routeTo(c, S); psec = 0; dx = c.x; dy = c.y;
    for (k = 0; k < pre.length; k++){ psec += Math.max(0.15, Math.sqrt(Math.pow((pre[k].x - dx) * 2, 2) + Math.pow(pre[k].y - dy, 2)) / 13) + 0.03; dx = pre[k].x; dy = pre[k].y; }
    sec = legSec(S.x, S.y, routeTo({ x: S.x, y: S.y, z: c.z }, target));
    if (sec >= 0){ r.ready = now + psec * 1000 + 200; r.tsec = sec * 1000; liftPlan(); run(pre, null); }
  }
  return Math.max(0, r.at - r.tsec - now);
}
function freeSpot(c){
  if (c.spot != null){ SPOTS[c.spot].by = null; c.spot = null; }
}
// 空いている休み場所（1階と2階の両方）。自主点検でトレーニングに人が並んでいる間は、トレーニングの3か所を使わない（並んでいる人と同じ場所に重なるため）
function openSpots(){
  var open = [];
  SPOTS.forEach(function(p, i){ if (!p.by && !(p.train && OFFICE.trn)) open.push(i); });
  return open;
}
// おたすけ（席の無い応援）と、机の無いメンバーの場所＝1階の打ち合わせの机のまわり。
// 左のいす → 右のいす → 机の右に立つ → 奥のいす → 入口よりに立つ、の順（HELP_POS）。同じ場所に2人は置かない：
// 6人目からは、同じ並びを ななめ後ろへ少しずらして使う（まったく同じ場所には立たない）
var HELP_POS = [[71, 52.5], [83, 52.5], [89, 44], [77, 37], [95, 52]];
function helperSeat(c){
  var used = {}, n = 0, p, lap;
  Object.keys(OFFICE.chars).forEach(function(id){ var o = OFFICE.chars[id]; if (o !== c && o.seated && o.hslot != null) used[o.hslot] = 1; });
  while (used[n]) n++;
  c.hslot = n; p = HELP_POS[n % HELP_POS.length]; lap = Math.floor(n / HELP_POS.length);
  return { x: p[0] - lap * 1.5, y: p[1] - lap * 3 };
}
// 待ちの人の行き先。階は あまり変えない：今いる階に空きがあれば、8割5分は同じ階の中で動く。リフトが使われている間は、必ず同じ階
// （行ったり来たりを増やさない。階を変えるのは、10人が待ちの時で 1〜2分に1回ほど）
function goIdle(c, id){
  var open = openSpots();
  if (!open.length) return;
  c.k.work = false;   // 待ちの人は、もう作業の姿ではない（仕事が終わった後に席へ着いた時の「作業中の姿」が、休み場所まで残らないように）
  var here = c.z >= F2.z ? 1 : 0, same = open.filter(function(n){ return (SPOTS[n].up ? 1 : 0) === here; });
  if (same.length){ if (Date.now() < LIFT.free || Math.random() < 0.85) open = same; }
  else if ((c.spot != null || c.hold != null) && (Date.now() < LIFT.free || Math.random() < 0.85)){ c.nextMove = Date.now() + 20000 + Math.random() * 30000; return; }   // 今いる階の休み場所が いっぱいの時は、たいてい その場にいる（机から離れる時だけは、空いている階へ行く）
  var i = open[Math.floor(Math.random() * open.length)], p = SPOTS[i];
  holdPlace(c); p.by = id; c.spot = i; c.nextAct = 0;   // 今いる休み場所は、歩き出すまで取っておく（walkTo が返す）
  var w = walkTo(c, p, function(){
    var cls = p.train ? 'say kata' : 'say emo';
    if (p.train && c.spot === i) c.k.train = true;   // トレーニング中は小さく体を動かす
    if (p.emo){ c.say.cls = cls; c.say.t = p.emo; setTimeout(function(){ if (c.say.cls === cls) c.say.t = ''; }, 3500); }
    c.nextAct = Date.now() + 5000 + Math.random() * 6000;
  });
  c.nextMove = Date.now() + w + 35000 + Math.random() * 55000;   // 次に動くのは 35〜90 秒後（ばらばらに）
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
  place(c, p.x, p.y, p.up ? F2.z : 0);
  return c;
}
function removeChar(id){ var c = OFFICE.chars[id]; if (!c) return; c.moveId++; freeSpot(c); delete OFFICE.chars[id]; delete OFFICE.desk[id]; }
function fx(cls, text, from, to){
  var z0 = from.z || 0;
  OFFICE.fx.push({ cls: cls, text: text, x0: from.x, y0: from.y, z0: z0, x1: to ? to.x : from.x, y1: to ? to.y : from.y, z1: to ? (to.up ? F2.z : 0) : z0, move: !!to, t0: Date.now(), life: to ? 1400 : 2700 });
}
function buildOffice(){
  buildScene();
  Object.keys(OFFICE.chars).forEach(function(id){ OFFICE.chars[id].moveId++; });
  OFFICE.chars = {}; OFFICE.desk = {}; SPOTS.forEach(function(p){ p.by = null; });
}
function updateOffice(){
  var sig = [TEAM.owner.sprite, TEAM.boss.sprite, TEAM.boss.color].concat(TEAM.members.map(function(m){ return m.id+m.sprite+m.color+m.nick; })).join('|');
  if (sig !== OFFICE.sig){ OFFICE.sig = sig; OFFICE.prev = {}; buildOffice(); }
  var st = STATE || {}, agents = st.agents || {}, boss = st.boss || {}, replan = false;
  var list = [{ id: 'owner', m: TEAM.owner, s: {} }, { id: 'boss', m: TEAM.boss, s: boss, crown: true }];
  TEAM.members.forEach(function(m){ list.push({ id: m.id, m: m, s: agents[m.id] || {} }); });
  // 名簿に無い応援スタッフ（おたすけ）は、動いている間だけ出てくる
  Object.keys(agents).forEach(function(id){
    if (memberOf(id)) return;
    if (agents[id].status === 'working') list.push({ id: id, m: { nick: 'おたすけ', color: '#9ca3af', sprite: 'ghost' }, s: agents[id] });
    else if (OFFICE.chars[id]){ unhold(OFFICE.chars[id]); liftDrop(OFFICE.chars[id]); replan = true; removeChar(id); }
  });
  OFFICE.trn = list.some(function(o){ return o.id !== 'owner' && o.s.status === 'working' && /自主点検/.test(o.s.task || ''); });
  list.forEach(function(o){
    var born = !OFFICE.chars[o.id], c = ensureChar(o.id, o.m, o.crown), working = o.s.status === 'working', was = OFFICE.prev[o.id];
    // おたすけ（名簿に無い応援）は、1階の入口から入って来る（2階の休み場所に現れて、リフトで下りて来る事が無いように）。何人か同時の時は、縦に少しずらす
    if (born && !memberOf(o.id)){ freeSpot(c); place(c, 96, 60 + 6 * ((Object.keys(OFFICE.chars).filter(function(k){ return !memberOf(k); }).length - 1) % 3), 0); }
    OFFICE.desk[o.id] = working;
    if (o.id === 'owner') return;
    var text = cut(o.id === 'boss' ? (toolWords(o.s.lastTool, '') || '考えています') : (o.s.task || '作業中'), 18);
    if (working){
      c.text = text;
      if (!c.seated){
        c.seated = true; holdPlace(c);   // 今いる休み場所は、歩き出すまで取っておく（リフトの順番を待つ間、ほかの人が同じ場所に来ない。walkTo が返す）
        // 自主点検（週1回のふり返り）の間は、席ではなく2階のトレーニングにいる
        // 立つ場所は名簿の順をもとに trainSpot が割りふる。名簿に無い人（チロル・おたすけ）は、メンバーの後ろに並ぶ
        var tr = /自主点検/.test(o.s.task || ''), ti = TEAM.members.length + (o.id === 'boss' ? 0 : 1), far;
        TEAM.members.forEach(function(m, k){ if (m.id === o.id) ti = k; });
        // おたすけ（席の無い応援）と、机の無いメンバーは、打ち合わせの机のまわり（helperSeat）
        var seat = tr ? trainSpot(ti) : (seatOf(o.id) || helperSeat(c));
        c.train = tr;
        if (was === false && o.id !== 'boss' && OFFICE.chars.boss) fx('paper', '📄', OFFICE.chars.boss, seat);
        c.seat = seat; c.k.busy = false;
        var sit = function(){ c.k.flip = false; c.k.walk = false; c.k[c.train ? 'train' : 'work'] = true; c.say.cls = 'say'; c.say.t = c.train ? '' : (c.text || ''); };
        c.sit = sit; far = seat.up || c.z > 0;
        c.due = Date.now() + (far ? 42000 : 20000) + walkTo(c, seat, sit);   // 20秒（リフトを通る時は 42秒＋順番を待つ時間）たっても席に着いていなければ、席へ直接戻す
      } else if (c.k.work) { c.say.cls = 'say'; c.say.t = text; if (c.hold != null && !c.k.walk && Math.abs(c.x - c.seat.x) < 0.4 && Math.abs(c.y - c.seat.y) < 0.4) unhold(c); }   // 席に着いているのに取ったままの休み場所は返す（画面を裏にしていて、席へ直接戻された後など）
      else if (!c.k.train && c.due && Date.now() > c.due){ c.moveId++; c.tw = null; c.waitTo = 0; unhold(c); liftDrop(c); replan = true; place(c, c.seat.x, c.seat.y, c.seat.up ? F2.z : 0); c.sit(); c.due = 0; }
    } else if (c.seated){
      c.seated = false; c.k.work = false; c.k.train = false; c.say.t = ''; c.say.cls = 'say'; c.due = 0;
      if (was === true && o.id !== 'boss') fx('pop', '✔ +' + XP_PER_TASK + 'XP', c);
      c.nextMove = Date.now() + 4000 + Math.random() * 5000;   // 少し席で一息ついてから離れる
      // まだ歩き出していなかった人（リフトの順番を待っていた人）は、行くのをやめて順番を返す。休み場所にいた人は、そのまま そこにいる
      if (c.waitTo > Date.now() && !c.k.walk){
        c.moveId++; c.waitTo = 0; liftDrop(c); replan = true;
        if (c.hold != null){ c.spot = c.hold; c.hold = null; c.nextMove = Date.now() + 20000 + Math.random() * 30000; }
      }
    }
    OFFICE.prev[o.id] = working;
  });
  if (replan) liftPlan();   // 返された順番の分、待っている人を前へつめる
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
  // 店長は2階の事務所でひっそり作業している（ときどき小さく「カタカタ」と出る）
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
    c.vx = v.x; c.vy = v.y; c.vz = v.z || 0;
    c.bob = c.k.walk ? Math.floor(tq / 180) % 2 * 2 : c.k.train ? Math.floor(tq / 250) % 2 * 2 : c.k.busy ? Math.floor(tq / 250) % 2 : c.k.work ? Math.floor(tq / 500) % 2 : 0;
    c.shut = ((tq + c.blink) % 5000) < wink ? 1 : 0;
    key += c.id + ':' + Math.round(v.x * 8) + ',' + Math.round(v.y * 8) + (c.vz ? ',' + Math.round(c.vz * 4) : '') + ',' + c.bob + c.shut + (c.k.flip ? 'f' : '') + (c.seated ? 's' : '') + c.say.cls + c.say.t + ';';
  }
  key += (anyOn ? Math.floor(tq / 500) % 2 : '') + '/' + Math.floor(tq / 1000) % 2 + '/' + (OFFICE.fx.length ? now : '') + '/' + SEL;
  lastDraw = now;
  if (key === lastKey) return;
  lastKey = key;
  var t0 = performance.now();
  FACES = 0;

  // 1階の物と人・2階の物と人に分ける（床より上にいる人＝2階の人と、リフトで上り下りしている人は、2階の側で描く）
  var items2 = SCENE2.slice();
  items = SCENE.slice(); RIDERS = 0;
  for (i = 0; i < ids.length; i++){
    c = OFFICE.chars[ids[i]];
    if (c.vz > 0 && c.vz < F2.z) RIDERS++;
    (c.vz > 0 ? items2 : items).push({ ch: c, x0: c.vx * 2 - 3, x1: c.vx * 2 + 3, y0: c.vy - 1.2, y1: c.vy + 1.2 });
  }
  items = sortItems(items); items2 = sortItems(items2);

  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, V.W, V.H);
  g.imageSmoothingEnabled = false;
  g.save(); if (V.lw % 2) g.translate(0.5, 0.5);
  g.lineWidth = V.lw; g.lineJoin = 'round';
  HITS = [];
  function pass(a){
    for (var n = 0; n < a.length; n++){
      if (a[n].ch){ g.restore(); drawChar(g, a[n].ch); list.push(a[n].ch); g.save(); if (V.lw % 2) g.translate(0.5, 0.5); g.lineWidth = V.lw; g.lineJoin = 'round'; }
      else a[n].draw(g, tq);
    }
  }
  pass(items);
  // 2階の床（F2.glass の分だけ透かす）→ 2階の壁・床の線・壁ぎわの物（先に描いておいた絵）→ 2階の物と人
  ZB = F2.z;
  try { g.globalAlpha = 1 - F2.glass; faceTop(g, 0, 14, 200, 100, 0, '#e3e4e7'); } finally { g.globalAlpha = 1; ZB = 0; }
  g.restore();
  g.drawImage(f2Cv, 0, 0);
  g.save(); if (V.lw % 2) g.translate(0.5, 0.5);
  g.lineWidth = V.lw; g.lineJoin = 'round';
  pass(items2);
  g.restore();
  drawLabels(g, list);
  drawFx(g, now);

  var ms = performance.now() - t0;
  PERF.n++; PERF.sum += ms; PERF.last = ms; if (PERF.n > 3 && ms > PERF.max) PERF.max = ms; PERF.objs = items.length + items2.length; PERF.faces = FACES;
}
function drawChar(g, c){
  var set = spriteSet(c.m.color || '#9ca3af', c.m.sprite || 'ghost', c.crown), ps = V.ps;
  var p = P(c.vx * 2, c.vy, c.vz || 0), cx = Math.round(p[0]), cy = Math.round(p[1]);
  var bob = Math.round(c.bob * Math.max(1, ps / 2) / 2);
  var x = cx - set.w / 2, y0 = cy - set.h + Math.round(ps / 2), y = y0 - bob;   // 札や吹き出しは、足ぶみでは揺らさない（y0 を基準にする）
  if (c.vz > 0 && c.vz < F2.z){   // リフトで上り下りしている間は、足の下に台を描く
    var LX = F2.lx * 2;
    g.save(); if (V.lw % 2) g.translate(0.5, 0.5); g.lineWidth = V.lw; g.lineJoin = 'round';
    box(g, LX - 6.4, F2.ly - 4.4, LX + 6.4, F2.ly + 6, c.vz - 1.2, c.vz, ['#f1f2f3','#c9ccd1','#b4b8be'], true);
    g.restore();
  }
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
  var UPS = [0, 14, 28, 42, 58, 76, 96, 120, 146, 174, 204, 236], side;   // 奥の列の人の上まで上げられるように、高い段を足した（1階に机が2列あるため）
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
      cost += hit[0] * 1000 + hit[1] * 400 + hit[2] * 150;   // 顔（頭）にも乗せない（前は 10。机が2列になり、手前の人の吹き出しが奥の人の顔にかかる事があった）
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
    var st = SEL === 'boss' ? '社長席' : SEL === 'owner' ? '店長席' : (sm.nick || sm.name) + 'の席';
    var sp = SEL === 'boss' ? P(ss.x * 2, ss.y + 9.5, 0) : P(ss.x * 2 + 1, ss.y + 3.5 + (SEL === 'owner' ? 4.6 : 6), ss.up ? F2.z : 0);
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
      p = P((f.x0 + (f.x1 - f.x0) * e) * 2, f.y0 + (f.y1 - f.y0) * e, 15 + 9 * Math.sin(Math.PI * e) + f.z0 + (f.z1 - f.z0) * e);
      g.font = Math.round(Math.max(16, Math.min(22, V.tw / d * 0.28)) * d) + 'px "Segoe UI Emoji","Apple Color Emoji",' + FONT;
      g.fillStyle = '#4a3a2a'; g.fillText(f.text, Math.round(p[0]), Math.round(p[1]));
    } else {      // 「✔ +20XP」が浮かんで消える（2.6秒）
      k = Math.min(1, (now - f.t0) / 2600); a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
      p = P(f.x0 * 2, f.y0, f.z0);
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
  Object.keys(OFFICE.chars).forEach(function(id){ var c = OFFICE.chars[id]; if (c.seated && c.seat && c.sit && !c.k.work && !c.k.train){ c.moveId++; c.tw = null; place(c, c.seat.x, c.seat.y, c.seat.up ? F2.z : 0); c.sit(); c.due = 0; } });
  lastKey = ''; kick();
}
function onFonts(){   // Web の字（DotGothic16）が届いたら、字の幅の覚えを捨てて描き直す（先に別の字で描いた壁の札・名札を直す）
  if (!RUN || !V.W) return;
  try { WRAP = {}; lastKey = ''; drawStatic(floorG); drawStatic2(f2G); if (shown()) render(Date.now()); } catch (e) {}
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
var DEMO_TASK = { research: '2店舗 外部要因のリサーチ', planner: '新村 清算書の数字まとめ', strategy: '新村 今週の作戦づくり', pop: '2店舗 売場マップとPOPを作成', 'crew-info': 'クルー向けお知らせの図解', 'crew-care': '面談の準備', 'system-dev': 'アプリの動作確認', qa: '公開の前の点検', 'tools-dev': 'ダッシュボードの手入れ' };
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
  SPOTS = (o.SPOTS || []).map(function(p, i){ var q = SPOT_POS[i]; return { x: q ? q[0] : p.x, y: q ? q[1] : p.y, up: q && q[2] ? 1 : 0, emo: p.emo, acts: p.iso || p.acts, train: p.train, chat: p.chat, by: null }; });   // up＝2階の場所。iso＝この絵の時だけ使うことば（index.html の SPOTS に書いてある時）
  if (!document.getElementById('iso-css')){ var st = document.createElement('style'); st.id = 'iso-css'; st.textContent = CSS; document.head.appendChild(st); }
  boxEl = o.el; boxEl.className = 'iso-box';
  boxEl.innerHTML = '<div class="iso-world"><canvas aria-hidden="true"></canvas><canvas role="img" aria-label="オフィスの絵。メンバーを押すと役割の説明が出ます"></canvas></div><div class="iso-status"></div><div class="iso-card"></div>';
  worldEl = boxEl.firstChild; floorCv = worldEl.firstChild; stageCv = worldEl.lastChild; statusEl = boxEl.children[1]; cardEl = boxEl.children[2];
  floorG = floorCv.getContext('2d'); stageG = stageCv.getContext('2d');
  f2Cv = document.createElement('canvas'); f2G = f2Cv.getContext('2d');   // 2階の動かない物を描いておく絵（画面には出さない）
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
  LIFT.res.forEach(function(r){ if (r.timer) clearTimeout(r.timer); }); LIFT.res = []; LIFT.free = 0;
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
        up: (c.vz || 0) > 0, z: Math.round(c.vz || 0), wait: !!(c.waitTo && c.waitTo > Date.now()), seated: !!c.seated, walk: !!c.k.walk, work: !!c.k.work, train: !!c.k.train, say: c.say.t || '', tag: c.tag ? !c.tagHide : null, click: !!c.click };
    }),
    bubbles: BUBS.length, fx: OFFICE.fx.length, moving: anyMoving() || Object.keys(OFFICE.chars).some(function(id){ var c = OFFICE.chars[id]; return c.waitTo && c.waitTo > Date.now(); }), raf: !!RAF, timer: !!TMR,   // moving＝歩いている人か、リフトの順番を待っている人がいる
    draws: PERF.n, msAvg: PERF.n ? Math.round(PERF.sum / PERF.n * 100) / 100 : 0, msMax: Math.round(PERF.max * 100) / 100, objs: PERF.objs, faces: PERF.faces };
}
window.IsoOffice = { mount: mount, update: update, select: select, stop: stop, demoState: demoState, info: info };
})();
