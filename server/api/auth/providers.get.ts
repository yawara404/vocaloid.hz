/**
 * GET /api/auth/providers
 * 有効な認証プロバイダー（環境変数の設定状況）を返す
 */
import type { ProvidersResponse } from '~~/shared/types'
import { isProviderEnabled } from '../../utils/oauth'

export default defineEventHandler((): ProvidersResponse => ({
  password: true,
  google: isProviderEnabled('google'),
  discord: isProviderEnabled('discord'),
}))
