/**
 * GET /api/tracks
 * 楽曲ライブラリ一覧 ?library=&q=&page=&pageSize=
 */
import { listTracks } from '../../utils/tracks'
import { withYoutubeMilestones } from '../../utils/youtube-milestones'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const stringOrNull = (value: unknown) => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null
  }

  return withYoutubeMilestones(listTracks({
    library: stringOrNull(query.library),
    q: stringOrNull(query.q),
    page: Math.max(Number(query.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(query.pageSize) || 24, 1), 60),
  }))
})
