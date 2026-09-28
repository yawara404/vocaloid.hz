/**
 * server/middleware/theme.ts
 * ---------------------------------------------------------------
 * ログイン中ユーザーのテーマ設定（アカウントの控え）を event.context に載せる。
 * ページの SSR 時に <html data-theme-pref="..."> として描画され、
 * 「まだこの端末で何も選んでいない」ときの初期表示になる。
 *
 * 端末が最後に選んだ設定（localStorage）がある場合は、そちらが優先される
 * （nuxt.config.ts のインラインスクリプトが localStorage を先に見る）。
 *
 * HTML の描画に関係しないリクエスト（API・アセット・SSE）では DB を引かない。
 */
import { normalizeThemePreference } from '~~/shared/types'
import { getSessionUser } from '../utils/auth'

/** 静的アセットらしいパス（拡張子つき）かどうか */
const ASSET_PATH = /\.(?:js|mjs|css|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|txt|xml|json|webmanifest)$/i

export default defineEventHandler((event) => {
  const path = (event.path.split('?')[0] ?? '').toLowerCase()
  if (path.startsWith('/api/') || path.startsWith('/_') || ASSET_PATH.test(path)) return

  const user = getSessionUser(event)
  if (user) event.context.themePreference = normalizeThemePreference(user.themePreference)
})
