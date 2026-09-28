# vocaloid.hz（ボーカロイド・ヘルツ）

> 好きなボカロを、読んで語れるボカれびゅサイト。
>
> **公開サイト**: <https://track.wawa-app.me/Vocaloid.hz/>

SNS のタイムラインで流れて消えてしまうボカロ曲のレビュー・歌詞考察・アルバム総括を、
**流れずに残るストック型の批評アーカイブ**として読むためのサイトです。
数字（再生数・フォロワー数）の競争は扱わず、作品の中身と聴取体験だけを話題にします。

- **構成**: Nuxt 3（Vue 3 + TypeScript / SSR）＋ Nitro サーバー API
- **データ**: SQLite（better-sqlite3）＋ Drizzle ORM。スキーマ作成とデモデータの投入は初回起動時に自動
- **見た目**: Tailwind CSS ＋ @tailwindcss/typography。ライト / ダークの 2 テーマ（端末設定に追従、アカウントにも保存）
- **音楽**: YouTube IFrame Player API（再生バー・本文タイムスタンプ連動）、YouTube Data API v3（任意・再生数表示）
- **AI**: Ollama（gemma3）による「AI ラウンジ」。店主が常駐し、相づちと豆知識を返す共有チャット
- **認証**: 自前セッション（scrypt ハッシュ ＋ httpOnly cookie）。Google / Discord OAuth は env 設定時のみ有効

## 主な機能

- **批評（レビュー）**: Markdown で執筆、目次自動生成、読了時間・文字数、多面的評価（歌詞 / 調声 / 構成）、
  カテゴリ・タグ・殿堂入り、いいね、関連批評。著者のみ編集・削除可
- **楽曲ライブラリ**: ボカロ P・音声ライブラリ・エンジン・発表年で整理。YouTube 動画 ID から埋め込み再生
- **探す**: ライブラリ / カテゴリ / エンジン / タグのファセット絞り込みと横断検索
- **掲示板**: Server-Sent Events によるリアルタイム更新
- **AI ラウンジ**: 店主（gemma）が「店主さん」と呼びかけられれば即応答、呼ばれていなければ約 2 分に 1 回ひとりごと
- **読書体験**: 固定ヘッダーの読了プログレス、追従する右カラム目次、モバイル用目次ボトムシート、
  画面下固定の再生バー（YouTube の再生位置と同期）
- **旧チャット API**: Discord Webhook / Bot への中継（`NUXT_DISCORD_*` を設定した場合のみ）

## クイックスタート

```bash
git clone https://github.com/<your-account>/vocaloid.hz.git
cd vocaloid.hz
npm install
cp .env.example .env   # 未設定でも起動できます（YouTube / Ollama / OAuth は任意）
npm run dev            # http://localhost:3000（サブパス配信にする場合は NUXT_APP_BASE_URL=/Vocaloid.hz/ を設定して http://localhost:3000/Vocaloid.hz/）
```

- 必要環境: **Node.js 22.12 以上**（better-sqlite3 13 が Node 22 以上を要求）
- 初回起動時に `data/vocaloid.hz.db` を作成し、デモユーザーと批評 7 本を seed します
- AI ラウンジを使う場合は Ollama を起動して `ollama pull gemma3:4b`（[docs/SETUP.md](docs/SETUP.md)）
- 公開は**サブパス配信**です（`NUXT_APP_BASE_URL=/Vocaloid.hz/`）。ビルド時に埋め込まれるため、
  公開 URL もローカルの URL もベースパス `/Vocaloid.hz/` が付きます（[docs/DEPLOY.md](docs/DEPLOY.md)）

### デモアカウント

| ユーザー名 | パスワード | 備考 |
| :--- | :--- | :--- |
| `demo` | `vocaloid.hz` | デモ用。編集・投稿の動作確認に |
| `kiritzubo` / `amane` / `shirogane` | `vocaloid.hz` | デモ批評の評者 |

パスワードは初回 seed にのみ使われ、`NUXT_SEED_PASSWORD` で変更できます（本番では必ず変更してください）。

