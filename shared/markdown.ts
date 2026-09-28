/**
 * shared/markdown.ts
 * ---------------------------------------------------------------
 * markdown-it による Markdown → HTML 変換。
 *
 * セキュリティ方針:
 *  - `html: false` により、Markdown 中に書かれた生 HTML はすべてエスケープされる
 *    （= SSR で出力される HTML は構造的に XSS 安全）。
 *  - link / image の URL はスキーム許可リストでさらに絞る。
 *  - クライアント側のリアルタイムプレビューも同じ安全なレンダラを使う。
 *
 * キラー機能:
 *  - 本文中の `[01:23]` / `[1:02:03]` 記法を
 *    `<button class="timestamp-btn" data-seek="83">` に変換する inline ルール。
 */
import MarkdownIt, { type MarkdownIt as MarkdownItInstance } from 'markdown-it'

export interface MarkdownOptions {
  breaks?: boolean
}

const TIMESTAMP_PATTERN = /^\[(\d{1,3}):([0-5]\d)(?::([0-5]\d))?\]/

const SAFE_URL = /^(?:https?:|mailto:|#|\/|\.\/|\.\.\/)/i

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `[01:23]` → 83 秒 */
export function parseTimestamp(label: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/.exec(label.trim())
  if (!match) return null
  const [, a, b, c] = match as unknown as [string, string, string, string | undefined]
  return c !== undefined
    ? Number(a) * 3600 + Number(b) * 60 + Number(c)
    : Number(a) * 60 + Number(b)
}

/** 秒 → `MM:SS` (1時間超は `H:MM:SS`) */
export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function createMarkdown(options: MarkdownOptions = {}): MarkdownItInstance {
  const md = new MarkdownIt({
    html: false, // 生 HTML は許可しない（サニタイズの第一線）
    linkify: true,
    breaks: options.breaks ?? false,
    typographer: false,
  })

  // --- タイムスタンプ記法 ------------------------------------------------
  md.inline.ruler.before('link', 'hz_timestamp', (state: any, silent: boolean) => {
    const src: string = state.src
    if (src.charCodeAt(state.pos) !== 0x5b /* [ */) return false

    const match = TIMESTAMP_PATTERN.exec(src.slice(state.pos))
    if (!match) return false

    const raw = match[0]!
    const seconds = parseTimestamp(raw.slice(1, -1))
    if (seconds === null) return false

    if (!silent) {
      const token = state.push('hz_timestamp', '', 0)
      token.content = raw.slice(1, -1)
      token.meta = { seconds }
    }

    state.pos += raw.length
    return true
  })

  md.renderer.rules.hz_timestamp = (tokens, idx) => {
    const token = tokens[idx]!
    const seconds = Number(token.meta?.seconds ?? 0)
    const label = escapeHtml(token.content)
    return (
      `<button type="button" class="timestamp-btn" data-seek="${seconds}" `
      + `data-timestamp="${label}" title="この位置（${label}）から再生する" `
      + `aria-label="タイムスタンプ ${label} から再生">${label}</button>`
    )
  }

  // --- リンク / 画像の URL 制限 ------------------------------------------
  const defaultLinkOpen
    = md.renderer.rules.link_open
    ?? ((tokens: any, idx: number, opts: any, _env: any, self: any) => self.renderToken(tokens, idx, opts))

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!
    const hrefIndex = token.attrIndex('href')
    const href = hrefIndex >= 0 ? String(token.attrs?.[hrefIndex]?.[1] ?? '') : ''

    if (!SAFE_URL.test(href)) {
      token.attrSet('href', '#')
    }
    else if (/^https?:/i.test(href)) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer nofollow')
    }

    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  const defaultImage
    = md.renderer.rules.image
    ?? ((tokens: any, idx: number, opts: any, _env: any, self: any) => self.renderToken(tokens, idx, opts))

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!
    const srcIndex = token.attrIndex('src')
    const src = srcIndex >= 0 ? String(token.attrs?.[srcIndex]?.[1] ?? '') : ''
    if (!/^https?:/i.test(src)) token.attrSet('src', '')
    token.attrSet('loading', 'lazy')
    token.attrSet('decoding', 'async')
    return defaultImage(tokens, idx, options, env, self)
  }

  return md
}

const mdInstance = createMarkdown()

export function renderMarkdown(source: string): string {
  return mdInstance.render(source ?? '')
}

/** Markdown 記法を除いたプレーンテキスト */
export function stripMarkdown(source: string): string {
  return (source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\[(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 日本語前提の文字数（空白を除く実質文字数） */
export function countWords(source: string): number {
  return stripMarkdown(source).replace(/\s/g, '').length
}

/** 読了目安（日本語 500 字 / 分） */
export function readingTimeMinutes(source: string): number {
  return Math.max(1, Math.ceil(countWords(source) / 500))
}

/** 本文抜粋（既定 150 字） */
export function makeExcerpt(source: string, length = 150): string {
  const text = stripMarkdown(source)
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}…`
}

/** 本文中のタイムスタンプを秒配列で返す（昇順・重複除去） */
export function extractTimestamps(source: string): number[] {
  const found = new Set<number>()
  const re = /\[(\d{1,3}:[0-5]\d(?::[0-5]\d)?)\]/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source ?? '')) !== null) {
    const seconds = parseTimestamp(match[1]!)
    if (seconds !== null) found.add(seconds)
  }
  return [...found].sort((a, b) => a - b)
}
