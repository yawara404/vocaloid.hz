> このドキュメントは実装前の要件定義（ブレインストーミング）です。実装の現状は
> [`../README.md`](../README.md) と [`LAYOUT_ARCHITECTURE.md`](./LAYOUT_ARCHITECTURE.md) を参照してください。
> 実装時に採用しなかった候補（Better Auth / Prisma / PostgreSQL など）も含まれます。


# プロジェクト指示書: vocaloid.hz（ボーカロイド・ヘルツ）

## 1. プロジェクト概要と開発思想
- **名称**: vocaloid.hz（ボーカロイド・ヘルツ）
- **コンセプト**: 「周波数を合わせるように、ボカロを読む」。SNSのタイムラインで流れて消えてしまうボカロ楽曲の長文レビュー、歌詞考察、アルバム総括を永続アーカイブする、ストック型の音楽批評フォーラム。
- **UI/UXゴール**: 数字競争（フォロワー数、いいね数、インプレッション）を排除し、夜間に一人で音楽を聴きながら長文を耽読できる、落ち着いたマガジン調のUI（しずかなインターネットやMediumのような洗練された読書体験）。

---

## 2. 技術スタック（Vue 3 / Nuxt 3 構成）
- **Framework**: **Nuxt 3 (Vue 3)**
- **Language**: TypeScript
- **Styling**: Tailwind CSS, @tailwindcss/typography
- **State Management**: Pinia
- **Database**: SQLite (開発初期/自鯖運用) または PostgreSQL
- **ORM**: Drizzle ORM (または Prisma)
- **Authentication**: **Better Auth** または **@sidebase/nuxt-auth**
  - プロバイダー: **Email (Magic Link / パスワード)**, **Google OAuth**, **Discord OAuth**
- **Markdown / Parser**: markdown-it (または unist / remark) + DOMPurify (サニタイズ必須)
- **Player API**: YouTube IFrame Player API (Vue 3 Composableで状態管理)
- **AI / Bot**: Ollama (Gemma 2) または Discord Bot API連携

---

## 3. 主要画面と機能要件

### A. トップページ (`pages/index.vue`)
1. **Feature（注目の批評カード）**:
   - ピックアップされた高品質な批評記事を1件大きくカード表示。
   - ジャケット画像、曲名、ボカロP、使用ライブラリ、記事タイトル、評者、読了目安時間、本文抜粋（150字程度）。
2. **フィルターバー**:
   - 音声ライブラリ別（All / 初音ミク / 重音テト / 可不 / 花隈千冬 等）
   - カテゴリ別（歌詞考察 / 調声論 / アルバム総括 / 新着順）
3. **批評アーカイブ一覧 (2カラム)**:
   - 左カラム (70%): 批評カードリスト（タイトル、曲名、評者名、文字数、タグ）。
   - 右カラム (30%): 「vocaloid.hzの思想」「殿堂入り批評」「注目のライブラリタグ」「AIラウンジへの案内バナー」。

### B. 個別レビュー閲覧ページ (`pages/reviews/[slug].vue`)
1. **上部固定オーディオプレイヤー (Sticky Player)**:
   - 画面最上部に追従するミニマルプレイヤー。
   - YouTube公式プレイヤーを埋め込み、Vue 3のリアクティブステートで再生/停止、シーク位置を制御。
2. **タイムスタンプ連動機能 (最重要キラー機能)**:
   - 本文中に書かれた `[01:23]` や `[02:15]` 形式のタイムスタンプ記法を検知し、クリック可能なインラインボタン（`<button class="timestamp-btn" @click="seekTo(秒)">`）に変換。
   - クリック時、上部のYouTubeプレイヤーが指定秒数へ即座にシークして再生を開始する。
3. **本文エリア (最大幅 720px の 1カラム)**:
   - 雑誌のような可読性を持つタイポグラフィ（文字サイズ 16〜17px、line-height 1.85、letter-spacing 0.03em）。
4. **多面的分析評価メーター**:
   - 5段階の星評価ではなく、定性的な特徴メーターを表示（歌詞の文学性、調声アプローチ、音響構造の複雑さ）。

### C. 批評執筆・編集エディタ (`pages/editor/index.vue`, `pages/editor/[id].vue`)
1. **Vue 3 リアクティブエディタ**:
   - 入力欄とリアルタイムプレビューの2画面分割（またはタブ切替）。
2. **楽曲メタデータ設定フォーム**:
   - 楽曲タイトル（必須）、ボカロP名（必須）、音声合成ライブラリ（セレクト/自由入力）。
   - YouTube動画URL（必須・動画ID自動抽出ロジック含む）。
   - 批評タイトル、抜粋文、タグ入力。

### D. AI・Discord ボットラウンジ (`pages/lounge.vue`)
深夜の音楽談話室をイメージした、AI案内人 / Discordボットと対話できる専用ページ。
1. **UIデザイン**:
   - 画面全体をレトロかつモダンなターミナル / チャットUI（Discord風の落ち着いたダークトーン）で構築。
2. **バックエンド連携（どちらか、または両方の切り替え対応）**:
   - **Ollama (Gemma) 連携**: 自鯖またはローカルで動作するOllamaのAPI（`http://localhost:11434/api/chat`）をNuxtのサーバーAPI（`server/api/chat.post.ts`）経由で叩き、ボカロの楽曲レコメンドや批評の壁打ちを行うストリーミングチャット。
   - **Discord Bot 連携**: Discordサーバーの特定チャンネルとWebhook / Bot APIで中継し、Web上からDiscordコミュニティへメッセージを送受信・表示できる機構。
3. **ボットのキャラクター設定**:
   - 「vocaloid.hzのレコード店番」。ボカロの歴史やマイナー曲に詳しく、ユーザーが「〇〇みたいな曲ない？」「この歌詞どう思う？」と尋ねると、独自の解釈やおすすめ曲を提示する。

---

## 4. データベース設計（Drizzle ORM / SQLite or PostgreSQL）

### スキーマ定義の概要

```typescript
// 1. users テーブル
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: varchar('username', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  xUsername: varchar('x_username', { length: 50 }),
  discordId: varchar('discord_id', { length: 100 }), // Discord連携用
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// 2. tracks テーブル
export const tracks = pgTable('tracks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: varchar('title', { length: 255 }).notNull(),
  producerName: varchar('producer_name', { length: 255 }).notNull(),
  voiceSynthesizer: varchar('voice_synthesizer', { length: 100 }).notNull(),
  engineType: varchar('engine_type', { length: 50 }), // VOCALOID, CeVIO, Synthesizer V 等
  releaseYear: integer('release_year').notNull(),
  youtubeVideoId: varchar('youtube_video_id', { length: 50 }).notNull(),
  spotifyTrackId: varchar('spotify_track_id', { length: 50 }),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. reviews テーブル
export const reviews = pgTable('reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trackId: text('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  contentMarkdown: text('content_markdown').notNull(),
  contentHtml: text('content_html'),
  excerpt: text('excerpt').notNull(),
  wordCount: integer('word_count').notNull().default(0),
  readingTimeMinutes: integer('reading_time_minutes').notNull().default(1),
  scoreLyrics: integer('score_lyrics'), // 1-5
  scoreTuning: integer('score_tuning'), // 1-5
  scoreStructure: integer('score_structure'), // 1-5
  status: varchar('status', { length: 20 }).notNull().default('published'), // 'draft' | 'published'
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. tags & review_tags
export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 50 }).notNull().unique(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
});

export const reviewTags = pgTable('review_tags', {
  reviewId: text('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});