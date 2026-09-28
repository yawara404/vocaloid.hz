/**
 * GET /api/auth/session
 * 現在のログイン状態を返す（未ログインなら user: null）
 */
import type { AuthUserDto } from '~~/shared/types'
import { getSessionUser, toAuthUserDto } from '../../utils/auth'

export default defineEventHandler((event): { user: AuthUserDto | null } => {
  const user = getSessionUser(event)
  return { user: user ? toAuthUserDto(user) : null }
})
