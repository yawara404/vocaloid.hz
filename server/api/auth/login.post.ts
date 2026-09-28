/**
 * POST /api/auth/login
 * body: { identifier: メールアドレス or ユーザー名, password }
 */
import { eq, or } from 'drizzle-orm'
import { createSession, toAuthUserDto, verifyPassword } from '../../utils/auth'
import { schema, useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ identifier?: string; password?: string }>(event)
  const identifier = body.identifier?.trim()
  const password = body.password ?? ''

  if (!identifier || !password) {
    throw createError({ statusCode: 400, message: 'メールアドレス（またはユーザー名）とパスワードを入力してください' })
  }

  const user = useDb()
    .select()
    .from(schema.users)
    .where(or(eq(schema.users.email, identifier), eq(schema.users.username, identifier)))
    .get()

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, message: 'メールアドレスまたはパスワードが違います' })
  }

  createSession(event, user.id)

  return { user: toAuthUserDto(user) }
})
