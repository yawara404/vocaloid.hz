/**
 * server/utils/db.ts
 * Nitro の auto-import 対象ディレクトリ。
 * サーバー側どこからでも `useDb()` / `schema` を参照できる。
 */
import { getDb, schema, type Db } from '../database/db'

export type { Db }
export { schema }

export function useDb(): Db {
  return getDb()
}
