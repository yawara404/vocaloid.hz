/**
 * POST /api/auth/register
 * body: { username, email, password, displayName? }
 */
import { eq, or } from 'drizzle-orm'
import { createSession, hashPassword, toAuthUserDto } from '../../utils/auth'
import { schema, useDb } from '../../utils/db'

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    username?: string
    displayName?: string
    email?: string
    password?: string
  }>(event)

  const username = body.username?.trim().toLowerCase() ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''
  const displayName = body.displayName?.trim() || username

  if (!USERNAME_RE.test(username)) {
    throw createError({ statusCode: 400, message: 'ユーザー名は 3〜30 文字の半角英数字・_・- で入力してください' })
  }
  if (!EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, message: 'メールアドレスの形式が正しくありません' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'パスワードは 8 文字以上で入力してください' })
  }

  const db = useDb()
  const clash = db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(or(eq(schema.users.username, username), eq(schema.users.email, email)))
    .get()

  if (clash) {
    throw createError({
      statusCode: 409,
      message: clash.username === username ? 'そのユーザー名は既に使われています' : 'そのメールアドレスは既に登録されています',
    })
  }

  const user = db
    .insert(schema.users)
    .values({
      username,
      displayName,
      email,
      passwordHash: hashPassword(password),
      provider: 'password',
    })
    .returning()
    .get()

  createSession(event, user.id)
  setResponseStatus(event, 201)

  return { user: toAuthUserDto(user) }
})
