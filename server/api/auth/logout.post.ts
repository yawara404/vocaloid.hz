/**
 * POST /api/auth/logout
 */
import { destroySession } from '../../utils/auth'

export default defineEventHandler((event) => {
  destroySession(event)
  return { ok: true }
})
