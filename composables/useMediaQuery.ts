/**
 * composables/useMediaQuery.ts
 * ---------------------------------------------------------------
 * CSS のメディアクエリの結果を Vue の状態として読む。
 * レイアウト（LAYOUT_ARCHITECTURE）で「デスクトップでは常に開く / モバイルでは畳む」を
 * 切り替えたいときに使う。
 *
 * SSR 中と初回描画では false。マウント後に実際の値へ合わせる
 * （CSS の見た目はクラス側で担保しているので、ちらつきは出ない）。
 */
export function useMediaQuery(query: string) {
  const matches = ref(false)

  onMounted(() => {
    const list = window.matchMedia(query)
    matches.value = list.matches
    const onChange = (event: MediaQueryListEvent): void => {
      matches.value = event.matches
    }
    list.addEventListener('change', onChange)
    onBeforeUnmount(() => list.removeEventListener('change', onChange))
  })

  return matches
}
