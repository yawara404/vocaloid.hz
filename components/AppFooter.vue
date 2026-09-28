<script setup lang="ts">
/**
 * components/AppFooter.vue
 */
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-ink-700/60 bg-ink-950/60">
    <div class="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
      <div>
        <NuxtLink to="/" aria-label="vocaloid.hz のホームへ" class="inline-block font-mono text-sm font-bold text-hz-300 transition hover:text-hz-200">
          vocaloid.hz
        </NuxtLink>
        <p class="mt-2 text-[12px] leading-relaxed text-stone-400">
          好きなボカロを、読んで語れるボカれびゅサイト。<br>
          曲の「ここが好き」を、自分の言葉で残せます。
        </p>
      </div>

      <div>
        <p class="panel-title">
          読む
        </p>
        <ul class="mt-3 space-y-1.5 text-[13px] text-stone-400">
          <li>
            <NuxtLink to="/reviews" class="hover:text-hz-200">レビューを読む</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/tracks" class="hover:text-hz-200">楽曲ライブラリ</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/board" class="hover:text-hz-200">掲示板</NuxtLink>
          </li>
        </ul>
      </div>

      <div>
        <p class="panel-title">
          書く
        </p>
        <ul class="mt-3 space-y-1.5 text-[13px] text-stone-400">
          <li>
            <NuxtLink to="/editor" class="hover:text-hz-200">レビューを書く</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/login" class="hover:text-hz-200">ログイン / 新規登録</NuxtLink>
          </li>
        </ul>
        <p class="mt-4 text-[11px] text-stone-400">
          作品と文章を、静かに読み返せる場所へ。
        </p>
      </div>
    </div>

    <div class="border-t border-ink-800/60 py-4 text-center text-[11px] text-stone-400">
      © {{ year }} vocaloid.hz — 各楽曲・イラストの権利はそれぞれの作者に帰属します。
    </div>
  </footer>
</template>
