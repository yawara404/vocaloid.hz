<script setup lang="ts">
/**
 * components/AppHeader.vue
 * ナビゲーション＋認証状態。数字競争を持ち込まない、静かなヘッダー。
 *
 * レイアウトの約束（Phase 2）:
 *   - 1行目の要素はすべて高さ 36px（h-9）に揃え、`items-center` で中心線を一致させる
 *   - [レビューを書く] と アカウント領域 の間には縦の仕切りを置き、役割の違う群を分ける
 *   - アカウントはアバター + ドロップダウンに集約し、右端のテキスト密度を下げる
 */
import type { ThemePreference } from '~~/shared/types'
import { useAuthStore } from '~~/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const searchInput = ref<HTMLInputElement | null>(null)
const searchText = ref('')
/** ヘルプモーダルの開閉 */
const helpOpen = ref(false)
/** モバイルのハンバーガーメニューの開閉 */
const menuOpen = ref(false)
/** アカウントメニュー（アバターのドロップダウン）の開閉 */
const userMenuOpen = ref(false)
/** テーマメニューの開閉 */
const themeMenuOpen = ref(false)
/** 表示テーマ（端末に追従 / ライト / ダーク） */
const { preference, setPreference, adoptServerPreference, resetToDevicePreference } = useTheme()

/** テーマメニューの選択肢 */
const themeOptions: { value: ThemePreference, label: string }[] = [
  { value: 'system', label: '端末に合わせる' },
  { value: 'light', label: 'ライト（白 × 水色）' },
  { value: 'dark', label: 'ダーク' },
]

/** アバター画像がないときの代わりに出す 1 文字 */
const avatarInitial = computed(() => (auth.user?.displayName ?? auth.user?.username ?? '?').slice(0, 1))

// ログイン（セッション取得）後に、サーバーに保存されている設定へ合わせる
watch(() => auth.user?.themePreference, (value: ThemePreference | undefined) => {
  if (value) adoptServerPreference(value)
})

/** 選んだテーマを即座に適用し、ログイン中はサーバーにも保存する */
function chooseTheme(value: ThemePreference): void {
  setPreference(value)
  // 直後にセッションを取り直しても巻き戻らないよう、手元のユーザー情報も更新する
  if (auth.user) auth.user.themePreference = value
  themeMenuOpen.value = false
}

watch(() => route.query.q, (value: unknown) => {
  searchText.value = typeof value === 'string' ? value : ''
})

// ページが変わったらメニューは閉じる
watch(() => route.fullPath, () => {
  menuOpen.value = false
  userMenuOpen.value = false
  themeMenuOpen.value = false
})

const links = [
  { to: '/reviews', label: 'レビュー' },
  { to: '/tracks', label: '楽曲ライブラリ' },
  { to: '/board', label: '掲示板' },
]

onMounted(() => {
  auth.fetchSession()
  window.addEventListener('keydown', onWindowKeydown)
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})

/**
 * メニューの外を押したら閉じる。
 * pointerdown は click より先に発火するため、ハンバーガー自身の開閉と競合しない。
 * ヘッダー内（ハンバーガー・メニュー・ヘッダーの各ボタン）は閉じない。
 * テンプレート ref に依存しないよう、目印の属性で判定する。
 */
function onDocumentPointerDown(event: PointerEvent) {
  if (!menuOpen.value && !userMenuOpen.value && !themeMenuOpen.value) return
  const target = event.target
  if (target instanceof Element && target.closest('[data-app-header]')) return
  menuOpen.value = false
  userMenuOpen.value = false
  themeMenuOpen.value = false
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (menuOpen.value || userMenuOpen.value || themeMenuOpen.value) {
      menuOpen.value = false
      userMenuOpen.value = false
      themeMenuOpen.value = false
      return
    }
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (searchInput.value?.getClientRects().length) searchInput.value.focus()
    else void navigateTo('/search')
  }
}

function submitSearch() {
  const q = searchText.value.trim()
  void navigateTo({ path: '/search', query: q ? { q } : {} })
  searchInput.value?.blur()
}

