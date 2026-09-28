/**
 * scripts/reset-db.mjs
 * ---------------------------------------------------------------
 * SQLite データベースファイルを削除して、次回起動時に
 * DDL 作成 + デモデータ seed をやり直させる。
 *
 *   npm run db:reset
 */
import { rmSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const file = process.env.NUXT_DB_PATH || './data/vocaloid.hz.db'
const targets = [file, `${file}-wal`, `${file}-shm`]

for (const target of targets) {
  const path = resolve(process.cwd(), target)
  if (existsSync(path)) {
    rmSync(path)
    console.log(`[db:reset] 削除しました: ${path}`)
  }
  else {
    console.log(`[db:reset] 存在しません: ${path}`)
  }
}

console.log('[db:reset] 完了。次回起動時に自動で再作成・再 seed されます。')
