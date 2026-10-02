# デプロイ / 公開

## 1. ビルドと起動

```bash
npm ci
npm run build                    # .output/ に Nitro サーバーを生成
PORT=3000 node .output/server/index.mjs
```

- **ルート配信**: そのまま `node .output/server/index.mjs`
- **サブパス配信**（`https://example.com/vocaloid-hz/` のように下のパスへ置く場合）:
  ```bash
  NUXT_APP_BASE_URL=/vocaloid-hz/ npm run build   # 末尾スラッシュ必須・ビルド時に埋め込まれる
  NUXT_APP_BASE_URL=/vocaloid-hz/ PORT=3120 node .output/server/index.mjs
  ```

## 2. 本番の環境変数

`.env` を置くか、プロセス環境変数として渡します（[SETUP.md](SETUP.md#3-環境変数) も参照）。

| 変数 | 本番での注意 |
| :--- | :--- |
| `NUXT_SEED_PASSWORD` | 初回 seed に使われるデモユーザーのパスワード。**必ず既定値から変更** |
| `NUXT_DB_PATH` | 永続ボリューム上のパスを指定（例 `/var/lib/vocaloid-hz/vocaloid.hz.db`） |
| `NUXT_APP_BASE_URL` | サブパス配信時は末尾スラッシュ付きで指定 |
| `YOUTUBE_DATA_API_KEY` / `NUXT_OLLAMA_*` / OAuth / Discord | 使う機能のぶんだけ設定 |

OAuth を使う場合は、各プロバイダーのリダイレクト URI を本番 URL に合わせます。
`<origin>/api/auth/oauth/<google|discord>/callback`

## 3. リバースプロキシ / トンネル

- **`X-Forwarded-Proto: https` を必ず渡す**
  これが無いとセッション cookie に `Secure` が付きません（`server/utils/auth.ts`）。
- **SSE を通す**: `/api/board/events` と `/api/lounge/events` は Server-Sent Events です。
  プロキシ側のバッファリングを無効化し（Nginx なら `proxy_buffering off;`）、
  読み取りタイムアウトを長め（例 300s）にしてください。
- **AI の応答は長め**: Ollama（gemma3）の生成は 30 秒を超えることがあります。ゲートウェイの
  タイムアウトを余裕をもって設定してください。
- **アップロード無制限ではない**: 掲示板・ラウンジの投稿は 500 文字までです（`server/api/*/messages.post.ts`）。

### Cloudflare Workers でサブパスだけ転送する例

トンネルをそのまま公開せず、既存の Worker（別サイトと同じホスト名でサブパスだけ切り出したい場合）から
転送することもできます。`pathname` が対象サブパスのときだけトンネルのホストへ流します。

```js
export default {
  async fetch(request) {
    const url = new URL(request.url)

    // /vocaloid-hz/ だけをトンネル（origin.example.com）へ流す
    if (url.pathname === '/vocaloid-hz' || url.pathname.startsWith('/vocaloid-hz/')) {
      const upstream = new URL(request.url)
      upstream.hostname = 'origin.example.com' // ← トンネルのホスト名
      return fetch(new Request(upstream, request))
    }

    // それ以外は既存の処理へ（別サイトの配信など）
    return fetch(request)
  },
}
```

- Worker からの転送では **Host がトンネルのホスト名に変わる**ため、そのホスト名を
  `NUXT_DEV_ALLOWED_HOSTS`（本番は不要）に含めておく必要があります。
- SSE（`/api/board/events`・`/api/lounge/events`）と Vite の HMR WebSocket は
  そのまま `fetch` で中継できます（ストリームをバッファリングしないこと）。
- ルート配信にしたい場合は `NUXT_APP_BASE_URL` を付けずにビルドし、Worker 側でパスを書き換えます。

### Cloudflare Tunnel の例

```yaml
# ~/.cloudflared/config.yml（例。ホスト名は自分のものに置き換える）
tunnel: <tunnel-id>
credentials-file: /path/to/<tunnel-id>.json
ingress:
  - hostname: dev.example.com
    path: ^/vocaloid-hz/.*
    service: http://127.0.0.1:3120
  - service: http_status:404
```

```bash
PUBLIC_HOST=dev.example.com PUBLIC_BASE_PATH=/vocaloid-hz/ ./scripts/serve-public.sh
```

このとき `PUBLIC_HOST` は `NUXT_DEV_ALLOWED_HOSTS` として dev サーバーに渡されるため、
Vite の Host チェックで `403 Blocked request` になりません。

## 4. 起動ヘルパー（scripts/serve-public.sh）

| コマンド | 内容 |
| :--- | :--- |
| `./scripts/serve-public.sh` | dev（Vite）を `127.0.0.1:3120` で起動。DevTools は自動で無効化 |
| `./scripts/serve-public.sh prod` | ビルド済みの `.output` を起動（要 `npm run build`） |
| `./scripts/serve-public.sh stop` | 停止 |
| `./scripts/serve-public.sh status` | 起動状態と URL を表示 |

| 環境変数 | 既定 | 内容 |
| :--- | :--- | :--- |
| `PUBLIC_PORT` | `3120` | 待ち受けポート |
| `PUBLIC_BASE_PATH` | `/`（未設定なら `.env` の `NUXT_APP_BASE_URL`） | 配信パス（末尾スラッシュは自動補完） |
| `PUBLIC_HOST` | `dev.example.com`（未設定なら `.env` の `NUXT_DEV_ALLOWED_HOSTS`） | トンネルのホスト名（dev の Host 許可に使用） |

スクリプトは `.env` から `NUXT_DEV_ALLOWED_HOSTS` / `NUXT_APP_BASE_URL` を読みます
（優先順位は `PUBLIC_*` > `.env` > 既定値。周囲の環境変数には影響されません）。書いておけば `PUBLIC_*` を都度渡さずに同じ設定で起動できます。

ログは `/tmp/vocaloid-hz-public-<PORT>.log`、PID は `/tmp/vocaloid-hz-public-<PORT>.pid` に置かれます
（ポートごとに分かれているので、別ポートで起動しても取り違えません）。

## 5. 運用メモ

- **バックアップ**: SQLite は WAL モードです。`sqlite3 data/vocaloid.hz.db ".backup 'backup.db'"`
  を使うか、プロセス停止後に `.db` / `-wal` / `-shm` を 3 つまとめてコピーしてください。
- **AI ラウンジの定期実行**: `server/plugins/lounge-ai.ts` が 10 秒ごとに番を確認し、間隔（既定 2 分）を
  過ぎていれば店主の発言を書き込みます。リクエストに依存しないため、誰も開いていなくても会話が進みます。
  多重起動を避けるため、プロセスは 1 つで動かしてください。
- **DB の初期化**: 投稿をすべて消したいときは `npm run db:reset`（開発用）。本番ではバックアップを取ってから。
- **スキーマ更新**: `server/database/db.ts` の `SCHEMA_VERSION` を上げ、`initializeDatabase()` に
  差分の DDL を追加します（drizzle-kit のマイグレーションは未使用）。

## 6. 検索エンジン向け（favicon / sitemap / Search Console）

サブパス配信（`NUXT_APP_BASE_URL=/Vocaloid.hz/`）だと、置ける場所がホストのルートではないため、
次の 2 点に注意します。

### favicon

| URL | 実体 | 備考 |
| :--- | :--- | :--- |
| `/<base>/favicon.svg` | `public/favicon.svg` | 白地に水色の「v」。字形はヘッダーのロゴと同じ（`ui-monospace` 太字） |
| `/<base>/favicon.ico` | `public/favicon.ico` | 16/32/48/64 の 4 枚入り。SVG を見ない相手（タブ・検索エンジン）用 |

- `nuxt.config.ts` の `head.link` は **baseURL を前置**して書きます（`{ rel: 'icon' }` の href は
  Nuxt が自動で書き換えないため、前置しないと `https://<host>/favicon.ico` を指して別サイトを見に行きます）。
- 名前が固定の URL は CDN / ブラウザに残ります。`?v=<FAVICON_VERSION>` を付けて別 URL として取得させ、
  `routeRules` で `max-age=300` にしています。
- 図案を差し替える手順:
  1. `public/favicon.svg` の `<path>` を更新
  2. `scripts/generate-favicon.mjs` の `GEOMETRY` を同じ座標に揃えて `node scripts/generate-favicon.mjs`
  3. `nuxt.config.ts` の `FAVICON_VERSION` を上げる
  4. `NUXT_APP_BASE_URL=/Vocaloid.hz/ npm run build` → `PUBLIC_BASE_PATH=/Vocaloid.hz/ ./scripts/serve-public.sh prod`
- Cloudflare を通す場合、`/Vocaloid.hz/favicon.ico` などの**素の URL** は既定で 4 時間ほどエッジに残ります。
  すぐ切り替えたいときはダッシュボードの「キャッシュをパージ」で個別に消してください（`?v=` 付きは初回から新しくなります）。

### sitemap.xml

`server/routes/sitemap.xml.ts` が生成します（DB の公開レビュー・楽曲を全件列挙）。

```
https://track.wawa-app.me/Vocaloid.hz/sitemap.xml
```

- URL は `getRequestURL(event).origin` + `runtimeConfig.app.baseURL` で組み立てるので、トンネル越しでも
  正しい `https://<host>/Vocaloid.hz/...` になります。
- **robots.txt は置けません**。robots.txt はホストのルートにしか置けず、Google はサブディレクトリの
  robots.txt を読みません（このホストのルートは別アプリが返しています）。`Sitemap:` 行に頼らず、
  Search Console の「サイトマップ」に上記 URL を直接入力して送信してください。

### Search Console への登録

1. プロパティは**URL プレフィックス**で `https://track.wawa-app.me/Vocaloid.hz/` を登録します
   （ドメインプロパティは DNS がホスト単位のため、この構成では確認できません）。
2. 確認方法は「HTML タグ」を選び、表示された `content` の値を `.env` に書いて再起動します。

   ```
   NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<content の値>
   ```

   値が入っているときだけ `app.vue` が `<meta name="google-site-verification">` を出します
   （未設定ならタグは出ません）。確認が済んだら消しても構いません。
3. 「サイトマップ」に `sitemap.xml` の URL を送信します。
4. ファビコンは Google 側の取得にも時間がかかります（数日〜数週間）。表示されないときは
   Search Console の URL 検査でトップページをクロールし直すと早まることがあります。
