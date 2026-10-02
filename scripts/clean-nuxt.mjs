/**
 * scripts/clean-nuxt.mjs
 * ---------------------------------------------------------------
 * `.nuxt` を削除してから `nuxt dev` を起動するための前処理。
 *
 * 生成物（型定義・仮想モジュール・コンポーネント定義など）が壊れていて
 * 古い `.nuxt` のままでは起動できないときに使う。
 *
 * 参考: 以前あった
 *   Pre-transform error: Failed to resolve import "#app-manifest"
 * は `.nuxt` の削除ではなく「Nitro が `.nuxt/manifest/meta/<buildId>.json` を書く前に
 * Vite がそのファイルを解決しようとして失敗する」ことが原因だった。現在は
 * nuxt.config.ts の `hooks.ready` が開発サーバー起動直後にそのファイルを置くため、
 * `npm run dev` だけで出なくなった。
 */
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const target = resolve(process.cwd(), '.nuxt')
rmSync(target, { recursive: true, force: true })
console.log(`[dev:clean] 削除しました: ${target}`)
console.log('[dev:clean] 完了。このまま dev サーバーを起動します。')
