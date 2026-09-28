<script setup lang="ts">
/**
 * components/ScoreMeters.vue
 * 多面的分析評価メーター。
 * 5段階の星ではなく「歌詞の文学性 / 調声アプローチ / 音響構造の複雑さ」を
 * 定性ラベルつきのバーで表示する。
 */
import type { ScoreDto } from '~~/shared/types'
import { METER_TITLES, scoreLabel } from '~~/shared/types'

defineProps<{ scores: ScoreDto }>()

const kinds = ['lyrics', 'tuning', 'structure'] as const
</script>

<template>
  <section class="panel p-5">
    <p class="panel-title">
      多面的分析評価
    </p>
    <p class="mt-1 text-[11px] leading-relaxed text-stone-400">
      点数ではなく「どの方向に振れているか」を示すメーターです。
    </p>

    <dl class="mt-4 space-y-4">
      <div v-for="kind in kinds" :key="kind">
        <div class="flex items-baseline justify-between gap-2">
          <dt class="text-[12.5px] font-semibold text-stone-200">
            {{ METER_TITLES[kind].title }}
          </dt>
          <dd class="text-[11.5px] text-hz-200">
            {{ scoreLabel(kind, scores[kind]) }}
          </dd>
        </div>

        <p class="mt-0.5 text-[11.5px] text-stone-400">
          {{ METER_TITLES[kind].hint }}
        </p>

        <div class="mt-1.5 flex gap-1" role="img" :aria-label="`${METER_TITLES[kind].title}: ${scoreLabel(kind, scores[kind])}`">
          <span
            v-for="step in 5"
            :key="step"
            class="h-1.5 flex-1 rounded-full transition"
            :class="scores[kind] && step <= (scores[kind] as number) ? 'bg-hz-500' : 'bg-ink-800'"
          />
        </div>
      </div>
    </dl>
  </section>
</template>
