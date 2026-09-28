/**
 * shared/types.ts - API / UI 間で共有する DTO 定義
 */

export type ReviewCategory = 'lyrics' | 'tuning' | 'album'
export type VideoMilestone = 'hall' | 'legend' | 'myth'

export interface BoardMessageDto {
  id: number
  content: string
  createdAt: string
  author: {
    username: string
    displayName: string
    avatarUrl: string | null
  }
}

/** AI ラウンジ（共有チャット）の発言。店主（AI）は role = 'assistant' */
export interface LoungeMessageDto {
  id: number
  role: 'user' | 'assistant'
  /** 店主の発言の種類。呼ばれて答えた返事は 'reply'、呼ばれずに呟いた独り言は 'monologue' */
  kind: 'reply' | 'monologue'
  content: string
  createdAt: string
  author: {
    /** 店主（AI）の発言では null */
    username: string | null
    displayName: string
    avatarUrl: string | null
  }
}

/** 店主（AI）の現在の状態 */
export interface LoungeAiStateDto {
  /** 返事・独り言を作っている最中か（画面に「店主が考え中…」を出す） */
  thinking: boolean
  /** 独り言の間隔（ミリ秒）。呼ばれたときの返事はこの間隔を待たない */
  intervalMs: number
  /** 次に店主がひとりごとを言える時刻（エポック ms）。まだ一度も話していなければ null */
  nextTurnAt: number | null
  /** 「店主さん」と呼ばれているか（呼ばれたら間隔を待たずすぐ返事する） */
  called: boolean
  /** 来客の発言がある部屋か（誰も来ていない部屋では独り言を言わない） */
  roomActive: boolean
}

export function videoMilestone(viewCount: number | null): VideoMilestone | null {
  if (viewCount === null || !Number.isFinite(viewCount)) return null
  if (viewCount >= 10_000_000) return 'myth'
  if (viewCount >= 1_000_000) return 'legend'
  if (viewCount >= 100_000) return 'hall'
  return null
}

export interface TagDto {
  id: string
  name: string
  slug: string
}

export interface AuthorDto {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
}

export interface TrackDto {
  id: string
  slug: string
  title: string
  producerName: string
  voiceSynthesizer: string
  engineType: string | null
  releaseYear: number
  youtubeVideoId: string
  thumbnailUrl: string
  viewCount: number | null
  milestone: VideoMilestone | null
}

export interface ReviewSummaryDto {
  id: string
  slug: string
  title: string
  excerpt: string
  category: ReviewCategory
  wordCount: number
  readingTimeMinutes: number
  publishedAt: string | null
  isFeatured: boolean
  isHallOfFame: boolean
  likeCount: number
  track: TrackDto
  author: AuthorDto
  tags: TagDto[]
}

export interface ScoreDto {
  lyrics: number | null
  tuning: number | null
  structure: number | null
}

export interface ReviewDetailDto extends ReviewSummaryDto {
  contentHtml: string
  contentMarkdown: string
  timestamps: number[]
  scores: ScoreDto
  updatedAt: string
  canEdit: boolean
  likedByViewer: boolean
}

export interface ReviewListResponse {
  items: ReviewSummaryDto[]
  total: number
  featured: ReviewSummaryDto | null
  page: number
  pageSize: number
}

export interface SearchResponse {
  items: ReviewSummaryDto[]
  total: number
  q: string | null
  synthesizer: string | null
  tag: string | null
  sort: 'newest' | 'reading_time' | 'words'
}

export interface FacetCount {
  key: string
  label: string
  count: number
}

export interface FacetsResponse {
  libraries: FacetCount[]
  categories: FacetCount[]
  engines: FacetCount[]
  tags: FacetCount[]
  hallOfFame: ReviewSummaryDto[]
  stats: {
    reviews: number
    tracks: number
    libraries: number
    words: number
    critics: number
  }
}

/**
 * 表示テーマの設定。
 *  'system' … 端末の設定（prefers-color-scheme）に自動で従う
 *  'light' | 'dark' … ユーザーが明示的に選んだ色
 */
