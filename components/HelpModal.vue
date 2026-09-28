<script setup lang="ts">
/**
 * components/HelpModal.vue
 * ---------------------------------------------------------------
 * ヘッダー右端の「?」から開く、サイトの使い方モーダル。
 * ヘッダーは backdrop-blur を持つため position: fixed の基準になってしまう。
 * そのため Teleport で body 直下に描画する。
 */
const open = defineModel<boolean>({ default: false })

const closeButton = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) open.value = false
}

watch(open, (value: boolean) => {
  if (!import.meta.client) return
  if (value) {
    nextTick(() => closeButton.value?.focus())
    document.body.classList.add('overflow-hidden')
  }
  else {
    document.body.classList.remove('overflow-hidden')
  }
})

onMounted(() => document.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('overflow-hidden')
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto bg-scrim px-3 pb-8 pt-[7vh] backdrop-blur-sm sm:px-4 sm:pb-10 sm:pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      @click.self="open = false"
    >
      <div class="panel w-full max-w-lg !bg-ink-900/95 p-4 shadow-modal sm:p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="panel-title">
              HELP
            </p>
            <h2 id="help-modal-title" class="mt-1 text-[15px] font-semibold text-stone-100">
              vocaloid.hz の使い方
            </h2>
          </div>
          <button
            ref="closeButton"
            type="button"
            class="rounded-md p-1.5 text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
            aria-label="ヘルプを閉じる"
            @click="open = false"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div class="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-[12px] leading-relaxed text-stone-400">
          <section>
            <h3 class="flex items-center gap-2 text-[12px] font-semibold text-stone-200">
              <span class="h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              読みたいとき
            </h3>
            <p class="mt-1.5 pl-3">
              レビューはログインなしで読めます。一覧は音声ライブラリ別、カテゴリ別（歌詞考察／調声論／アルバム総括）で絞り込めます。
            </p>
          </section>

          <section>
            <h3 class="flex items-center gap-2 text-[12px] font-semibold text-stone-200">
              <span class="h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              聴きながら読みたいとき
            </h3>
            <p class="mt-1.5 pl-3">
              本文中の <code class="rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-hz-300">01:23</code> を押すと、下部のプレイヤーがその位置から再生します。
            </p>
          </section>

          <section>
            <h3 class="flex items-center gap-2 text-[12px] font-semibold text-stone-200">
              <span class="h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              書きたくなったら
            </h3>
            <p class="mt-1.5 pl-3">
              ヘッダーの「レビューを書く」から。曲名・ボカロP・歌声ライブラリ・YouTube の URL を入れて、本文は Markdown で書きます（書式はその場でプレビューされます）。投稿にはログインが必要です（メールアドレス。サイトの設定により Google / Discord も使えます）。
            </p>
          </section>

          <section>
            <h3 class="flex items-center gap-2 text-[12px] font-semibold text-stone-200">
              <span class="h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              話したくなったら
            </h3>
            <p class="mt-1.5 pl-3">
              掲示板の「リアルタイムチャット」は、みんなの発言がその場で届きます。閲覧は誰でも、発言はログイン後です。
            </p>
          </section>

          <section>
            <h3 class="flex items-center gap-2 text-[12px] font-semibold text-stone-200">
              <span class="h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              AI ラウンジで店主を呼ぶとき
            </h3>
            <p class="mt-1.5 pl-3">
              「AI ラウンジ」は店主（AI）も混ざる共有チャットです。<span class="text-stone-300">「店主さん」</span>と書き込むと、店主がその場ですぐ返事をします（<span class="text-stone-300">大文字小文字は問いません</span>）。
            </p>
            <ul class="mt-1.5 space-y-1 pl-3">
              <li>呼びかけの例：「店主さん」「店主」「店番さん」「shopkeeper」「Mr. Shopkeeper」「store owner」</li>
              <li>呼ばないときは、約 2 分に 1 回、棚のボカロ曲についてひとりごとを呟きます（誰かへの返事ではありません）。</li>
              <li>話す曲は、サイトの楽曲ライブラリに登録されている盤から選ばれます。</li>
            </ul>
          </section>

          <section>
            <h3 class="flex items-center gap-2 text-[12px] font-semibold text-stone-200">
              <span class="h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              探したいとき
            </h3>
            <p class="mt-1.5 pl-3">
              ヘッダーの検索欄、または <kbd class="rounded border border-ink-700 bg-ink-850 px-1 font-mono text-[11px] text-stone-400">⌘</kbd> ＋ <kbd class="rounded border border-ink-700 bg-ink-850 px-1 font-mono text-[11px] text-stone-400">K</kbd>（Windows は Ctrl + K）でどこからでも。曲名・ボカロP・評者・キーワードで探せます。
            </p>
          </section>

          <section>
            <h3 class="flex items-center gap-2 text-[12px] font-semibold text-stone-200">
              <span class="h-1 w-1 shrink-0 rounded-full bg-hz-500" />
              気持ちを残したいとき
            </h3>
            <p class="mt-1.5 pl-3">
              ログインすると、レビューに「いいね」を付けられます。数字は競わず、読み返す時間を大切にする場所です。
            </p>
          </section>

          <p class="border-t border-ink-800 pt-3 text-[11px] text-stone-400">
            行き先は上のナビから。困ったときは、いつでもこのヘルプを開いてください。
          </p>
        </div>

        <div class="mt-4 flex justify-end">
          <button type="button" class="btn-ghost !py-1.5 !text-[12px]" @click="open = false">
            閉じる
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
