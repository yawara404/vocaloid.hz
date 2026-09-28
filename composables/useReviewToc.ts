/**
 * composables/useReviewToc.ts
 * ---------------------------------------------------------------
 * 記事本文（v-html で描画された Markdown）から目次を作る（LAYOUT_ARCHITECTURE §2.1）。
 *
 *  - markdown-it の出力には見出しの id が無いため、クライアント側で付与する
 *  - スクロール位置に合わせて「いま読んでいる章」を点灯させる（scrollspy）
 *  - クリックで、固定ヘッダー（56px）ぶんを差し引いてスムーズスクロール
 */
export interface TocItem {
  id: string
  text: string
  /** 2 = H2 / 3 = H3 */
  level: 2 | 3
}

/** 固定ヘッダー（56px）+ 余白。見出しを画面のこの位置まで運ぶ */
const HEADER_OFFSET = 76

export function useReviewToc(container: string) {
  const items = ref<TocItem[]>([])
  const activeId = ref<string | null>(null)
  let frame = 0

  /** 本文の見出しを集めて id を付ける */
  function collect(): void {
    if (!import.meta.client) return
    const root = document.querySelector(container)
    if (!root) return

    const headings = [...root.querySelectorAll<HTMLElement>('h2, h3')]
    items.value = headings.map((heading, index) => {
      if (!heading.id) heading.id = `toc-heading-${index + 1}`
      return {
        id: heading.id,
        text: heading.textContent?.trim() ?? '',
        level: heading.tagName === 'H2' ? 2 : 3,
      }
    })
    updateActive()
  }

  /** ヘッダー下のラインを越えている最後の見出しを「現在の章」とする */
  function updateActive(): void {
    if (!items.value.length) return
    let current = items.value[0]!.id
    for (const item of items.value) {
      const element = document.getElementById(item.id)
      if (!element) continue
      if (element.getBoundingClientRect().top - HEADER_OFFSET - 24 <= 0) current = item.id
      else break
    }
    activeId.value = current
  }

  function onScroll(): void {
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      updateActive()
    })
  }

  function goTo(id: string): void {
    const element = document.getElementById(id)
    if (!element) return
    const top = element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
    activeId.value = id
  }

  onMounted(async () => {
    await nextTick()
    collect()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
  })

  onBeforeUnmount(() => {
    if (frame) window.cancelAnimationFrame(frame)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  })

  return { items, activeId, goTo, collect }
}
