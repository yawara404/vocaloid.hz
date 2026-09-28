/**
 * shared/youtube.ts
 * YouTube 動画 URL / 動画 ID のユーティリティ（クライアント・サーバー共用）
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/**
 * URL / ID 文字列から YouTube の 11 桁動画 ID を抽出する。
 * 対応: watch?v= / youtu.be / embed / shorts / live / v / music.youtube.com / nocookie
 */
export function extractYouTubeVideoId(input: string | null | undefined): string | null {
  if (!input) return null
  const value = input.trim()
  if (!value) return null

  if (VIDEO_ID_PATTERN.test(value)) return value

  let url: URL | null = null
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  }
  catch {
    url = null
  }

  if (url) {
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && VIDEO_ID_PATTERN.test(id) ? id : null
    }
    if (/(?:^|\.)youtube(?:-nocookie)?\.com$/.test(host) || host === 'music.youtube.com') {
      const v = url.searchParams.get('v')
      if (v && VIDEO_ID_PATTERN.test(v)) return v
      const parts = url.pathname.split('/').filter(Boolean)
      for (const key of ['embed', 'shorts', 'live', 'v']) {
        const index = parts.indexOf(key)
        const id = index >= 0 ? parts[index + 1] : undefined
        if (id && VIDEO_ID_PATTERN.test(id)) return id
      }
    }
  }

  const fallback = value.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return fallback?.[1] ?? null
}

export type ThumbnailSize = 'default' | 'mq' | 'hq' | 'sd' | 'max'

export function youtubeThumbnail(videoId: string, size: ThumbnailSize = 'hq'): string {
  const prefix = size === 'default' ? '' : size
  return `https://i.ytimg.com/vi/${videoId}/${prefix}default.jpg`
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}
