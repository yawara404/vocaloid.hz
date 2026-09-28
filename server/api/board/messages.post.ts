import { desc, eq } from 'drizzle-orm'
import type { BoardMessageDto } from '~~/shared/types'
import { requireUser } from '../../utils/auth'
import { schema, useDb } from '../../utils/db'

export default defineEventHandler(async (event): Promise<{ message: BoardMessageDto }> => {
  const user = requireUser(event)
  const body = await readBody<{ content?: unknown }>(event)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) throw createError({ statusCode: 400, message: 'メッセージを入力してください' })
  if (content.length > 500) throw createError({ statusCode: 400, message: 'メッセージは500文字以内で入力してください' })

  const db = useDb()
  const latest = db.select({ createdAt: schema.boardMessages.createdAt })
    .from(schema.boardMessages)
    .where(eq(schema.boardMessages.userId, user.id))
    .orderBy(desc(schema.boardMessages.id))
    .limit(1)
    .get()
  if (latest && Date.now() - latest.createdAt.getTime() < 1000) {
    throw createError({ statusCode: 429, message: '少し待ってから送信してください' })
  }

  const created = db.insert(schema.boardMessages).values({ userId: user.id, content }).returning().get()
  setResponseStatus(event, 201)
  return {
    message: {
      id: created.id,
      content: created.content,
      createdAt: created.createdAt.toISOString(),
      author: {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    },
  }
})
