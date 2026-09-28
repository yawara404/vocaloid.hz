<script setup lang="ts">
/** Tunedrop と同じく、映像とは別に画面下端で操作するバー。 */
import { formatTimestamp } from '~~/shared/markdown'
import { youtubeThumbnail } from '~~/shared/youtube'
import { usePlayerStore } from '~~/stores/player'

const player = usePlayerStore()
const scrubbing = ref(false)
const previewSeconds = ref(0)
const displayedTime = computed(() => scrubbing.value ? previewSeconds.value : player.currentTime)

function onInput(event: Event): void {
  scrubbing.value = true
  previewSeconds.value = Number((event.target as HTMLInputElement).value)
}

function onChange(event: Event): void {
  const seconds = Number((event.target as HTMLInputElement).value)
  scrubbing.value = false
  if (Number.isFinite(seconds)) player.seek(seconds)
}
</script>

<template>
  <div v-if="player.track" class="fixed inset-x-0 bottom-0 z-bar border-t border-ink-700 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] shadow-bar backdrop-blur-md">
    <div class="mx-auto flex h-[72px] max-w-6xl flex-col px-4 pt-1.5 sm:px-6">
      <input
        type="range"
        min="0"
        :max="Math.max(1, player.duration)"
        step="1"
        :value="displayedTime"
        :disabled="!player.duration"
        class="h-4 w-full shrink-0 cursor-pointer accent-hz-500 disabled:cursor-not-allowed sm:h-2"
        aria-label="再生位置"
        @input="onInput"
        @change="onChange"
      >

      <div class="flex min-h-0 flex-1 items-center gap-2 sm:gap-3">
        <img :src="youtubeThumbnail(player.track.videoId, 'mq')" :alt="player.track.title" class="h-10 w-10 shrink-0 rounded object-cover sm:h-12 sm:w-12" loading="lazy">
        <div class="min-w-0 flex-1">
          <p class="truncate text-[12.5px] font-semibold text-stone-100">{{ player.track.title }}</p>
          <p class="truncate text-[11px] text-stone-400">{{ player.track.producerName }} / {{ player.track.voiceSynthesizer }}</p>
        </div>

        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hz-500/50 bg-hz-500/15 text-hz-200 hover:bg-hz-500/25"
          :aria-label="player.isPlaying ? '一時停止' : '再生'"
          @click="player.togglePlayback()"
        >{{ player.isPlaying ? '❚❚' : '▶' }}</button>

        <span class="shrink-0 font-mono text-[11px] text-stone-400 sm:text-[11.5px]">
          {{ formatTimestamp(displayedTime) }} / {{ formatTimestamp(player.duration) }}
        </span>
      </div>
    </div>
  </div>
</template>
