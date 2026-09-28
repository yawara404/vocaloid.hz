/**
 * composables/useTheme.ts
 * ---------------------------------------------------------------
 * 表示テーマの切り替え。
 *
 *   'system' … 端末の設定（prefers-color-scheme）に自動で追従する。
 *              端末側でライト／ダークを切り替えた瞬間にも追従する。
 *   'light' | 'dark' … ユーザーが明示的に選んだ色
 *
 * 設定の優先順位（上が強い）:
 *   1. この端末の localStorage … この端末で「最後に選んだ設定」。表示はこれを最優先で使う
 *   2. サーバー（users.theme_preference）… アカウントの控え。
 *      まだ何も選んでいない端末で開いたときの初期表示になる
 *   3. 端末の設定 … どちらも無いとき＝'system'
 *
 * 表示中の色は <html data-theme="light|dark">、保存されている設定は
 * <html data-theme-pref="system|light|dark"> に持たせる。属性の初期値は
 * nuxt.config.ts のインラインスクリプト（アカウントの控えは SSR が data-theme-pref として描画）
 * が初回描画の前に決めるので、このコンポーザブルは読み取りと変更だけを行う。
 *
 *   const { preference, setPreference } = useTheme()
 */
import { THEME_STORAGE_KEY, normalizeThemePreference, type ThemeName, type ThemePreference } from '~~/shared/types'
import { useAuthStore } from '~~/stores/auth'

/** モバイルブラウザのUI色（<meta name="theme-color">） */
const THEME_COLORS: Record<ThemeName, string> = {
  light: '#F6F9FA',
  dark: '#0B0E10',
}

/** `<html data-theme-pref>` に載っている保存済みの設定 */
function domPreference(): ThemePreference | null {
  if (!import.meta.client) return null
  const value = document.documentElement.dataset.themePref
  return value ? normalizeThemePreference(value) : null
}

/** 端末に保存されている控え（未ログイン時・初回描画用） */
function storedPreference(): ThemePreference | null {
  if (!import.meta.client) return null
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value ? normalizeThemePreference(value) : null
  }
  catch {
    // プライベートモードなどで読めない場合は「端末に合わせる」に倒す
    return null
  }
}

/** 端末の設定（prefers-color-scheme） */
function systemTheme(): ThemeName {
  if (!import.meta.client) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 設定 → 実際に適用する色 */
function resolveTheme(preference: ThemePreference): ThemeName {
  return preference === 'system' ? systemTheme() : preference
}

export function useTheme() {
  /** 実際に表示している色 */
  const theme = useState<ThemeName>('theme', () => 'light')
  /** 保存されている設定（'system' なら端末に追従） */
  const preference = useState<ThemePreference>('theme-preference', () => 'system')

  /** 色を画面へ適用する */
  function paint(next: ThemeName): void {
    theme.value = next
    if (!import.meta.client) return

    document.documentElement.dataset.theme = next
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_COLORS[next])
  }

  /** ログイン中ならサーバー（アカウントの控え）にも保存する */
  function persist(next: ThemePreference): void {
    const auth = useAuthStore()
    if (!auth.user) return
    void $fetch('/api/auth/preferences', { method: 'PUT', body: { theme: next } }).catch(() => {})
  }

  interface ApplyOptions {
    /** この端末の控え（localStorage）にも残すか。既定は true */
    storeLocally?: boolean
    /** アカウントの控え（サーバー）にも保存するか。既定は true */
    saveRemotely?: boolean
  }

  /**
   * 設定を適用する。
   * 「端末で最後に選んだ設定」が最優先なので、変更時は端末の控えに必ず残す。
   */
  function setPreference(next: ThemePreference, options: ApplyOptions = {}): void {
    const { storeLocally = true, saveRemotely = true } = options

    preference.value = next

    if (import.meta.client) {
      document.documentElement.dataset.themePref = next

      if (storeLocally) {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next)
        }
        catch {
          // 保存できなくても表示の切り替えは成立させる
        }
      }
    }

    paint(resolveTheme(next))

    if (saveRemotely) persist(next)
  }

  /**
   * アカウントの控え（サーバー）へ合わせる。
   * この端末で既に選んだ設定があるなら、そちらを優先して何もしない
   * （＝ 最後の変更は端末ごとに覚える）。
   */
  function adoptServerPreference(value: ThemePreference | null | undefined): void {
    if (!value || storedPreference()) return
    setPreference(normalizeThemePreference(value), { storeLocally: false, saveRemotely: false })
  }

  /** ログアウト後は、この端末に保存されている設定へ戻す（無ければ端末に追従） */
  function resetToDevicePreference(): void {
    const stored = storedPreference()
    if (stored) {
      if (stored !== preference.value) setPreference(stored, { saveRemotely: false })
      return
    }
    if (preference.value !== 'system') {
      setPreference('system', { storeLocally: false, saveRemotely: false })
    }
  }

  onMounted(() => {
    // インラインスクリプト / SSR が決めた実際の値に合わせる（描画済みの色を尊重する）
    const applied = document.documentElement.dataset.theme
    if (applied === 'dark' || applied === 'light') theme.value = applied
    // この端末の控え → アカウントの控え（SSR が描画した属性） → 端末に追従
    preference.value = storedPreference() ?? domPreference() ?? 'system'

    // 'system' のあいだは、端末側の切り替えにその場で追従する
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemChange = (): void => {
      if (preference.value === 'system') paint(systemTheme())
    }
    query.addEventListener('change', onSystemChange)
    onBeforeUnmount(() => query.removeEventListener('change', onSystemChange))
  })

  return { theme, preference, setPreference, adoptServerPreference, resetToDevicePreference }
}
