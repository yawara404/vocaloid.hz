/**
 * GET /api/users/:username
 * 評者プロフィールと公開批評一覧
 */
import { eq } from 'drizzle-orm'
import { schema, useDb } from '../../utils/db'
import { listReviews, toAuthorDto } from '../../utils/reviews'
import { withYoutubeMilestones } from '../../utils/youtube-milestones'

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')
  if (!username) throw createError({ statusCode: 400, message: 'username が必要です' })

  const user = useDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get()

  if (!user) throw createError({ statusCode: 404, message: '評者が見つかりません' })

  const { items, total } = listReviews({ userId: user.id, pageSize: 50, sort: 'new' })

  return withYoutubeMilestones({
    author: toAuthorDto(user),
    reviews: items,
    total,
  })
})
