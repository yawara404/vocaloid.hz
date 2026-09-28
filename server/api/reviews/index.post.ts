/**
 * POST /api/reviews
 * 批評を新規作成する（ログイン必須）。
 * body: { title, contentMarkdown, category, excerpt?, tags?, status?, scores?, track: {...} }
 */
import type { ReviewCategory } from '~~/shared/types'
import { CATEGORY_ORDER } from '~~/shared/types'
import { requireUser } from '../../utils/auth'
import {
  buildReviewValues,
  ensureUniqueReviewSlug,
  parseTagInput,
  syncReviewTags,
  upsertTrack,
} from '../../utils/content'
import { schema, useDb } from '../../utils/db'
import { findReviewBySlug } from '../../utils/reviews'

interface CreateReviewBody {
  title?: string
  contentMarkdown?: string
  category?: string
  excerpt?: string
  tags?: unknown
  status?: string
  scoreLyrics?: number
  scoreTuning?: number
  scoreStructure?: number
  track?: {
    title?: string
    producerName?: string
    voiceSynthesizer?: string
    engineType?: string
    releaseYear?: number
    youtubeVideoId?: string
    spotifyTrackId?: string
  }
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const body = await readBody<CreateReviewBody>(event)

  const title = body.title?.trim()
  const contentMarkdown = body.contentMarkdown ?? ''
  const track = body.track ?? {}

  if (!title) throw createError({ statusCode: 400, message: '批評タイトルは必須です' })
  if (contentMarkdown.trim().length < 20) {
    throw createError({ statusCode: 400, message: '本文が短すぎます（20 文字以上）' })
  }
  if (!track.title?.trim()) throw createError({ statusCode: 400, message: '楽曲タイトルは必須です' })
  if (!track.producerName?.trim()) throw createError({ statusCode: 400, message: 'ボカロP名は必須です' })
  if (!track.voiceSynthesizer?.trim()) throw createError({ statusCode: 400, message: '音声合成ライブラリは必須です' })
  if (!track.youtubeVideoId?.trim()) throw createError({ statusCode: 400, message: 'YouTube 動画 URL は必須です' })

  const category: ReviewCategory = (CATEGORY_ORDER as string[]).includes(body.category ?? '')
    ? (body.category as ReviewCategory)
    : 'lyrics'

  const status = body.status === 'draft' ? 'draft' : 'published'

  const trackRow = upsertTrack({
    title: track.title,
    producerName: track.producerName,
    voiceSynthesizer: track.voiceSynthesizer,
    engineType: track.engineType ?? null,
    releaseYear: track.releaseYear ?? null,
    youtubeVideoId: track.youtubeVideoId,
    spotifyTrackId: track.spotifyTrackId ?? null,
  })

  const slug = ensureUniqueReviewSlug(title)
  const values = buildReviewValues(
    {
      title,
      contentMarkdown,
      category,
      excerpt: body.excerpt ?? null,
      scoreLyrics: body.scoreLyrics ?? null,
      scoreTuning: body.scoreTuning ?? null,
      scoreStructure: body.scoreStructure ?? null,
      status,
    },
    user.id,
    trackRow.id,
    slug,
  )

  const created = useDb().insert(schema.reviews).values(values).returning().get()
  syncReviewTags(created.id, parseTagInput(body.tags))

  setResponseStatus(event, 201)

  const found = findReviewBySlug(created.slug, user.id)
  return { review: found?.detail ?? null }
})
