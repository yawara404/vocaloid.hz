import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { schema } from './schema'
import { seedIfEmpty } from './seed'

const DB_DIR = process.env.NUXT_DB_DIR || resolve(process.cwd(), 'data')
const DB_PATH = process.env.NUXT_DB_PATH || resolve(DB_DIR, 'vocaloid.hz.db')

const SCHEMA_VERSION = 7

export type AppDatabase = BetterSQLite3Database<typeof schema>

/** server 側から `import { schema } from '../database/db'` で使えるよう再エクスポート */
export { schema }

/** 既存コード（server/utils/db.ts）が参照する別名 */
export type Db = AppDatabase

interface DatabaseHandle {
  db: AppDatabase
  sqlite: Database.Database
  path: string
}

let cachedDatabase: DatabaseHandle | null = null

/**
 * SQLite の接続ハンドル。パスが変わらない限り同じ接続を再利用する。
 * dev / SSR / スクリプトのいずれからも同じ DB を見せる。
 */
export function getDatabase(path: string = DB_PATH): DatabaseHandle {
  if (!cachedDatabase || cachedDatabase.path !== path) {
    mkdirSync(dirname(path), { recursive: true })

    const sqlite = new Database(path)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')

    cachedDatabase = { db: drizzle(sqlite, { schema }), sqlite, path }
  }

  return cachedDatabase
}

/** スクリプトから同期的に使うエスケープハッチ。アプリ側は server/utils/db.ts の useDb() を使う。 */
export function useLocalDatabase(path: string = DB_PATH): AppDatabase {
  return getDatabase(path).db
}

/**
 * テーブルを作成し、必要ならデモ批評をシードする。
 * PRAGMA user_version でスキーマ版を管理する（drizzle-kit migrations 未設定のため）。
 */
function initializeDatabase(): AppDatabase {
  const { db, sqlite } = getDatabase()

  const version = Number(sqlite.pragma('user_version', { simple: true }) ?? 0)
  if (version === SCHEMA_VERSION) return db

  // 既存のレビュー・ユーザー・セッションを保ったまま追加する。
  if (version >= 1 && version < SCHEMA_VERSION) {
    if (version === 1) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS review_likes (
          review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          PRIMARY KEY (review_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_review_likes_user ON review_likes(user_id);
      `)
    }
    if (version < 3) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS board_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );
        CREATE INDEX IF NOT EXISTS idx_board_messages_user ON board_messages(user_id);
      `)
    }
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS lounge_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'user',
        kind TEXT NOT NULL DEFAULT 'reply',
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_lounge_messages_user ON lounge_messages(user_id);
    `)
    if (version >= 4 && version < 6) {
      // 店主の独り言を区別するための列を足す（既存の会話はすべて返事扱い）
      sqlite.exec(`ALTER TABLE lounge_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'reply';`)
    }
    if (version < 5) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS lounge_ai_state (
          id INTEGER PRIMARY KEY,
          thinking_since INTEGER,
          next_turn_at INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO lounge_ai_state (id, thinking_since, next_turn_at) VALUES (1, NULL, 0);
      `)
    }
    if (version < 7) {
      // 表示テーマの設定（system / light / dark）。既存ユーザーは「端末に合わせる」から始める
      sqlite.exec(`ALTER TABLE users ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system';`)
    }
    sqlite.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`)
    return db
  }

  if (version !== 0) {
    throw new Error(`未対応のデータベーススキーマ版です: ${version}`)
  }

  db.run(sql`PRAGMA foreign_keys = OFF`)

  // 子 → 親 の順で落とす
  db.run(sql`DROP TABLE IF EXISTS review_tags`)
  db.run(sql`DROP TABLE IF EXISTS review_likes`)
  db.run(sql`DROP TABLE IF EXISTS lounge_ai_state`)
  db.run(sql`DROP TABLE IF EXISTS lounge_messages`)
  db.run(sql`DROP TABLE IF EXISTS board_messages`)
  db.run(sql`DROP TABLE IF EXISTS sessions`)
  db.run(sql`DROP TABLE IF EXISTS reviews`)
  db.run(sql`DROP TABLE IF EXISTS tracks`)
  db.run(sql`DROP TABLE IF EXISTS tags`)
  db.run(sql`DROP TABLE IF EXISTS users`)

  db.run(sql`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      avatar_url TEXT,
      bio TEXT,
      x_username TEXT,
      discord_id TEXT,
      google_id TEXT,
      provider TEXT NOT NULL DEFAULT 'password',
      theme_preference TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  db.run(sql`
    CREATE TABLE tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      producer_name TEXT NOT NULL,
      voice_synthesizer TEXT NOT NULL,
      engine_type TEXT,
      release_year INTEGER NOT NULL,
      youtube_video_id TEXT NOT NULL,
      spotify_track_id TEXT,
      slug TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  db.run(sql`
    CREATE TABLE reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content_markdown TEXT NOT NULL,
      content_html TEXT,
      excerpt TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      reading_time_minutes INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL DEFAULT 'lyrics',
      score_lyrics INTEGER,
      score_tuning INTEGER,
      score_structure INTEGER,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_hall_of_fame INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      published_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  db.run(sql`
    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    )
  `)

  db.run(sql`
    CREATE TABLE review_tags (
      review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (review_id, tag_id)
    )
  `)

  db.run(sql`
    CREATE TABLE review_likes (
      review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY (review_id, user_id)
    )
  `)

  db.run(sql`
    CREATE TABLE board_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  db.run(sql`
    CREATE TABLE lounge_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'user',
      kind TEXT NOT NULL DEFAULT 'reply',
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  db.run(sql`
    CREATE TABLE lounge_ai_state (
      id INTEGER PRIMARY KEY,
      thinking_since INTEGER,
      next_turn_at INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.run(sql`INSERT OR IGNORE INTO lounge_ai_state (id, thinking_since, next_turn_at) VALUES (1, NULL, 0)`)

  db.run(sql`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  db.run(sql`PRAGMA foreign_keys = ON`)
  db.run(sql.raw(`PRAGMA user_version = ${SCHEMA_VERSION}`))

  db.run(sql`CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews(published_at DESC)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_reviews_category ON reviews(category)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_tracks_slug ON tracks(slug)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_tracks_library ON tracks(voice_synthesizer)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_review_likes_user ON review_likes(user_id)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_board_messages_user ON board_messages(user_id)`)
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_lounge_messages_user ON lounge_messages(user_id)`)

  seedIfEmpty(db)

  return db
}

let initialized = false

/**
 * DB を使える状態で返す（DDL 作成 + seed はプロセス内で初回のみ実行）。
 * アプリ本体（server/utils/db.ts → useDb()）はこれを使う。
 */
export function getDb(): AppDatabase {
  if (!initialized) {
    initializeDatabase()
    initialized = true
  }

  return getDatabase().db
}

/** Nitro プラグイン等から呼ぶ async 版（中身は同期処理）。 */
export async function ensureDatabase(): Promise<AppDatabase> {
  return getDb()
}
