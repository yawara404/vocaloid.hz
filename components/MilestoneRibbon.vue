<script setup lang="ts">
import type { VideoMilestone } from '~~/shared/types'

const props = withDefaults(defineProps<{
  milestone: VideoMilestone | null
  viewCount: number | null
  inline?: boolean
}>(), { inline: false })

const label = computed(() => ({
  hall: '殿堂',
  legend: '伝説',
  myth: '神話',
})[props.milestone ?? 'hall'])

const color = computed(() => ({
  hall: 'border-stone-500/50 text-stone-200',
  legend: 'border-hz-500/60 text-hz-200',
  myth: 'border-glow-400/70 text-glow-300',
})[props.milestone ?? 'hall'])
</script>

<template>
  <span
    v-if="milestone"
    :class="[
      color,
      'items-center gap-1.5 whitespace-nowrap rounded-md border bg-ink-950/90 px-2 py-1 text-[11px] font-semibold leading-none tracking-[0.08em] shadow-ribbon backdrop-blur-sm',
      inline
        ? 'inline-flex items-center'
        : 'pointer-events-none absolute right-1 top-1 z-10 inline-flex text-center',
    ]"
    :title="`YouTube ${viewCount?.toLocaleString('ja-JP')} 回再生`"
    :aria-label="`YouTube ${viewCount?.toLocaleString('ja-JP')} 回再生、${label}`"
  >
    <span aria-hidden="true" class="h-1 w-1 shrink-0 rounded-full bg-current" />
    {{ label }}
  </span>
</template>