## 画面

パスは公開ベース（<https://track.wawa-app.me/Vocaloid.hz/>）からの相対です
（例: `/reviews` → <https://track.wawa-app.me/Vocaloid.hz/reviews>）。

| パス | 内容 |
| :--- | :--- |
| `/` | トップ（特選 1 件 ＋ 注目グリッド ＋ 最新タイムライン） |
| `/reviews` | 批評アーカイブ（ファセット絞り込み・並び替え・ページング） |
| `/reviews/:slug` | 記事詳細（本文 ＋ 目次 ＋ 楽曲データ ＋ 関連批評） |
| `/tracks` `/tracks/:slug` | 楽曲ライブラリ / 楽曲ページ（寄せられた批評一覧） |
| `/board` | 掲示板（SSE でリアルタイム更新） |
| `/lounge` | AI ラウンジ（店主 gemma と来客の共有チャット） |
| `/search` | 曲・評者・タグの横断検索 |
| `/users/:username` | 評者プロフィールと公開批評一覧 |
| `/editor` `/editor/:slug` | 批評の執筆・編集（要ログイン、2 ペインのライブプレビュー） |
| `/login` | ログイン / 新規登録（パスワード ＋ OAuth） |

## ディレクトリ構成

```text
components/  画面部品（カード、プレイヤー、目次、評価メーター、サイドバーなど）
composables/ useTheme / useMediaQuery / useReviewToc
data/        SQLite の保存先（gitignore 済み・起動時に自動生成）
docs/        ドキュメント（下の一覧）
layouts/     アプリ共通の外枠（layouts/default.vue）
pages/       画面（Nuxt のファイルベースルーティング）
plugins/     テーマの初期化
public/      静的ファイル（favicon）
scripts/     DB リセット・.nuxt クリーン・公開トンネル用ヘルパー
server/
  api/       REST / SSE エンドポイント（[docs/API.md](docs/API.md)）
  database/  スキーマ・DDL・デモ seed（批評本文は content/ 以下の Markdown）
  plugins/   AI ラウンジの定期実行
  utils/     認証・DB・レビュー・YouTube・Ollama などのサーバー処理
shared/      client / server 共有の型、Markdown と YouTube のユーティリティ
stores/      Pinia（auth / player）
```

## ドキュメント

| ドキュメント | 内容 |
| :--- | :--- |
| [docs/SETUP.md](docs/SETUP.md) | 開発環境・環境変数・Ollama / OAuth / YouTube API の設定 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 本番ビルド、サブパス配信、トンネル公開、運用の注意 |
| [docs/API.md](docs/API.md) | HTTP API 一覧（認証要否つき） |
| [docs/LAYOUT_ARCHITECTURE.md](docs/LAYOUT_ARCHITECTURE.md) | 画面レイアウト / Z 軸の重なり順 / レスポンシブ仕様 |
| [docs/DESIGN_SPEC.md](docs/DESIGN_SPEC.md) | 企画時の要件定義（初期ブレスト・実装と異なる候補も含む） |

## 公開リポジトリとしての注意

- API キー、OAuth のクライアントシークレット、Discord Webhook、公開用トンネルのホスト名などは
  **すべて環境変数**で渡します（リポジトリには `.env.example` だけを置いています）。
- `data/*.db` には投稿本文・セッションが入るため gitignore 済みです。バックアップも公開しないでください。
- リバースプロキシやトンネルを挟む場合は `X-Forwarded-Proto: https` を渡してください
  （セッション cookie に `Secure` が付きます）。
- **サブパス配信**のときは `NUXT_APP_BASE_URL` を末尾スラッシュ付きで指定してビルドします
  （例: `/Vocaloid.hz/`）。値はビルド時に埋め込まれるため、変更したら再ビルドが必要です。
- デモユーザーのパスワードは初回 seed のみに使われます。本番 seed 時は `NUXT_SEED_PASSWORD` を必ず変更してください。

## ライセンス

ISC（[LICENSE](LICENSE) 参照）