export type ThemePreference = 'system' | 'light' | 'dark'

/** 実際に画面へ適用される色（'system' を解決した結果） */
export type ThemeName = 'light' | 'dark'

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark']

/** localStorage のキー。nuxt.config.ts のインラインスクリプトと同じ値を使う */
export const THEME_STORAGE_KEY = 'vocaloid-hz-theme'

export function normalizeThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : 'system'
}

export interface AuthUserDto {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  bio: string | null
  provider: string
  /** 表示テーマの設定（サーバーに保存される） */
  themePreference: ThemePreference
}

export interface ProvidersResponse {
  password: boolean
  google: boolean
  discord: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LoungeStatus {
  mode: 'ollama' | 'discord'
  ollamaConfigured: boolean
  /** モデルが Ollama にインストールされているか（/api/tags） */
  ollamaReady: boolean
  /** モデルが今ロード中か（/api/ps）。false ならアイドル（アンロード済み） */
  ollamaLoaded: boolean
  /** アイドル（アンロード）に戻る予定時刻 */
  ollamaExpiresAt: string | null
  /** 送信している keep_alive。既定は '5m'（使ってから 5 分でアイドルに戻る） */
  keepAlive: string
  discordConfigured: boolean
  model: string
}

export const CATEGORY_LABELS: Record<ReviewCategory, string> = {
  lyrics: '歌詞考察',
  tuning: '調声論',
  album: 'アルバム総括',
}

export const CATEGORY_ORDER: ReviewCategory[] = ['lyrics', 'tuning', 'album']

/** 多面的分析評価メーターの定性ラベル */
export const SCORE_LABELS: Record<'lyrics' | 'tuning' | 'structure', string[]> = {
  lyrics: ['平易', '叙情的', '物語的', '詩的', '文学的'],
  tuning: ['ナチュラル', '丁寧', '表現豊か', '攻めている', '超越的'],
  structure: ['ミニマル', 'シンプル', '多層的', '高密度', '迷宮的'],
}

export const METER_TITLES: Record<'lyrics' | 'tuning' | 'structure', { title: string; hint: string }> = {
  lyrics: { title: '歌詞の文学性', hint: '語彙・比喩・物語構造の密度' },
  tuning: { title: '調声アプローチ', hint: 'ブレス・子音・ピッチ設計の指向性' },
  structure: { title: '音響構造の複雑さ', hint: 'アレンジのレイヤー数と展開の緻密さ' },
}

export function scoreLabel(kind: 'lyrics' | 'tuning' | 'structure', score: number | null): string {
  if (!score || score < 1 || score > 5) return '―'
  return SCORE_LABELS[kind][score - 1] ?? '―'
}

// ============================================================
// API レスポンス（一覧・詳細の入れ子構造）
// ============================================================

export type LoungeMode = 'ollama' | 'discord'

/** GET /api/tracks の items 要素 */
export interface TrackListItem {
  track: TrackDto
  reviewCount: number
  latestReview: { slug: string; title: string } | null
}

/** GET /api/tracks */
export interface TrackListResponse {
  items: TrackListItem[]
  total: number
  page: number
  pageSize: number
}

/** GET /api/tracks/:slug */
export interface TrackDetailResponse {
  track: TrackDto
  reviews: ReviewSummaryDto[]
}

/** GET /api/reviews/:slug */
export interface ReviewDetailResponse {
  review: ReviewDetailDto
  track: TrackDto
  related: ReviewSummaryDto[]
}

/** GET /api/users/:username */
export interface UserProfileResponse {
  author: AuthorDto
  reviews: ReviewSummaryDto[]
  total: number
}

/** GET /api/tags */
export interface TagListResponse {
  items: FacetCount[]
}

/** Discord モードの POST /api/chat レスポンス */
export interface DiscordChatResponse {
  mode: 'discord'
  sent: boolean
  messages: { id: string; author: string; content: string; timestamp: string }[]
  note?: string
}
