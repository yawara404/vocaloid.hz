<script setup lang="ts">
useSeoMeta({
  title: '掲示板',
  description: 'ボカロ好きと話せるリアルタイムチャットと、AI に曲の話ができるラウンジ。',
})
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <header class="mb-7">
      <p class="panel-title">VOCALOID.HZ</p>
      <h1 class="mt-2 text-2xl font-bold text-stone-100">掲示板</h1>
      <p class="mt-2 text-[13px] leading-relaxed text-stone-400">
        今聴いている曲のことを、気軽に話せる場所です。
      </p>
    </header>

    <div class="grid gap-5 sm:grid-cols-2">
      <NuxtLink to="/board/chat" class="panel group flex flex-col p-6 transition hover:border-hz-600/60">
        <span class="font-mono text-[11px] tracking-widest text-hz-300">LIVE CHAT</span>
        <h2 class="mt-3 text-lg font-semibold text-stone-100 transition group-hover:text-hz-200">リアルタイムチャット</h2>
        <p class="mt-2 flex-1 text-[12.5px] leading-relaxed text-stone-400">
          みんなでボカロの話をする部屋。新しい発言がその場で届きます。閲覧は誰でも、投稿はログイン後にできます。
        </p>
        <span class="mt-6 text-[12px] text-hz-300">チャットに入る →</span>
      </NuxtLink>

      <NuxtLink to="/lounge" class="panel group flex flex-col p-6 transition hover:border-glow-500/50">
        <span class="font-mono text-[11px] tracking-widest text-glow-300">AI LOUNGE</span>
        <h2 class="mt-3 text-lg font-semibold text-stone-100 transition group-hover:text-glow-300">AI ラウンジ</h2>
        <p class="mt-2 flex-1 text-[12.5px] leading-relaxed text-stone-400">
          AI の店主も混ざる共有の部屋。気になる曲を投げると、棚から似た盤を引いてきます。店主は約 2 分に 1 回、まとめて返事をします。
        </p>
        <span class="mt-6 text-[12px] text-glow-300">ラウンジに入る →</span>
      </NuxtLink>
    </div>
  </div>
</template>
