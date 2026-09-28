/**
 * scripts/clean-nuxt.mjs
 * ---------------------------------------------------------------
 * `.nuxt` を削除してから `nuxt dev` を起動するための前処理。
 *
 * 本番ビルド（nuxt build）の直後に `npm run dev` を起動すると、
 * 古い app manifest（.nuxt）が残っていて
 *   Pre-transform error: Failed to resolve import "#app-manifest"
 * がクライアント側で出て画面が動かなくなることがある。
 * その場合は `npm run dev:clean` を使う。
 */
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const target = resolve(process.cwd(), '.nuxt')
rmSync(target, { recursive: true, force: true })
console.log(`[dev:clean] 削除しました: ${target}`)
console.log('[dev:clean] 完了。このまま dev サーバーを起動します。')
