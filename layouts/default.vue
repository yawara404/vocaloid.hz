<template>
  <!--
    アプリの外枠（LAYOUT_ARCHITECTURE §1.1）。
      ヘッダー 56px（sticky） → 本文（最小 h = 100dvh − ヘッダー − バー） → フッター → PlaybackBar 72px（fixed）
    下部の余白は「バーの高さ 72px + 24px」だけを main が確保し、
    Safe Area は PlaybackBar 側だけが持つ（多重マージンを作らない）。
  -->
  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:min-h-[calc(100dvh-56px-72px)]">
      <slot />
    </main>

    <AppFooter />
    <PlaybackBar />
  </div>
</template>
