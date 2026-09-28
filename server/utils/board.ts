import { asc, desc, eq, gt } from 'drizzle-orm'
import type { BoardMessageDto } from '~~/shared/types'
import { schema, useDb } from './db'

const PAGE_SIZE = 100

export function parseBoardCursor(value: unknown): number {
  const cursor = Number(value)
  return Number.isSafeInteger(cursor) && cursor > 0 ? cursor : 0
}

export function listBoardMessages(after = 0): BoardMessageDto[] {
  const db = useDb()
  const fields = {
    id: schema.boardMessages.id,
    content: schema.boardMessages.content,
    createdAt: schema.boardMessages.createdAt,
    username: schema.users.username,
    displayName: schema.users.displayName,
    avatarUrl: schema.users.avatarUrl,
  }
  const query = db.select(fields)
    .from(schema.boardMessages)
    .innerJoin(schema.users, eq(schema.boardMessages.userId, schema.users.id))

  const rows = after > 0
    ? query.where(gt(schema.boardMessages.id, after)).orderBy(asc(schema.boardMessages.id)).limit(PAGE_SIZE).all()
    : query.orderBy(desc(schema.boardMessages.id)).limit(PAGE_SIZE).all().reverse()

  return rows.map(row => ({
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    author: {
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    },
  }))
}
