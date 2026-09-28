<script setup lang="ts">
import { youtubeThumbnail } from '~~/shared/youtube'

const props = defineProps<{
  src?: string | null
  videoId?: string | null
  alt: string
  eager?: boolean
}>()

const failed = ref(false)
const fallbackTried = ref(false)
const imageSrc = computed(() => {
  if (failed.value) return null
  return fallbackTried.value && props.videoId
    ? youtubeThumbnail(props.videoId, 'hq')
    : props.src || (props.videoId ? youtubeThumbnail(props.videoId, 'hq') : null)
})

watch(() => [props.src, props.videoId], () => {
  failed.value = false
  fallbackTried.value = false
})

function onError() {
  const fallback = props.videoId ? youtubeThumbnail(props.videoId, 'hq') : null
  if (!fallbackTried.value && fallback && imageSrc.value !== fallback) fallbackTried.value = true
  else failed.value = true
}
</script>

<template>
  <div class="relative overflow-hidden bg-gradient-to-br from-ink-800 via-hz-900/60 to-ink-950">
    <div class="absolute inset-0 flex items-center justify-center font-mono text-3xl text-hz-300/25" aria-hidden="true">♪</div>
    <img
      v-if="imageSrc"
      :src="imageSrc"
      :alt="alt"
      class="relative h-full w-full object-cover"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @error="onError"
    >
  </div>
</template>
