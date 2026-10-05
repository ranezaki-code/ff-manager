#!/usr/bin/env bash
# 新しいシステムの FF管理（v2/ff/index.html）を、いまの FF管理（ff/index.html）から作り直す道具。
# いまの FF管理を直した時は、これをもう一度動かせば、同じ差し替えだけをした新しい画面ができる（計算・画面のコードは写すだけ）。
# 使い方： リポジトリの一番上で  bash v2/build-ff.sh
# 差し替える所は下の【v2 差し替え1〜5】だけ。それ以外は1文字も変えない。
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=ff/index.html; DST=v2/ff/index.html
mkdir -p v2/ff
MAIN=$(grep -n '^<script>$' "$SRC" | tail -1 | cut -d: -f1)          # いちばん大きい本体のスクリプトの始まり
BOOT=$(grep -n "^window.addEventListener('DOMContentLoaded',async()=>{$" "$SRC" | cut -d: -f1)
[ -n "$MAIN" ] && [ -n "$BOOT" ] && [ "$(echo "$BOOT" | wc -l)" = "1" ] || { echo "差し替える場所が見つかりません（いまの FF管理の形が変わった可能性）。止めます。"; exit 1; }
sed \
  -e "${MAIN}i <!-- 【v2 差し替え1】保存と読み込みの行き先を、新しい保存先に替える「つなぎ」。本体より先に読み込む -->\n<script src=\"../core.js\"></script>\n<script src=\"../ffspec.js\"></script>\n<script src=\"../ffshim.js\"></script>" \
  -e "${BOOT}s#.*#window.__v2boot=(async()=>{   // 【v2 差し替え2】起動：データが届いてから始める（始めるのは v2/ffshim.js）。中身は元のまま#" \
  -e 's#<script src="\.\./autoupdate\.js" defer></script>#<script src="../../autoupdate.js" defer></script><!-- 【v2 差し替え3】自動更新の場所 -->#' \
  -e 's#\.\./app\.html?sys=ff#../index.html?sys=ff#g' \
  -e "s#fetch('\.\./gaibu/'#fetch('../../gaibu/'/* 【v2 差し替え5】ミルの外部要因データの場所（フォルダが1つ深くなった分） */#" \
  -e "s#^<script>if(!window.__EMBEDDED){document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.id='standalone-warn'#<script>/* 【v2 差し替え4】単体で開いた時の帯の行き先 */if(!window.__EMBEDDED\&\&!/[?\&]mem=1/.test(location.search)){document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.id='standalone-warn'#" \
  "$SRC" > "$DST"
grep -q "ffshim.js" "$DST" && grep -q "window.__v2boot=(async" "$DST" || { echo "差し替えに失敗しました。止めます。"; exit 1; }
echo "作りました: $DST"
git diff --no-index --stat "$SRC" "$DST" | tail -1 || true
