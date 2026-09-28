/**
 * GET /api/tracks/:slug
 * 楽曲詳細＋その楽曲に寄せられた批評一覧
 */
import { findTrackBySlug } from '../../utils/tracks'
import { withYoutubeMilestones } from '../../utils/youtube-milestones'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'slug が必要です' })

  const found = findTrackBySlug(slug)
  if (!found) throw createError({ statusCode: 404, message: '楽曲が見つかりません' })

  return withYoutubeMilestones(found)
})
