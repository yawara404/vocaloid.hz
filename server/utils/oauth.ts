/**
 * server/utils/oauth.ts
 * Google / Discord OAuth の最低限実装（依存ライブラリなし / global fetch）。
 * 環境変数（runtimeConfig）が未設定のプロバイダーは無効として扱う。
 */
import type { H3Event } from 'h3'

export type OAuthProvider = 'google' | 'discord'

export interface OAuthProfile {
  provider: OAuthProvider
  providerUserId: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  usernameHint: string
}

interface ProviderConfig {
  authorizeUrl: string
  tokenUrl: string
  scope: string
}

const CONFIG: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  discord: {
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
  },
}

export function isOAuthProvider(value: string | undefined): value is OAuthProvider {
  return value === 'google' || value === 'discord'
}

function credentials(provider: OAuthProvider) {
  const config = useRuntimeConfig()
  return provider === 'google'
    ? { clientId: config.googleClientId, clientSecret: config.googleClientSecret }
    : { clientId: config.discordClientId, clientSecret: config.discordClientSecret }
}

export function isProviderEnabled(provider: OAuthProvider): boolean {
  const { clientId, clientSecret } = credentials(provider)
  return Boolean(clientId && clientSecret)
}

export function redirectUri(event: H3Event, provider: OAuthProvider): string {
  const origin = getRequestURL(event).origin
  // サブパス配信（NUXT_APP_BASE_URL）でも正しい URI になるよう baseURL を前置する
  const baseURL = (useRuntimeConfig().app.baseURL || '/').replace(/\/+$/, '')
  return `${origin}${baseURL}/api/auth/oauth/${provider}/callback`
}

export function buildAuthorizeUrl(event: H3Event, provider: OAuthProvider, state: string): string {
  const { clientId } = credentials(provider)
  const url = new URL(CONFIG[provider].authorizeUrl)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri(event, provider))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', CONFIG[provider].scope)
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeCode(event: H3Event, provider: OAuthProvider, code: string): Promise<string> {
  const { clientId, clientSecret } = credentials(provider)
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(event, provider),
  })

  const response = await $fetch<{ access_token: string }>(CONFIG[provider].tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: body.toString(),
  })

  if (!response?.access_token) {
    throw createError({ statusCode: 502, message: 'アクセストークンの取得に失敗しました' })
  }

  return response.access_token
}

function sanitizeUsernameHint(value: string, fallback: string): string {
  const base = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 24)
  return base || fallback
}

export async function fetchOAuthProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
  if (provider === 'google') {
    const profile = await $fetch<{
      sub: string
      email?: string
      email_verified?: boolean
      name?: string
      picture?: string
    }>('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${accessToken}` },
    })

    return {
      provider,
      providerUserId: profile.sub,
      email: profile.email_verified ? (profile.email ?? null) : null,
      displayName: profile.name ?? 'Google ユーザー',
      avatarUrl: profile.picture ?? null,
      usernameHint: sanitizeUsernameHint(profile.email?.split('@')[0] ?? '', `google_${profile.sub.slice(0, 8)}`),
    }
  }

  const profile = await $fetch<{
    id: string
    email?: string
    verified?: boolean
    global_name?: string | null
    username: string
    avatar?: string | null
  }>('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  return {
    provider,
    providerUserId: profile.id,
    email: profile.verified ? (profile.email ?? null) : null,
    displayName: profile.global_name || profile.username,
    avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
    usernameHint: sanitizeUsernameHint(profile.username, `discord_${profile.id.slice(0, 8)}`),
  }
}