async function onLogout() {
  menuOpen.value = false
  userMenuOpen.value = false
  themeMenuOpen.value = false
  await auth.logout()
  // ログアウト後は、この端末に保存されている設定（なければ端末に追従）へ戻す
  resetToDevicePreference()
  await navigateTo('/')
}
</script>

<template>
  <header data-app-header class="sticky top-0 z-header border-b border-ink-700/60 bg-ink-950/85 backdrop-blur-md">
    <div class="mx-auto flex h-14 w-full max-w-6xl items-center gap-x-1.5 px-4 sm:gap-x-3 sm:px-6">
      <!-- モバイル: ロゴの左にハンバーガーメニュー -->
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-ink-850 hover:text-hz-200 sm:hidden"
        :aria-expanded="menuOpen"
        aria-controls="mobile-nav"
        aria-label="メニュー"
        @click="menuOpen = !menuOpen"
      >
        <svg v-if="!menuOpen" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <NuxtLink to="/" aria-label="vocaloid.hz のホームへ" class="group">
        <span class="font-mono text-lg font-bold tracking-tight text-hz-300 transition group-hover:text-hz-200">
          vocaloid.hz
        </span>
      </NuxtLink>

      <!-- デスクトップはロゴの右にナビ（モバイルは上のハンバーガーに格納） -->
      <nav class="hidden h-9 items-center gap-0.5 sm:flex sm:gap-1" aria-label="メイン">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="inline-flex h-9 items-center rounded-md px-2.5 text-[13px] text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
          :class="{ 'bg-ink-850 text-hz-200': route.path.startsWith(link.to) || (link.to === '/board' && route.path === '/lounge') }"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center justify-end gap-1.5 sm:gap-2">
        <!--
          検索: 入力欄もボタンも高さ 36px（h-9）に揃え、フォーカス時は水色のリングで示す。
        -->
        <form
          class="hidden h-9 min-w-0 items-center rounded-md border border-ink-700 bg-ink-900/75 transition focus-within:border-hz-500 focus-within:ring-2 focus-within:ring-hz-500/30 lg:flex lg:w-48 xl:w-64"
          role="search"
          @submit.prevent="submitSearch"
        >
          <button type="submit" class="flex h-full shrink-0 items-center px-2.5 text-stone-400 transition hover:text-hz-200" aria-label="検索">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
            </svg>
          </button>
          <input
            ref="searchInput"
            v-model="searchText"
            type="search"
            class="h-full min-w-0 flex-1 bg-transparent pl-0.5 pr-3 text-[12.5px] text-stone-200 outline-none placeholder:text-stone-400"
            placeholder="曲名、評者、キーワードで検索..."
            aria-label="サイト内を検索"
          >
        </form>

        <nav class="flex h-9 items-center gap-1 sm:gap-1.5" aria-label="アカウントとヘルプ">
          <NuxtLink to="/search" class="flex h-9 w-9 items-center justify-center rounded-md text-stone-400 transition hover:bg-ink-850 hover:text-hz-200 lg:hidden" aria-label="検索">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
            </svg>
          </NuxtLink>

          <template v-if="auth.isAuthenticated">
            <NuxtLink to="/editor" class="btn-primary h-9 !px-3 !py-0 !text-[13px]">
              <span class="hidden sm:inline">レビューを書く</span>
              <span class="sm:hidden">書く</span>
            </NuxtLink>

            <!-- 操作系（書く）とアカウント領域を分ける縦の仕切り -->
            <span class="mx-1 hidden h-6 w-px bg-ink-700 md:block" aria-hidden="true" />

            <div class="relative hidden md:block">
              <button
                type="button"
                class="flex h-9 items-center gap-1.5 rounded-md pl-1 pr-1.5 text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
                :aria-expanded="userMenuOpen"
                aria-haspopup="menu"
                aria-controls="account-menu"
                title="アカウント"
                @click="userMenuOpen = !userMenuOpen"
              >
                <img
                  v-if="auth.user?.avatarUrl"
                  :src="auth.user.avatarUrl"
                  :alt="auth.user.displayName"
                  class="h-6 w-6 rounded-full border border-ink-700 object-cover"
                  loading="lazy"
                >
                <span
                  v-else
                  class="flex h-6 w-6 items-center justify-center rounded-full border border-ink-700 bg-ink-850 text-[11px] font-semibold text-hz-200"
                  aria-hidden="true"
                >{{ avatarInitial }}</span>

                <svg class="h-3.5 w-3.5 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                leave-active-class="transition duration-100 ease-in"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div
                  v-if="userMenuOpen"
                  id="account-menu"
                  class="absolute right-0 top-[calc(100%+6px)] z-dropdown w-52 overflow-hidden rounded-lg border border-ink-700 bg-ink-900/95 p-1 shadow-modal backdrop-blur-md"
                  role="menu"
                  aria-label="アカウント"
                >
                  <p class="px-3 py-2">
                    <span class="block truncate text-[13px] font-semibold text-stone-100">{{ auth.user?.displayName }}</span>
                    <span class="block truncate font-mono text-[11px] text-stone-400">@{{ auth.user?.username }}</span>
                  </p>

                  <div class="my-1 border-t border-ink-800" aria-hidden="true" />

                  <NuxtLink
                    :to="`/users/${auth.user?.username}`"
                    role="menuitem"
                    class="block rounded-md px-3 py-2 text-[12.5px] text-stone-300 transition hover:bg-ink-850 hover:text-hz-200"
                    @click="userMenuOpen = false"
                  >
                    マイページ
                  </NuxtLink>
                  <NuxtLink
                    :to="`/reviews?author=${encodeURIComponent(auth.user?.username ?? '')}`"
                    role="menuitem"
                    class="block rounded-md px-3 py-2 text-[12.5px] text-stone-300 transition hover:bg-ink-850 hover:text-hz-200"
                    @click="userMenuOpen = false"
                  >
                    書いたレビュー
                  </NuxtLink>

                  <div class="my-1 border-t border-ink-800" aria-hidden="true" />

                  <button
                    type="button"
                    role="menuitem"
                    class="w-full rounded-md px-3 py-2 text-left text-[12.5px] text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
                    @click="onLogout"
                  >
                    ログアウト
                  </button>
                </div>
              </Transition>
            </div>
          </template>
          <NuxtLink v-else to="/login" class="btn-ghost h-9 !px-3 !py-0 !text-[13px]">
            ログイン
          </NuxtLink>

          <!--
            表示テーマ（Phase 3）。
            ボタンのアイコンは CSS が <html data-theme> を見て出し分けるため、
            SSR / ハイドレーションでもちらつかない（assets/css/main.css の .theme-toggle）。
            メニューでは「端末に合わせる / ライト / ダーク」の 3 択を持ち、
            ログイン中は選んだ設定をサーバーへ保存する（composables/useTheme.ts）。
          -->
          <div class="relative">
            <button
              type="button"
              class="theme-toggle flex h-9 w-9 items-center justify-center rounded-md text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
              :aria-expanded="themeMenuOpen"
              aria-haspopup="menu"
              aria-controls="theme-menu"
              aria-label="表示テーマ"
              title="表示テーマ"
              @click="themeMenuOpen = !themeMenuOpen"
            >
              <svg class="theme-icon-moon h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
              </svg>
              <svg class="theme-icon-sun h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
              </svg>
            </button>

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              leave-active-class="transition duration-100 ease-in"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="themeMenuOpen"
                id="theme-menu"
                class="absolute right-0 top-[calc(100%+6px)] z-dropdown w-64 overflow-hidden rounded-lg border border-ink-700 bg-ink-900/95 p-1 shadow-modal backdrop-blur-md"
                role="menu"
                aria-label="表示テーマ"
              >
                <p class="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  表示テーマ
                </p>

                <button
                  v-for="option in themeOptions"
                  :key="option.value"
                  type="button"
                  role="menuitemradio"
                  :aria-checked="preference === option.value"
                  class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[12.5px] transition hover:bg-ink-850"
                  :class="preference === option.value ? 'text-hz-200' : 'text-stone-300'"
                  @click="chooseTheme(option.value)"
                >
                  <svg v-if="option.value === 'system'" class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 5h16v11H4zM9 20h6M12 16v4" />
                  </svg>
                  <svg v-else-if="option.value === 'light'" class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
                  </svg>
                  <svg v-else class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
                  </svg>

                  <span class="min-w-0 flex-1">{{ option.label }}</span>

                  <svg v-if="preference === option.value" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                </button>

                <p class="mt-1 border-t border-ink-800 px-3 pb-2 pt-2 text-[10.5px] leading-relaxed text-stone-400">
                  {{ auth.isAuthenticated
                    ? 'この端末に保存されます。アカウントにも控えを残すので、別の端末で開いたときの初期表示になります。'
                    : 'この端末に保存されます。ログインすると、アカウントにも控えが残ります。' }}
                </p>
              </div>
            </Transition>
          </div>

          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-md text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
            aria-label="ヘルプ（使い方）"
            title="ヘルプ"
            @click="helpOpen = true"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.6 9.3a2.4 2.4 0 1 1 3.3 2.2c-.7.3-.9.8-.9 1.4v.3" />
              <path d="M12 16.7h.01" />
            </svg>
          </button>
        </nav>
      </div>
    </div>

    <!--
      モバイル: ナビ 3 つを格納したメニュー（ロゴ左のハンバーガーから開く）。
      absolute ではなくヘッダー内の通常フローに置くことで、iOS の backdrop-filter による
      クリップや z-index の影響を受けないようにしている。
    -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <nav
        v-if="menuOpen"
        id="mobile-nav"
        class="border-t border-ink-800/80 sm:hidden"
        aria-label="メイン（モバイル）"
      >
        <div class="mx-auto max-w-6xl space-y-1 px-4 py-3">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="block rounded-md px-3 py-2.5 text-[13.5px] text-stone-300 transition hover:bg-ink-850 hover:text-hz-200"
            :class="{ 'bg-ink-850 text-hz-200': route.path.startsWith(link.to) || (link.to === '/board' && route.path === '/lounge') }"
            @click="menuOpen = false"
          >
            {{ link.label }}
          </NuxtLink>

          <!-- アカウント（デスクトップはアバターのドロップダウンに集約している） -->
          <div class="mt-1 border-t border-ink-800 pt-2">
            <template v-if="auth.isAuthenticated">
              <p class="px-3 py-1.5 text-[11.5px] text-stone-400">
                <span class="font-mono">@{{ auth.user?.username }}</span> としてログイン中
              </p>
              <NuxtLink
                :to="`/users/${auth.user?.username}`"
                class="block rounded-md px-3 py-2.5 text-[13.5px] text-stone-300 transition hover:bg-ink-850 hover:text-hz-200"
                @click="menuOpen = false"
              >
                マイページ
              </NuxtLink>
              <NuxtLink
                :to="`/reviews?author=${encodeURIComponent(auth.user?.username ?? '')}`"
                class="block rounded-md px-3 py-2.5 text-[13.5px] text-stone-300 transition hover:bg-ink-850 hover:text-hz-200"
                @click="menuOpen = false"
              >
                書いたレビュー
              </NuxtLink>
              <button
                type="button"
                class="block w-full rounded-md px-3 py-2.5 text-left text-[13.5px] text-stone-400 transition hover:bg-ink-850 hover:text-hz-200"
                @click="onLogout"
              >
                ログアウト
              </button>
            </template>
            <NuxtLink
              v-else
              to="/login"
              class="block rounded-md px-3 py-2.5 text-[13.5px] text-stone-300 transition hover:bg-ink-850 hover:text-hz-200"
              @click="menuOpen = false"
            >
              ログイン / 新規登録
            </NuxtLink>
          </div>
        </div>
      </nav>
    </Transition>

    <HelpModal v-model="helpOpen" />
  </header>
</template>
