/**
 * GET /api/auth/oauth/:provider
 * Google / Discord の認可画面へリダイレクトする（state を cookie に保存）
 */
import { randomBytes } from 'node:crypto'
import { buildAuthorizeUrl, isOAuthProvider, isProviderEnabled } from '../../../utils/oauth'

/** callback 側と同じ名前を使う（server/api/auth/oauth/[provider]/callback.get.ts） */
const stateCookieName = (provider: string) => `vhz_oauth_state_${provider}`

export default defineEventHandler((event) => {
  const provider = getRouterParam(event, 'provider')
  if (!isOAuthProvider(provider)) {
    throw createError({ statusCode: 404, message: '未対応のプロバイダーです' })
  }
  if (!isProviderEnabled(provider)) {
    throw createError({
      statusCode: 501,
      message: `${provider} 認証は環境変数（client id / secret）が未設定のため無効です`,
    })
  }

  const state = randomBytes(16).toString('hex')
  const secure = getRequestURL(event).protocol === 'https:'

  setCookie(event, stateCookieName(provider), state, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 600,
  })

  return sendRedirect(event, buildAuthorizeUrl(event, provider, state))
})
