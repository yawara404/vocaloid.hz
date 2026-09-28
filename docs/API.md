# HTTP API 一覧

`server/api/**` のファイル構成がそのまま URL になります（Nuxt / Nitro のファイルベースルーティング）。
認証は httpOnly cookie `vhz_session` による自前セッションで、同一オリジンの `useFetch` / `$fetch` なら追加設定は不要です。

- **認証「要」** = `requireUser()` を通すため、未ログインだと `401 { message: 'ログインが必要です' }`
- 一覧系は `{ items, total, page, pageSize }`、単体系は DTO を直接返すか `{ message: ... }` で包みます
- 日時はおおむね ISO 8601 文字列です（SSE のカーソルは数値）

## 認証 / アカウント

| メソッド | パス | 認証 | 内容 |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/register` | – | `{ username, email, password, displayName? }`。作成後そのままログインし `201 { user }` |
| POST | `/api/auth/login` | – | `{ identifier, password }`。`identifier` はメールアドレスまたはユーザー名 |
| POST | `/api/auth/logout` | – | セッション破棄（cookie 削除） |
| GET | `/api/auth/session` | – | `{ user: AuthUserDto \| null }` |
| PUT | `/api/auth/preferences` | 要 | `{ themePreference: 'system' \| 'light' \| 'dark' }` をアカウントに保存 |
| GET | `/api/auth/providers` | – | `{ password: true, google: boolean, discord: boolean }`（env 設定状況） |
| GET | `/api/auth/oauth/:provider` | – | `provider` は `google` / `discord`。認可画面へリダイレクト（state を cookie 保存） |
| GET | `/api/auth/oauth/:provider/callback` | – | コードをトークン交換し、ユーザーを upsert してログイン |

## 批評（レビュー）

| メソッド | パス | 認証 | 内容 |
| :--- | :--- | :--- | :--- |
| GET | `/api/reviews` | – | 一覧。`?library=&category=&tag=&q=&author=&sort=&page=&pageSize=&status=` |
| GET | `/api/reviews/:slug` | – | 詳細（`:id` でも解決可）。本文 HTML・タイムスタンプ・評価・関連批評・再生数 |
| POST | `/api/reviews` | 要 | 新規作成。`{ title, contentMarkdown, category, track, excerpt?, tags?, status?, scores? }` |
| PUT | `/api/reviews/:slug` | 要（著者のみ） | 更新 |
| DELETE | `/api/reviews/:slug` | 要（著者のみ） | 削除 |
| PUT | `/api/reviews/:slug/like` | 要 | いいねする → `{ likeCount, likedByViewer: true }` |
| DELETE | `/api/reviews/:slug/like` | 要 | いいねを外す → `{ likeCount, likedByViewer: false }` |

`/api/reviews` のクエリ:

| パラメータ | 既定 | 内容 |
| :--- | :--- | :--- |
| `sort` | `new` | `new` / `old` / `words`（文字数） / `title` |
| `page` / `pageSize` | `1` / `20` | `pageSize` は 1〜50 に丸められる |
| `category` | – | `CATEGORY_ORDER` の値のみ有効（それ以外は無視） |
| `library` | – | 音声ライブラリ名（部分一致） |
| `tag` | – | タグの slug または名前 |
| `q` | – | 検索語。タイトル・抜粋・曲名・ボカロ P・ライブラリ・評者名に部分一致 |
| `author` | – | 評者のユーザー名。存在しない場合は空集合 |
| `status` | `published` | `draft` を指定すると下書きも対象 |

既定の画面（フィルターなし・`sort=new`・1 ページ目）のときだけ `featured`（特選 1 件）が入ります。

## 楽曲 / タグ / 検索

| メソッド | パス | 認証 | 内容 |
| :--- | :--- | :--- | :--- |
| GET | `/api/tracks` | – | ライブラリ一覧。`?library=&q=&page=&pageSize=`（`pageSize` は 1〜60、既定 24） |
| GET | `/api/tracks/:slug` | – | 楽曲詳細＋その楽曲に寄せられた批評一覧 |
| GET | `/api/tags` | – | タグ一覧（批評数つき）。`?limit=`（1〜200、既定 50） |
| GET | `/api/facets` | – | トップ右カラム用の集計 `{ libraries, categories, engines, tags, hallOfFame, stats }` |
| GET | `/api/search` | – | 横断検索。`?q=&synthesizer=&tag=&sort=`（`newest` / `reading_time` / `words`。最大 30 件） |

## 評者

| メソッド | パス | 認証 | 内容 |
| :--- | :--- | :--- | :--- |
| GET | `/api/users/:username` | – | `{ author, reviews, total }`。公開批評を新しい順に最大 50 件 |

## 掲示板

| メソッド | パス | 認証 | 内容 |
| :--- | :--- | :--- | :--- |
| GET | `/api/board/messages` | – | `?after=<cursor>` で差分取得 → `{ items }` |
| POST | `/api/board/messages` | 要 | `{ content }`（500 文字以内）→ `201 { message }`。連投は 1 秒制限で `429` |
| GET | `/api/board/events` | – | **SSE**。1 秒ごとに新着を確認し、あれば `data:` で push（`?after=`） |

## AI ラウンジ

| メソッド | パス | 認証 | 内容 |
| :--- | :--- | :--- | :--- |
| GET | `/api/lounge/messages` | – | `?after=<cursor>` で履歴取得 → `{ items }` |
| POST | `/api/lounge/messages` | 要 | `{ content }`（500 文字以内）。連投は 1 秒制限 → `{ message }` |
| GET | `/api/lounge/events` | – | **SSE**。新着メッセージと店主の状態（考え中か）を配信（ハートビート 20 秒） |
| GET | `/api/lounge/status` | – | `LoungeStatus`（`ollamaConfigured` / `ollamaReady` / `ollamaLoaded` / `ollamaExpiresAt` / `keepAlive` / `discordConfigured` / `model`） |
| POST | `/api/lounge/warmup` | – | 店主（gemma）を先に VRAM へ読み込む。未設定なら `501` |

店主（AI）の返事はリクエストではなくサーバー側が回します
（`server/utils/lounge-ai.ts` ＋ `server/plugins/lounge-ai.ts`、既定 2 分間隔）。
「店主さん」と呼ばれたときは間隔を待たずに返事をします。

## 旧チャット API

| メソッド | パス | 認証 | 内容 |
| :--- | :--- | :--- | :--- |
| POST | `/api/chat` | – | `{ messages: ChatMessage[], mode: 'ollama' \| 'discord' }`。`ollama` は NDJSON ストリームで中継、`discord` は Webhook へ送信 |

現在の画面は `/api/lounge/*` を使っていますが、互換用に残しています（`mode=ollama` が既定）。
