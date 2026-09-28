/**
 * server/utils/facets.ts
 * トップページ右カラム用の集計データ。
 */
import { desc, eq, sql } from 'drizzle-orm'
import type { FacetCount, FacetsResponse } from '~~/shared/types'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '~~/shared/types'
import { schema, useDb } from './db'

const published = eq(schema.reviews.status, 'published')

export function getLibraryFacets(): FacetCount[] {
  const db = useDb()
  const rows = db
    .select({ key: schema.tracks.voiceSynthesizer, value: sql<number>`count(*)` })
    .from(schema.reviews)
    .innerJoin(schema.tracks, eq(schema.reviews.trackId, schema.tracks.id))
    .where(published)
    .groupBy(schema.tracks.voiceSynthesizer)
    .all()

  // 「初音ミク / 重音テト SV」のようなデュエット表記は両方に計上する
  const merged = new Map<string, number>()
  for (const row of rows) {
    const names = row.key.split('/').map(name => name.trim()).filter(Boolean)
    for (const name of names) {
      merged.set(name, (merged.get(name) ?? 0) + Number(row.value))
    }
  }

  return [...merged.entries()]
    .map(([key, value]) => ({ key, label: key, count: value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'))
}

export function getCategoryFacets(): FacetCount[] {
  const db = useDb()
  const rows = db
    .select({ key: schema.reviews.category, value: sql<number>`count(*)` })
    .from(schema.reviews)
    .where(published)
    .groupBy(schema.reviews.category)
    .all()

  const counts = new Map(rows.map(row => [row.key, Number(row.value)]))

  return CATEGORY_ORDER.map(key => ({
    key,
    label: CATEGORY_LABELS[key],
    count: counts.get(key) ?? 0,
  }))
}

export function getEngineFacets(): FacetCount[] {
  const db = useDb()
  const rows = db
    .select({ key: schema.tracks.engineType, value: sql<number>`count(*)` })
    .from(schema.reviews)
    .innerJoin(schema.tracks, eq(schema.reviews.trackId, schema.tracks.id))
    .where(published)
    .groupBy(schema.tracks.engineType)
    .orderBy(desc(sql`count(*)`))
    .all()

  return rows
    .filter(row => Boolean(row.key))
    .map(row => ({ key: row.key!, label: row.key!, count: Number(row.value) }))
}

export function getTagFacets(limit = 12): FacetCount[] {
  const db = useDb()
  const rows = db
    .select({ slug: schema.tags.slug, name: schema.tags.name, value: sql<number>`count(*)` })
    .from(schema.reviewTags)
    .innerJoin(schema.tags, eq(schema.reviewTags.tagId, schema.tags.id))
    .innerJoin(schema.reviews, eq(schema.reviewTags.reviewId, schema.reviews.id))
    .where(published)
    .groupBy(schema.tags.id)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .all()

  return rows.map(row => ({ key: row.slug, label: row.name, count: Number(row.value) }))
}

export function getFacets(): FacetsResponse {
  const db = useDb()

  const [statsRow] = db
    .select({
      reviews: sql<number>`count(*)`,
      words: sql<number>`coalesce(sum(${schema.reviews.wordCount}), 0)`,
      critics: sql<number>`count(distinct ${schema.reviews.userId})`,
      tracks: sql<number>`count(distinct ${schema.reviews.trackId})`,
      libraries: sql<number>`count(distinct ${schema.tracks.voiceSynthesizer})`,
    })
    .from(schema.reviews)
    .innerJoin(schema.tracks, eq(schema.reviews.trackId, schema.tracks.id))
    .where(published)
    .all()

  return {
    libraries: getLibraryFacets(),
    categories: getCategoryFacets(),
    engines: getEngineFacets(),
    tags: getTagFacets(),
    hallOfFame: [],
    stats: {
      reviews: Number(statsRow?.reviews ?? 0),
      tracks: Number(statsRow?.tracks ?? 0),
      libraries: Number(statsRow?.libraries ?? 0),
      words: Number(statsRow?.words ?? 0),
      critics: Number(statsRow?.critics ?? 0),
    },
  }
}
