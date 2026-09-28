/**
 * GET /api/tags
 * タグ一覧（批評数つき）。?limit=50
 */
import type { FacetCount } from '~~/shared/types'
import { getTagFacets } from '../../utils/facets'

export default defineEventHandler((event): { items: FacetCount[] } => {
  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  return { items: getTagFacets(limit) }
})
