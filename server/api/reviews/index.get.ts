/**
 * GET /api/reviews
 * 批評アーカイブ一覧（フィルター・並び替え・ページング）
 *   ?library=初音ミク&category=lyrics&tag=kz&q=&sort=new&page=1&pageSize=20&author=kiritzubo
 */
import { eq } from 'drizzle-orm'
import type { ReviewCategory, ReviewListResponse } from '~~/shared/types'
import { CATEGORY_ORDER } from '~~/shared/types'
import { schema, useDb } from '../../utils/db'
import { getFeaturedReview, listReviews, type ReviewSort } from '../../utils/reviews'
import { withYoutubeMilestones } from '../../utils/youtube-milestones'

const SORTS: ReviewSort[] = ['new', 'old', 'words', 'title']

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null
}

export default defineEventHandler(async (event): Promise<ReviewListResponse> => {
  const query = getQuery(event)

  const rawCategory = stringOrNull(query.category)
  const category = rawCategory && (CATEGORY_ORDER as string[]).includes(rawCategory)
    ? (rawCategory as ReviewCategory)
    : null

  const library = stringOrNull(query.library)
  const tag = stringOrNull(query.tag)
  const q = stringOrNull(query.q)
  const author = stringOrNull(query.author)

  const rawSort = stringOrNull(query.sort)
  const sort: ReviewSort = rawSort && SORTS.includes(rawSort as ReviewSort) ? (rawSort as ReviewSort) : 'new'

  const page = Math.max(Number(query.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 50)

  let userId: string | null = null
  if (author) {
    const user = useDb()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, author))
      .get()
    // 存在しない評者を指定されたら空集合を返す
    userId = user?.id ?? '__none__'
  }

  const status = stringOrNull(query.status) === 'draft' ? 'draft' : 'published'

  const result = listReviews({ library, category, tag, q, sort, page, pageSize, userId, status })

  const isDefaultView = !library && !category && !tag && !q && !author && sort === 'new' && page === 1

  return withYoutubeMilestones({
    items: result.items,
    total: result.total,
    featured: isDefaultView ? getFeaturedReview() : null,
    page: result.page,
    pageSize: result.pageSize,
  })
})
