<script setup lang="ts">
/**
 * components/YouTubePlayer.vue
 * ---------------------------------------------------------------
 * 記事内に表示する公式 YouTube プレイヤー。
 *  - YouTube IFrame Player API をクライアントでのみ一度だけロード
 *  - stores/player.ts の seekNonce を watch してシーク＆再生
 *  - 本文内の `.timestamp-btn[data-seek]` クリックをイベント委譲で捕捉
 *    （v-html で描画されるため @click を直接バインドできない）
 */
import { usePlayerStore } from '~~/stores/player'

const player = usePlayerStore()

const mountPoint = ref<HTMLDivElement | null>(null)
const ready = ref(false)
const loading = ref(false)

let ytPlayer: any = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let pendingToggle = false

interface YtWindow extends Window {
  YT?: any
  onYouTubeIframeAPIReady?: () => void
  __hzYtWaiters?: Array<() => void>
}

/** IFrame API を一度だけ読み込み、準備完了まで待機する */
function loadYouTubeApi(): Promise<void> {
  const w = window as YtWindow

  if (w.YT?.Player) return Promise.resolve()

  return new Promise((resolve) => {
    w.__hzYtWaiters = [...(w.__hzYtWaiters ?? []), resolve]

    if (document.querySelector('script[data-hz-yt-api]')) return

    w.onYouTubeIframeAPIReady = () => {
      for (const waiter of w.__hzYtWaiters ?? []) waiter()
      w.__hzYtWaiters = []
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.async = true
    tag.dataset.hzYtApi = '1'
    document.head.appendChild(tag)
  })
}

function syncState(): void {
  if (!ytPlayer?.getCurrentTime) return
  const state = ytPlayer.getPlayerState?.()
  player.setPlayback(
    state === 1,
    Math.floor(ytPlayer.getCurrentTime() ?? 0),
    Math.floor(ytPlayer.getDuration() ?? 0),
  )
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(syncState, 750)
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

async function ensurePlayer(): Promise<void> {
  if (ytPlayer || !mountPoint.value || loading.value) return
  loading.value = true

  try {
    await loadYouTubeApi()
    if (!mountPoint.value) return

    const YT = (window as YtWindow).YT
    ytPlayer = new YT.Player(mountPoint.value, {
      width: '100%',
      height: '100%',
      videoId: player.track?.videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        disablekb: 0,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          ready.value = true
          applySeek(player.playOnSeek || pendingToggle)
          pendingToggle = false
          startPolling()
        },
        onStateChange: () => syncState(),
      },
    })
  }
  finally {
    loading.value = false
  }
}

/** ストアのシーク要求を YT プレイヤーへ適用する */
function applySeek(autoplay = true): void {
  if (!ytPlayer?.seekTo) return
  if (player.seekSeconds > 0) ytPlayer.seekTo(player.seekSeconds, true)
  if (autoplay) ytPlayer.playVideo?.()
  syncState()
}

function togglePlayback(): void {
  if (!ytPlayer || !ready.value) {
    pendingToggle = !pendingToggle
    return
  }
  const state = ytPlayer.getPlayerState?.()
  if (state === 1) ytPlayer.pauseVideo?.()
  else ytPlayer.playVideo?.()
  syncState()
}

/** 本文中のタイムスタンプボタンをイベント委譲で拾う */
function onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  const button = target?.closest?.('.timestamp-btn[data-seek]') as HTMLElement | null
  if (!button) return

  const seconds = Number(button.dataset.seek)
  if (Number.isNaN(seconds)) return

  event.preventDefault()
  player.seek(seconds)
}

/** 再生中のタイムスタンプをハイライトする */
function highlightActiveTimestamp(): void {
  if (import.meta.server) return
  const buttons = document.querySelectorAll<HTMLElement>('.timestamp-btn[data-seek]')
  buttons.forEach((button) => {
    const seconds = Number(button.dataset.seek)
    button.classList.toggle('is-active', player.activeTimestamp === seconds && player.isPlaying)
  })
}

watch(() => player.seekNonce, () => {
  if (!ytPlayer) return
  applySeek(player.playOnSeek)
})

watch(() => player.toggleNonce, () => togglePlayback())

watch(() => player.track?.videoId, async (videoId: string | undefined) => {
  if (!videoId) return
  // v-if で作られる mountPoint は DOM 更新後に初めて参照できる。
  await ensurePlayer()
  if (ready.value) {
    if (player.playOnSeek) ytPlayer.loadVideoById?.({ videoId, startSeconds: player.seekSeconds })
    else {
      ytPlayer.pauseVideo?.()
      ytPlayer.cueVideoById?.({ videoId, startSeconds: player.seekSeconds })
    }
    startPolling()
  }
}, { flush: 'post' })

watch(() => [player.activeTimestamp, player.isPlaying], highlightActiveTimestamp)

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  if (player.track) ensurePlayer()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  stopPolling()
  try {
    ytPlayer?.destroy?.()
  }
  catch { /* noop */ }
  ytPlayer = null
  player.stop()
})

</script>

<template>
  <!--
    記事内のプレイヤー（LAYOUT_ARCHITECTURE §2.1 / §4.4）。
    16:9（aspect-video）で幅に追従させ、高さのピクセル固定はしない。
    スクロールさせても浮遊させない（右下の固定表示は廃止し、画面と本文を塞がない）。
  -->
  <div v-if="player.track" class="relative aspect-video w-full">
    <div class="absolute inset-0 h-full w-full overflow-hidden rounded-md border border-ink-700 bg-black">
      <div ref="mountPoint" class="h-full w-full" />
    </div>
    <p v-if="!ready" class="sr-only" role="status">プレイヤーを読み込んでいます</p>
  </div>
</template>
