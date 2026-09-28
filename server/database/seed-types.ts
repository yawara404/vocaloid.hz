import type { ReviewCategory } from '~~/shared/types'

export interface SeedTrack {
  title: string
  producerName: string
  voiceSynthesizer: string
  engineType: string
  releaseYear: number
  youtubeVideoId: string
  slug: string
}

export interface SeedReview {
  slug: string
  title: string
  category: ReviewCategory
  /** 執筆者の username（seed-data の users と対応） */
  author: string
  track: SeedTrack
  tags: string[]
  scores: { lyrics: number; tuning: number; structure: number }
  isFeatured?: boolean
  isHallOfFame?: boolean
  /** ISO 8601 */
  publishedAt: string
  contentMarkdown: string
}
