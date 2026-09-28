#!/bin/sh
# ---------------------------------------------------------------------------
# scripts/serve-public.sh
#   公開トンネル（Cloudflare Tunnel など）経由でアプリを外から見せるための
#   起動・停止ヘルパー。個人のホスト名やパスはここに書かず、すべて env で渡す。
#
#   起動（Vite / nuxt dev = 既定、開発中のプレビュー公開向け）:
#     PUBLIC_HOST=dev.example.com PUBLIC_BASE_PATH=/vocaloid-hz/ ./scripts/serve-public.sh
#   起動（ビルド済みの本番サーバー .output を使う）:
#     NUXT_APP_BASE_URL=/vocaloid-hz/ npm run build
#     PUBLIC_BASE_PATH=/vocaloid-hz/ ./scripts/serve-public.sh prod
#   停止:  ./scripts/serve-public.sh stop
#   状態:  ./scripts/serve-public.sh status
#
#   環境変数:
#     PUBLIC_PORT      待ち受けポート（既定 3120）
#     PUBLIC_BASE_PATH 配信パス（既定 / 。末尾スラッシュは自動で補う）
#     PUBLIC_HOST      トンネルのホスト名（既定 dev.example.com）。
#                      dev モードでは NUXT_DEV_ALLOWED_HOSTS に渡すので、
#                      Vite の Host チェック（DNS リバインディング対策）で弾かれない。
#     PUBLIC_* が無いときは .env の NUXT_DEV_ALLOWED_HOSTS / NUXT_APP_BASE_URL を流用する。
#
#   トンネル側は次のように向ける（設定は環境ごとに用意する）:
#     <PUBLIC_HOST> / Path ^/vocaloid-hz/.* → http://127.0.0.1:3120
# ---------------------------------------------------------------------------
set -eu

cd "$(dirname "$0")/.."

PORT="${PUBLIC_PORT:-3120}"
BASE="${PUBLIC_BASE_PATH:-${NUXT_APP_BASE_URL:-/}}"
HOST="${PUBLIC_HOST:-${NUXT_DEV_ALLOWED_HOSTS:-dev.example.com}}"
PID_FILE="/tmp/vocaloid-hz-public.pid"
LOG_FILE="/tmp/vocaloid-hz-public.log"

# サブパス配信のときは末尾に / を付ける（Nuxt の baseURL と揃える）
case "$BASE" in
  */) ;;
  *) BASE="${BASE}/" ;;
esac

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

stop_all() {
  if is_running; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  # npm / vite の子プロセスも落とす（dev モードは孫プロセスまで残るため）
  pkill -f "nuxt dev --host 127.0.0.1 --port ${PORT}" 2>/dev/null || true
  rm -f "$PID_FILE"
}

case "${1:-dev}" in
  stop)
    if is_running; then
      stop_all
      echo "停止しました（ポート ${PORT}）"
    else
      stop_all
      echo "起動していません"
    fi
    ;;
  status)
    if is_running; then
      echo "起動中: pid $(cat "$PID_FILE") / http://localhost:${PORT}${BASE} / ログ ${LOG_FILE}"
    else
      echo "停止中"
    fi
    ;;
  prod)
    stop_all
    if [ ! -f .output/server/index.mjs ]; then
      echo "ビルドが見つかりません: NUXT_APP_BASE_URL=${BASE} npm run build"
      exit 1
    fi
    NUXT_APP_BASE_URL="$BASE" PORT="$PORT" nohup node .output/server/index.mjs > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 3
    echo "本番サーバーを起動しました: http://localhost:${PORT}${BASE}"
    ;;
  *)
    stop_all
    # 公開経由では DevTools の WebSocket ルートが通常の GET を 426 にしてしまうため無効化する
    NUXT_DEVTOOLS_ENABLED=false NUXT_APP_BASE_URL="$BASE" NUXT_DEV_ALLOWED_HOSTS="$HOST" \
      PORT="$PORT" nohup npm run dev -- --host 127.0.0.1 --port "$PORT" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 18
    echo "Vite（nuxt dev）を起動しました: http://localhost:${PORT}${BASE}"
    echo "トンネルからは https://${HOST}${BASE} で見えます（Host 許可済み）"
    echo "ログ: ${LOG_FILE}"
    ;;
esac
