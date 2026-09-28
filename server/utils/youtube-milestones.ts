import type { ReviewSummaryDto, TrackDto } from '~~/shared/types'
import { videoMilestone } from '~~/shared/types'

const SUCCESS_TTL = 12 * 60 * 60 * 1000
const ERROR_TTL = 5 * 60 * 1000
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/

type CachedCount = { count: number | null; expiresAt: number }
const cache = new Map<string, CachedCount>()
const pending = new Map<string, Promise<number | null>>()

async function fetchBatch(ids: string[], key: string): Promise<Map<string, number | null>> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'statistics')
  url.searchParams.set('fields', 'items(id,statistics(viewCount))')
  url.searchParams.set('id', ids.join(','))
  url.searchParams.set('key', key)

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`YouTube videos.list: HTTP ${response.status}`)

  const data = await response.json() as {
    items?: { id?: string; statistics?: { viewCount?: string } }[]
  }
  const counts = new Map<string, number | null>(ids.map(id => [id, null]))
  for (const item of data.items ?? []) {
    if (!item.id || !ids.includes(item.id)) continue
    const raw = item.statistics?.viewCount
    const count = raw && /^\d+$/.test(raw) ? Number(raw) : NaN
    counts.set(item.id, Number.isSafeInteger(count) ? count : null)
  }
  return counts
}

async function getViewCounts(ids: string[]): Promise<Map<string, number | null>> {
  const unique = [...new Set(ids.filter(id => VIDEO_ID.test(id)))]
  const key = process.env.YOUTUBE_DATA_API_KEY || useRuntimeConfig().youtubeDataApiKey
  if (!key || !unique.length) return new Map()

  const now = Date.now()
  const missing = unique.filter(id => !pending.has(id) && (!cache.has(id) || cache.get(id)!.expiresAt <= now))

  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50)
    const request = fetchBatch(batch, key)
      .then(counts => {
        const expiresAt = Date.now() + SUCCESS_TTL
        for (const id of batch) cache.set(id, { count: counts.get(id) ?? null, expiresAt })
        return counts
      })
      .catch(() => {
        // 取得済みの値は残し、初回失敗時はリボンを付けない。
        const expiresAt = Date.now() + ERROR_TTL
        for (const id of batch) cache.set(id, { count: cache.get(id)?.count ?? null, expiresAt })
        return new Map<string, number | null>()
      })
      .finally(() => {
        for (const id of batch) pending.delete(id)
      })
    for (const id of batch) pending.set(id, request.then(counts => counts.get(id) ?? null))
  }

  await Promise.all(unique.map(id => pending.get(id)).filter(Boolean))
  return new Map(unique.map(id => [id, cache.get(id)?.count ?? null]))
}

/** API の DTO に含まれる楽曲へ、YouTube の再生数と最高到達段階を付ける。 */
export async function withYoutubeMilestones<T>(payload: T): Promise<T> {
  const tracks: TrackDto[] = []
  const reviews: ReviewSummaryDto[] = []
  const visited = new Set<object>()
  function collect(value: unknown): void {
    if (!value || typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    if ('youtubeVideoId' in value && 'thumbnailUrl' in value) {
      tracks.push(value as TrackDto)
      return
    }
    if ('isHallOfFame' in value && 'track' in value) reviews.push(value as ReviewSummaryDto)
    for (const child of Object.values(value)) collect(child)
  }
  collect(payload)

  const counts = await getViewCounts(tracks.map(track => track.youtubeVideoId))
  for (const track of tracks) {
    track.viewCount = counts.get(track.youtubeVideoId) ?? null
    track.milestone = videoMilestone(track.viewCount)
  }
  for (const review of reviews) review.isHallOfFame = review.track.milestone !== null
  return payload
}
