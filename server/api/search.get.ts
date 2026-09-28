/** 公開批評を曲・評者・タグから横断検索する。 */
import type { SearchResponse } from '~~/shared/types'
import { listReviews } from '../utils/reviews'
import { withYoutubeMilestones } from '../utils/youtube-milestones'

function queryString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, 100)
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null
}

export default defineEventHandler(async (event): Promise<SearchResponse> => {
  const query = getQuery(event)
  const q = queryString(query.q)
  const synthesizer = queryString(query.synthesizer)
  const tag = queryString(query.tag)
  const sort = query.sort === 'reading_time' || query.sort === 'words' ? query.sort : 'newest'

  const result = listReviews({
    q,
    library: synthesizer,
    exactLibrary: true,
    tag,
    sort: sort === 'newest' ? 'new' : sort,
    page: 1,
    pageSize: 30,
    status: 'published',
  })

  return withYoutubeMilestones({ items: result.items, total: result.total, q, synthesizer, tag, sort })
})
