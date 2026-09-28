/**
 * PUT /api/auth/preferences
 * 表示テーマの設定（system / light / dark）をサーバーに保存する。
 * 「最後に選んだ設定」をアカウントに持たせることで、別の端末でも同じ表示になる。
 */
import { THEME_PREFERENCES, normalizeThemePreference, type ThemePreference } from '~~/shared/types'
import { requireUser, setThemePreference } from '../../utils/auth'

export default defineEventHandler(async (event): Promise<{ themePreference: ThemePreference }> => {
  const user = requireUser(event)

  const body = await readBody<{ theme?: unknown }>(event).catch(() => null)
  const theme = String(body?.theme ?? '')
  if (!THEME_PREFERENCES.includes(theme as ThemePreference)) {
    throw createError({ statusCode: 400, message: 'theme は system / light / dark のいずれかを指定してください' })
  }

  const preference = normalizeThemePreference(theme)
  setThemePreference(user.id, preference)

  return { themePreference: preference }
})
