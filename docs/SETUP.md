# セットアップ（開発）

## 1. 必要環境

| 項目 | 要件 |
| :--- | :--- |
| Node.js | **22.12 以上**（better-sqlite3 13 が Node 22 以上、Nuxt 3.21 が `^20.19 || >=22.12` を要求） |
| npm | Node 同梱のもので可 |
| Ollama | AI ラウンジを使う場合のみ（[4. AI ラウンジ](#4-ai-ラウンジollama)） |

## 2. インストールと起動

```bash
npm install
cp .env.example .env   # 未設定のままで起動できます
npm run dev            # http://localhost:3000
```

初回起動時に次が自動で行われます。

1. `data/vocaloid.hz.db`（SQLite / WAL モード）とテーブルを作成（`PRAGMA user_version` でスキーマ版を管理）
2. `users` が空ならデモユーザー 4 名とデモ批評 7 本を seed（`server/database/content/` の Markdown）

### npm scripts

| script | 内容 |
| :--- | :--- |
| `npm run dev` | 開発サーバー（HMR） |
| `npm run dev:clean` | `.nuxt` を削除してから開発サーバー |
| `npm run build` | 本番ビルド（`.output/` を生成） |
| `npm run preview` | ビルド済みの Nitro サーバーを起動 |
| `npm run typecheck` | `vue-tsc` による型チェック |
| `npm run db:reset` | SQLite ファイルを削除（次回起動時に再作成・再 seed） |

## 3. 環境変数

`.env.example` に全項目とコメントがあります。主なものは次のとおりです。

| 変数 | 既定 | 用途 |
| :--- | :--- | :--- |
| `YOUTUBE_DATA_API_KEY` | 空 | YouTube Data API v3。再生数・マイルストーン表示（任意） |
| `NUXT_OLLAMA_URL` | `http://localhost:11434/api/chat` | Ollama の接続先 |
| `NUXT_OLLAMA_MODEL` | `gemma3:4b` | 使うモデル |
| `NUXT_OLLAMA_KEEP_ALIVE` | `5m` | VRAM に載せておく時間（`-1` で常時ロード） |
| `NUXT_LOUNGE_AI_INTERVAL_MS` | `120000` | 店主のひとりごとの間隔（ミリ秒） |
| `NUXT_DB_PATH` | `./data/vocaloid.hz.db` | SQLite の保存先 |
| `NUXT_SEED_PASSWORD` | `vocaloid.hz` | デモユーザーの初期パスワード（初回 seed のみ） |
| `NUXT_APP_BASE_URL` | `/` | サブパス配信時の baseURL（末尾スラッシュ必須） |
| `NUXT_DEV_ALLOWED_HOSTS` | 空 | dev サーバーをトンネル公開するときの許可ホスト（カンマ区切り） |
| `NUXT_GOOGLE_CLIENT_ID` / `NUXT_GOOGLE_CLIENT_SECRET` | 空 | Google OAuth（任意） |
| `NUXT_DISCORD_CLIENT_ID` / `NUXT_DISCORD_CLIENT_SECRET` | 空 | Discord OAuth（任意） |
| `NUXT_DISCORD_WEBHOOK_URL` / `_BOT_TOKEN` / `_CHANNEL_ID` | 空 | 旧チャット API（`POST /api/chat`）の Discord 中継（任意） |

`NUXT_*` は Nuxt の runtimeConfig に自動で反映されます（例: `ollamaUrl` ← `NUXT_OLLAMA_URL`）。

## 4. AI ラウンジ（Ollama）

```bash
ollama serve              # 起動していなければ
ollama pull gemma3:4b     # 既定モデル（約 3.3GB）
curl http://localhost:11434/api/ps   # ロード中のモデルを確認
```

- `/lounge` の「**店主を今読み込む**」を押すと `POST /api/lounge/warmup` が呼ばれ、先に VRAM へ読み込みます
- 使わなくなると `NUXT_OLLAMA_KEEP_ALIVE` の時間でアイドル（アンロード）に戻ります
- 未設定でもサイトは動きます（ラウンジの状態表示が「未設定」になるだけ）

## 5. OAuth（任意）

未設定のプロバイダーはログイン画面にボタンが出ません。設定すると `password: true` に加えて有効になります。

1. **Google**: Google Cloud Console で「OAuth クライアント ID（ウェブ アプリケーション）」を作成し、
   承認済みのリダイレクト URI に `http://localhost:3000/api/auth/oauth/google/callback` を追加
2. **Discord**: Discord Developer Portal でアプリを作成し、Redirect URI に
   `http://localhost:3000/api/auth/oauth/discord/callback` を追加
3. `.env` に client id / secret を設定して dev サーバーを再起動

本番ではリダイレクト URI を本番の origin に置き換えてください（`<origin>/api/auth/oauth/<provider>/callback`）。

## 6. YouTube Data API（任意）

Google Cloud で **YouTube Data API v3** を有効化して API キーを `YOUTUBE_DATA_API_KEY` に設定します。
再生数とマイルストーン（100 万回など）の表示に使います。未設定でも IFrame プレイヤーによる
埋め込み再生とタイトル・サムネイルの取得は動きます。

## 7. つまずきやすいところ

- **dev が `page reload data/vocaloid.hz.db-wal` を繰り返す**
  SQLite を書き換えるたびに Vite が再読み込みします。`nuxt.config.ts` の `ignore` で DB と
  `-wal` / `-shm` を監視対象外にしてあります。DB の場所を変えたら同じ要領で追加してください。
- **トンネル公開で `403 Blocked request`**
  Vite の Host チェック（DNS リバインディング対策）で弾かれています。
  `NUXT_DEV_ALLOWED_HOSTS` にホスト名を入れてください（`scripts/serve-public.sh` は `PUBLIC_HOST` を自動で渡します）。
- **トンネル公開で `426 Upgrade Required`**
  DevTools が張る WebSocket ルートが通常の GET を奪っています。`NUXT_DEVTOOLS_ENABLED=false` で起動してください。
- **テンプレート ref（自動スクロール、⌘K フォーカス）が dev で効かない**
  `nuxt.config.ts` の `devtools.componentInspector: false` で回避しています。dev の分割コンパイルで
  `bindingMetadata` が失われるためで、有効に戻すと壊れます。
- **型エラーを確認したい**
  `npm run typecheck`（`nuxt typecheck` = `vue-tsc`）

## 8. テストについて

現状このリポジトリに自動テストはありません。確認は次の手順で行っています。

1. `npm run typecheck`
2. `npm run dev` で起動し、トップ → 記事 → 楽曲 → 掲示板 → ラウンジ → エディタの順に操作
3. `/lounge` は Ollama 起動時と未起動時の両方を確認
