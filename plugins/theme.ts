/**
 * plugins/theme.ts
 * ---------------------------------------------------------------
 * SSR のときだけ、ログイン中ユーザーのテーマ設定（アカウントの控え）を
 * <html data-theme-pref="system|light|dark"> として描画する。
 *
 * これを受け取った nuxt.config.ts のインラインスクリプトが、初回描画の前に
 * <html data-theme="light|dark"> を確定させる（FOUC なし）。
 * ただし採用されるのは「この端末に保存された設定（localStorage）が無いとき」だけ。
 * 端末で最後に選んだ設定のほうが強い（優先順位は composables/useTheme.ts と同じ）。
 *
 * クライアント側では head で管理しない。属性はインラインスクリプトと
 * useTheme() が持つ。
 */
import { normalizeThemePreference } from '~~/shared/types'

export default defineNuxtPlugin(() => {
  if (!import.meta.server) return

  const preference = normalizeThemePreference(useRequestEvent()?.context.themePreference)
  useHead({ htmlAttrs: { 'data-theme-pref': preference } })
})
