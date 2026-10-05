#!/usr/bin/env bash
# 新しいシステムのワークスケジュール（v2/ws/index.html）を、いまのワークスケジュール（ws/index.html）から作り直す道具。
# いまのワークスケジュールを直した時は、これをもう一度動かせば、同じ差し替えだけをした新しい画面ができる（計算・画面のコードは写すだけ）。
# 使い方： リポジトリの一番上で  bash v2/build-ws.sh
# 差し替える所は下の【v2 差し替え1〜4】だけ。それ以外は1文字も変えない。
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=ws/index.html; DST=v2/ws/index.html
mkdir -p v2/ws
MAIN=$(grep -n '^<script>$' "$SRC" | tail -1 | cut -d: -f1)          # いちばん大きい本体のスクリプトの始まり
NEXT=$(sed -n "$((MAIN+1))p" "$SRC" | tr -d '\r')
[ -n "$MAIN" ] && [ "$NEXT" = "'use strict';" ] || { echo "差し替える場所が見つかりません（いまのワークスケジュールの形が変わった可能性）。止めます。"; exit 1; }
sed \
  -e "${MAIN}s#.*#<!-- 【v2 差し替え1】保存と読み込みの行き先を、新しい保存先に替える「つなぎ」。本体より先に読み込む -->\n<script src=\"../core.js\"></script>\n<script src=\"../wsspec.js\"></script>\n<script src=\"../wsshim.js\"></script>\n<!-- 【v2 差し替え2】本体は、データが届いてから動かす（動かすのは v2/wsshim.js）。中身は元のまま -->\n<script type=\"text/plain\" id=\"v2-main\">#" \
  -e 's#<script src="\.\./autoupdate\.js" defer></script>#<script src="../../autoupdate.js" defer></script><!-- 【v2 差し替え3】自動更新の場所 -->#' \
  -e 's#\.\./app\.html?sys=ws#../index.html?sys=ws#g' \
  -e "s#^<script>if(!window.__EMBEDDED){document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.id='standalone-warn'#<script>/* 【v2 差し替え4】単体で開いた時の帯の行き先 */if(!window.__EMBEDDED\&\&!/[?\&]mem=1/.test(location.search)){document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.id='standalone-warn'#" \
  "$SRC" > "$DST"
grep -q "wsshim.js" "$DST" && grep -q 'id="v2-main"' "$DST" || { echo "差し替えに失敗しました。止めます。"; exit 1; }
echo "作りました: $DST"
git diff --no-index --stat "$SRC" "$DST" | tail -1 || true
