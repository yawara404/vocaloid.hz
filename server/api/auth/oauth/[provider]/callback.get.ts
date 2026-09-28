/**
 * GET /api/auth/oauth/:provider/callback
 * 認可コードをトークンに交換し、プロフィールを取得してユーザーを upsert する。
 */
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createSession } from '../../../../utils/auth'
import { schema, useDb } from '../../../../utils/db'
import {
  exchangeCode,
  fetchOAuthProfile,
  isOAuthProvider,
  isProviderEnabled,
  type OAuthProvider,
} from '../../../../utils/oauth'

const stateCookieName = (provider: string) => `vhz_oauth_state_${provider}`

function ensureUniqueUsername(db: ReturnType<typeof useDb>, hint: string): string {
  let username = hint.slice(0, 24) || `user_${randomBytes(3).toString('hex')}`

  for (let attempt = 0; attempt < 50; attempt++) {
    const clash = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username)).get()
    if (!clash) return username
    username = `${hint.slice(0, 18)}_${randomBytes(2).toString('hex')}`
  }

  return `user_${Date.now().toString(36)}`
}

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  if (!isOAuthProvider(provider)) {
    throw createError({ statusCode: 404, message: '未対応のプロバイダーです' })
  }
  if (!isProviderEnabled(provider)) {
    throw createError({ statusCode: 501, message: `${provider} 認証は環境変数が未設定のため無効です` })
  }

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const state = typeof query.state === 'string' ? query.state : ''

  const cookieName = stateCookieName(provider)
  const expectedState = getCookie(event, cookieName)
  deleteCookie(event, cookieName, { path: '/' })

  if (!code || !state || !expectedState || state !== expectedState) {
    throw createError({ statusCode: 400, message: 'OAuth の state 検証に失敗しました。もう一度やり直してください' })
  }

  const accessToken = await exchangeCode(event, provider, code)
  const profile = await fetchOAuthProfile(provider, accessToken)

  const db = useDb()
  const providerIdColumn = provider === 'google' ? schema.users.googleId : schema.users.discordId

  let user
    = db.select().from(schema.users).where(eq(providerIdColumn, profile.providerUserId)).get()
    ?? (profile.email
      ? db.select().from(schema.users).where(eq(schema.users.email, profile.email)).get()
      : undefined)

  const providerPatch = provider === 'google'
    ? { googleId: profile.providerUserId }
    : { discordId: profile.providerUserId }

  if (user) {
    user = db
      .update(schema.users)
      .set({
        ...providerPatch,
        provider: provider as OAuthProvider,
        displayName: user.displayName || profile.displayName,
        avatarUrl: user.avatarUrl ?? profile.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id))
      .returning()
      .get()
  }
  else {
    user = db
      .insert(schema.users)
      .values({
        username: ensureUniqueUsername(db, profile.usernameHint),
        displayName: profile.displayName,
        email: profile.email ?? `${provider}_${profile.providerUserId}@oauth.vocaloidhz.local`,
        avatarUrl: profile.avatarUrl,
        provider: provider as OAuthProvider,
        ...providerPatch,
      })
      .returning()
      .get()
  }

  createSession(event, user.id)

  return sendRedirect(event, '/')
})
