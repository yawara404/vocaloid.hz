<script setup lang="ts">
/**
 * components/SideManifesto.vue
 * サイドバー固定コンテンツ①：永続アーカイブ宣言
 */
</script>

<template>
  <section class="panel p-5">
    <p class="panel-title">
      vocaloid.hzの楽しみ方
    </p>

    <!-- 行間 1.7 / 項目間 10px（space-y-2.5）で、長めの説明も読み切れるようにする -->
    <ul class="mt-4 space-y-2.5 text-[12px] leading-[1.7] text-stone-400">
      <li class="flex gap-2.5">
        <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hz-500" />
        <span>気に入ったレビューには、いいねで気持ちを残せます。</span>
      </li>
      <li class="flex gap-2.5">
        <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hz-500" />
        <span>好きな曲の感想を、あとから読めるレビューとして残せます。</span>
      </li>
      <li class="flex gap-2.5">
        <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hz-500" />
        <span>歌詞・歌声・サウンドの話を、好きなところから読めます。</span>
      </li>
      <li class="flex gap-2.5">
        <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hz-500" />
        <span>
          本文に
          <code class="rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-hz-300">01:24</code>
          のような時間を書くと、押した瞬間にプレイヤーがその秒へジャンプします。
        </span>
      </li>
    </ul>
  </section>
</template>
