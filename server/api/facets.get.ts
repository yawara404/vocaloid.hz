/**
 * GET /api/facets
 * トップページ右カラム用の集計（ライブラリ / カテゴリ / タグ / 殿堂入り / 統計）
 */
import type { FacetsResponse, ReviewSummaryDto } from '~~/shared/types'
import { getFacets } from '../utils/facets'
import { listReviews } from '../utils/reviews'
import { withYoutubeMilestones } from '../utils/youtube-milestones'

export default defineEventHandler(async (): Promise<FacetsResponse> => {
  const facets = getFacets()
  const candidates: ReviewSummaryDto[] = []
  let page = 1
  let total = 0
  do {
    const batch = listReviews({ page, pageSize: 50, sort: 'new' })
    candidates.push(...batch.items)
    total = batch.total
    page++
  } while (candidates.length < total)
  await withYoutubeMilestones(candidates)
  facets.hallOfFame = candidates
    .filter(review => review.track.milestone !== null)
    .sort((a, b) => (b.track.viewCount ?? 0) - (a.track.viewCount ?? 0))
    .slice(0, 5)
  return facets
})
