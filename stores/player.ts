/**
 * stores/player.ts
 * ---------------------------------------------------------------
 * 記事内プレイヤー（YouTube IFrame Player API）の状態。
 * 本文のタイムスタンプとプレイヤーで「再生したい楽曲」と
 * 「シーク要求」を共有する。
 *
 * 実際の YT.Player 操作は components/YouTubePlayer.vue が担い、
 * seekNonce の変化を watch してシークを適用する。
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface PlayerTrackMeta {
  videoId: string
  title: string
  producerName: string
  voiceSynthesizer: string
  /** 再生元になった批評（あれば表示） */
  reviewSlug?: string | null
}

export const usePlayerStore = defineStore('player', () => {
  const track = ref<PlayerTrackMeta | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  /** 本文中で最後に押されたタイムスタンプ（秒） */
  const activeTimestamp = ref<number | null>(null)
  /** シーク要求を伝えるための単調増加カウンタ */
  const seekNonce = ref(0)
  const seekSeconds = ref(0)
  const toggleNonce = ref(0)
  const playOnSeek = ref(false)

  /** 批評ページを開いたときなどに呼び、プレイヤーへ楽曲を渡す */
  function load(meta: PlayerTrackMeta, startSeconds = 0, autoplay = false): void {
    track.value = { ...meta }
    playOnSeek.value = autoplay
    seekSeconds.value = Math.max(0, startSeconds)
    activeTimestamp.value = startSeconds > 0 ? startSeconds : null
    seekNonce.value += 1
  }

  /** タイムスタンプボタンから呼ばれるシーク要求 */
  function seek(seconds: number): void {
    seekSeconds.value = Math.max(0, Math.floor(seconds))
    activeTimestamp.value = seekSeconds.value
    playOnSeek.value = true
    seekNonce.value += 1
  }

  function togglePlayback(): void {
    toggleNonce.value += 1
  }

  function setPlayback(playing: boolean, time: number, length: number): void {
    isPlaying.value = playing
    currentTime.value = time
    duration.value = length
  }

  function stop(): void {
    track.value = null
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    activeTimestamp.value = null
  }

  return {
    track,
    isPlaying,
    currentTime,
    duration,
    activeTimestamp,
    seekNonce,
    seekSeconds,
    toggleNonce,
    playOnSeek,
    load,
    seek,
    togglePlayback,
    setPlayback,
    stop,
  }
})
