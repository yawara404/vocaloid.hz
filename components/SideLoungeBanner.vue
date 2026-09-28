<script setup lang="ts">
/**
 * components/SideLoungeBanner.vue
 * 掲示板と二つの部屋への導線
 */
</script>

<template>
  <section class="panel relative overflow-hidden p-5">
    <div class="hz-grain pointer-events-none absolute inset-0 opacity-70" />

    <div class="relative">
      <p class="panel-title">
        掲示板
      </p>

      <p class="mt-3 text-[12px] leading-relaxed text-stone-400">
        みんなで話すリアルタイムチャットと、AI の店主も混ざる共有ラウンジがあります。
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <NuxtLink to="/board/chat" class="btn-ghost !py-1.5 !text-[12px]">リアルタイムチャット</NuxtLink>
        <NuxtLink to="/lounge" class="btn-ghost !py-1.5 !text-[12px]">AI ラウンジ</NuxtLink>
      </div>
    </div>
  </section>
</template>
