/**
 * GET /sitemap.xml
 * ---------------------------------------------------------------------------
 * Google Search Console に送るサイトマップ。Nitro のサーバールート（server/routes）なので、
 * 配信パス（NUXT_APP_BASE_URL）つきの URL でそのまま出る。
 *
 *   https://<host>/Vocaloid.hz/sitemap.xml
 *
 * URL の組み立ては server/utils/oauth.ts と同じ方針:
 *   オリジンは getRequestURL(event).origin（トンネル越しでも正しいホスト）、
 *   パスは runtimeConfig.app.baseURL を前置する。
 *
 * 載せる URL:
 *   固定ページ（トップ / レビュー一覧 / 楽曲一覧 / ラウンジ / 掲示板）
 *   レビュー（/reviews/:slug）と楽曲（/tracks/:slug）は DB の公開分を全件
 *   （一覧 API は 1 回 50 / 60 件までなので、最後までページを回して集める）
 *
 * robots.txt はホストのルート（このアプリの外）にしか置けず、Google は
 * サブディレクトリの robots.txt を読まない。そのため Search Console の
 * 「サイトマップ」にはこの URL を直接入力して送信する。
 */
import { getRequestURL, setHeader } from 'h3'
import { listReviews } from '../utils/reviews'
import { listTracks } from '../utils/tracks'

/** 固定ページ。baseURL の後ろに付くパス（'' はトップページ）。 */
const STATIC_PAGES = ['', 'reviews', 'tracks', 'lounge', 'board'] as const

/** 一覧 API は listReviews 50 件 / listTracks 60 件が上限。取り逃しと無限ループの安全弁。 */
const MAX_PAGES = 200

/** XML の文字列として安全にする */
const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, char => XML_ESCAPES[char] ?? char)
}

interface SitemapEntry {
  path: string
  /** 更新日時（ISO 8601）。無い URL は <lastmod> を出さない。 */
  lastmod?: string
}

/** 公開レビュー（全ページ）を URL の材料にする */
function reviewEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  let page = 1
  let total = 0
  do {
    const batch = listReviews({ page, pageSize: 50, sort: 'new' })
    for (const review of batch.items) {
      entries.push({ path: `reviews/${review.slug}`, lastmod: review.publishedAt ?? undefined })
    }
    total = batch.total
    page += 1
  } while (entries.length < total && page <= MAX_PAGES)
  return entries
}

/** 楽曲（全ページ）を URL の材料にする。更新日を持たないので lastmod は付けない。 */
function trackEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  let page = 1
  let total = 0
  do {
    const batch = listTracks({ page, pageSize: 60 })
    for (const item of batch.items) entries.push({ path: `tracks/${item.track.slug}` })
    total = batch.total
    page += 1
  } while (entries.length < total && page <= MAX_PAGES)
  return entries
}

export default defineEventHandler((event): string => {
  const origin = getRequestURL(event).origin
  // サブパス配信（NUXT_APP_BASE_URL）でも正しい URL になるよう baseURL を前置する
  const baseURL = (useRuntimeConfig().app.baseURL || '/').replace(/\/+$/, '')

  const entries: SitemapEntry[] = [
    ...STATIC_PAGES.map(path => ({ path })),
    ...reviewEntries(),
    ...trackEntries(),
  ]

  const urls = entries.map((entry) => {
    const loc = `${origin}${baseURL}/${entry.path}`
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}\n  </url>`
  })

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  // 中身は DB の内容で決まる。クロールを待たせない程度に短く持たせる。
  setHeader(event, 'cache-control', 'public, max-age=600')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
})