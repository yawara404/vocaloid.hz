/**
 * vocaloid.hz - Drizzle ORM スキーマ定義（SQLite）
 * ---------------------------------------------------------------
 * 指示書の pgTable 定義を SQLite 方言に置き換えたもの。
 * PostgreSQL へ移行する場合は `sqliteTable` → `pgTable`、
 * integer(..., { mode: 'timestamp_ms' }) → timestamp(...) に読み替えるだけでよい。
 */
import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const nowMs = sql`(unixepoch() * 1000)`

/** 1. users */
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  /** OAuth -only アカウントでは null */
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  xUsername: text('x_username'),
  discordId: text('discord_id'),
  googleId: text('google_id'),
  provider: text('provider').notNull().default('password'),
  /**
   * 表示テーマの設定。'system' は端末（prefers-color-scheme）に従う。
   * 色そのものは CSS 変数が持ち、ここには「どのモードで見るか」だけを保存する。
   */
  themePreference: text('theme_preference').notNull().default('system'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** セッション（Better Auth 未導入のため自前セッションストア） */
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** 2. tracks */
export const tracks = sqliteTable('tracks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  producerName: text('producer_name').notNull(),
  voiceSynthesizer: text('voice_synthesizer').notNull(),
  /** VOCALOID / UTAU / CeVIO AI / Synthesizer V AI 等 */
  engineType: text('engine_type'),
  releaseYear: integer('release_year').notNull(),
  youtubeVideoId: text('youtube_video_id').notNull(),
  spotifyTrackId: text('spotify_track_id'),
  slug: text('slug').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** 3. reviews */
export const reviews = sqliteTable('reviews', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  trackId: text('track_id')
    .notNull()
    .references(() => tracks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  contentMarkdown: text('content_markdown').notNull(),
  contentHtml: text('content_html'),
  excerpt: text('excerpt').notNull(),
  wordCount: integer('word_count').notNull().default(0),
  readingTimeMinutes: integer('reading_time_minutes').notNull().default(1),
  /** lyrics | tuning | album | essay */
  category: text('category').notNull().default('lyrics'),
  scoreLyrics: integer('score_lyrics'),
  scoreTuning: integer('score_tuning'),
  scoreStructure: integer('score_structure'),
  isFeatured: integer('is_featured').notNull().default(0),
  isHallOfFame: integer('is_hall_of_fame').notNull().default(0),
  status: text('status').notNull().default('published'),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** 4. tags & review_tags */
export const tags = sqliteTable('tags', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
})

export const reviewTags = sqliteTable(
  'review_tags',
  {
    reviewId: text('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.reviewId, table.tagId] })],
)

/** ユーザーごとに各批評へ一度だけ付けられるいいね */
export const reviewLikes = sqliteTable(
  'review_likes',
  {
    reviewId: text('review_id').notNull().references(() => reviews.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  table => [primaryKey({ columns: [table.reviewId, table.userId] })],
)

/** 掲示板のリアルタイムチャット */
export const boardMessages = sqliteTable('board_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/**
 * AI ラウンジの共有チャット。
 * 来客の発言（role='user'）と店主（gemma）の発言（role='assistant', user_id = null）を
 * 同じ部屋のログとして残す。全員が同じ会話を見る。
 */
export const loungeMessages = sqliteTable('lounge_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** AI（店主）の発言は null */
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  /** 'user' | 'assistant' */
  role: text('role').notNull().default('user'),
  /** 店主の発言の種類: 'reply'（呼ばれて答えた） | 'monologue'（独り言） */
  kind: text('kind').notNull().default('reply'),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/**
 * 共有チャットの店主（AI）の状態。1 行（id = 1）だけを使う。
 * dev では Nitro が複数インスタンス立ち上がることがあるため、
 * 「返事中か」「次の番はいつか」を DB に持たせて二重返事を防ぐ。
 */
export const loungeAiState = sqliteTable('lounge_ai_state', {
  id: integer('id').primaryKey(),
  /** 返事を作っている最中の時刻。null なら待機中 */
  thinkingSince: integer('thinking_since', { mode: 'timestamp_ms' }),
  /** 次に店主が話せる時刻 */
  nextTurnAt: integer('next_turn_at', { mode: 'timestamp_ms' }).notNull(),
})

export type User = typeof users.$inferSelect
export type Track = typeof tracks.$inferSelect
export type Review = typeof reviews.$inferSelect
export type Tag = typeof tags.$inferSelect

export const schema = { users, sessions, tracks, reviews, tags, reviewTags, reviewLikes, boardMessages, loungeMessages, loungeAiState }
