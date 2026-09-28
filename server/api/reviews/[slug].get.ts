/**
 * GET /api/reviews/:slug
 * 批評の詳細（本文 HTML・タイムスタンプ・多面的評価・関連批評）
 */
import { getSessionUser } from '../../utils/auth'
import { findReviewById, findReviewBySlug, findRelatedReviews, toTrackDto } from '../../utils/reviews'
import { withYoutubeMilestones } from '../../utils/youtube-milestones'

export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, 'slug')
  if (!param) throw createError({ statusCode: 400, message: 'slug が必要です' })

  const viewer = getSessionUser(event)
  const found = findReviewBySlug(param, viewer?.id) ?? findReviewById(param, viewer?.id)

  if (!found) throw createError({ statusCode: 404, message: '批評が見つかりません' })

  const isDraft = found.row.review.status !== 'published'
  if (isDraft && !found.detail.canEdit) {
    throw createError({ statusCode: 404, message: '批評が見つかりません' })
  }

  return withYoutubeMilestones({
    review: found.detail,
    track: toTrackDto(found.row.track),
    related: findRelatedReviews(found.row.track.id, found.row.review.id),
  })
})
