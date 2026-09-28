/**
 * server/utils/auth.ts
 * ---------------------------------------------------------------
 * 自前セッション認証（cookie + sessions テーブル）。
 *
 * 指示書は Better Auth / @sidebase/nuxt-auth を候補に挙げていたが、
 * 本実装では依存を増やさず、スキーマにある sessions テーブルを
 * セッションストアとして使う最小構成を採用している。
 *   - パスワード: scrypt（node:crypto）でハッシュ化
 *   - Google / Discord OAuth: 環境変数が設定されている場合のみ有効
 *     （server/api/auth/oauth/** で実装）
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { eq, lt } from 'drizzle-orm'
import { normalizeThemePreference, type AuthUserDto, type ThemePreference } from '~~/shared/types'
import { schema, useDb } from './db'
import type { User } from '../database/schema'

export const SESSION_COOKIE = 'vhz_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 日
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

/** scrypt 形式: `scrypt$<salt-hex>$<derived-hex>` */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password.normalize('NFKC'), salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [scheme, salt, digest] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !digest) return false
  try {
    const derived = scryptSync(password.normalize('NFKC'), salt, 64)
    const expected = Buffer.from(digest, 'hex')
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  }
  catch {
    return false
  }
}

export function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    provider: user.provider,
    themePreference: normalizeThemePreference(user.themePreference),
  }
}

/** 表示テーマの設定を保存する（本人のユーザー行のみ） */
export function setThemePreference(userId: string, preference: ThemePreference): void {
  useDb()
    .update(schema.users)
    .set({ themePreference: preference, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .run()
}

function isSecureRequest(event: H3Event): boolean {
  const proto = getHeader(event, 'x-forwarded-proto')
  if (proto) return proto.split(',')[0]!.trim() === 'https'
  return event.node.req.socket ? Boolean((event.node.req.socket as { encrypted?: boolean }).encrypted) : false
}

export function createSession(event: H3Event, userId: string): string {
  const db = useDb()
  const id = randomBytes(32).toString('hex')

  db.insert(schema.sessions)
    .values({
      id,
      userId,
      userAgent: getHeader(event, 'user-agent')?.slice(0, 255) ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    .run()

  // 期限切れセッションの掃除（軽量なので毎回実行）
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).run()

  setCookie(event, SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(event),
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })

  return id
}

export function destroySession(event: H3Event): void {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    useDb().delete(schema.sessions).where(eq(schema.sessions.id, token)).run()
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export function getSessionUser(event: H3Event): User | null {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const db = useDb()
  const row = db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, token))
    .get()

  if (!row) return null

  const expiresAt = row.session.expiresAt instanceof Date ? row.session.expiresAt : new Date(row.session.expiresAt)
  if (expiresAt.getTime() < Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run()
    return null
  }

  return row.user
}

export function requireUser(event: H3Event): User {
  const user = getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, message: 'ログインが必要です' })
  }
  return user
}
