/**
 * server/utils/lounge.ts
 * ---------------------------------------------------------------
 * AI ラウンジ（共有チャット）の読み書き。
 *
 *  - 会話は lounge_messages に残り、来客全員が同じログを見る
 *  - 店主（gemma）の発言は user_id = null / role = 'assistant'
 *  - 新着は /api/lounge/events（SSE）が id カーソルで配る
 */
import { asc, desc, eq, gt, sql } from 'drizzle-orm'
import type { LoungeMessageDto } from '~~/shared/types'
import type { User } from '../database/schema'
import { schema, useDb } from './db'

const PAGE_SIZE = 100

/** 店主（AI）の発言者名 */
export const LOUNGE_AI_DISPLAY_NAME = '店主（gemma）'

/** カーソル（?after=）を安全な数値に */
export function parseLoungeCursor(value: unknown): number {
  const cursor = Number(value)
  return Number.isSafeInteger(cursor) && cursor > 0 ? cursor : 0
}

interface LoungeRow {
  id: number
  role: string
  kind: string
  content: string
  createdAt: Date
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

function toDto(row: LoungeRow): LoungeMessageDto {
  const assistant = row.role === 'assistant'
  return {
    id: row.id,
    role: assistant ? 'assistant' : 'user',
    kind: assistant && row.kind === 'monologue' ? 'monologue' : 'reply',
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    author: assistant
      ? { username: null, displayName: LOUNGE_AI_DISPLAY_NAME, avatarUrl: null }
      : {
          username: row.username,
          displayName: row.displayName ?? row.username ?? 'ゲスト',
          avatarUrl: row.avatarUrl,
        },
  }
}

/**
 * カーソルより後の発言（古い順・最大 100 件）。
 * カーソル 0 のときは直近 100 件を古い順で返す。
 */
export function listLoungeMessages(after = 0): LoungeMessageDto[] {
  const db = useDb()
  const query = db
    .select({
      id: schema.loungeMessages.id,
      role: schema.loungeMessages.role,
      kind: schema.loungeMessages.kind,
      content: schema.loungeMessages.content,
      createdAt: schema.loungeMessages.createdAt,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.loungeMessages)
    .leftJoin(schema.users, eq(schema.loungeMessages.userId, schema.users.id))

  const rows = after > 0
    ? query.where(gt(schema.loungeMessages.id, after)).orderBy(asc(schema.loungeMessages.id)).limit(PAGE_SIZE).all()
    : query.orderBy(desc(schema.loungeMessages.id)).limit(PAGE_SIZE).all().reverse()

  return rows.map(toDto)
}

/** 直前の店主の発言（まだ一度も話していなければ null） */
export function lastLoungeAssistantTurn(): { id: number; createdAt: Date } | null {
  return useDb()
    .select({ id: schema.loungeMessages.id, createdAt: schema.loungeMessages.createdAt })
    .from(schema.loungeMessages)
    .where(eq(schema.loungeMessages.role, 'assistant'))
    .orderBy(desc(schema.loungeMessages.id))
    .limit(1)
    .get() ?? null
}

/** 店主がまだ返事していない、来客の発言（古い順） */
export function pendingLoungeMessages(afterId: number): LoungeMessageDto[] {
  return listLoungeMessages(afterId).filter(message => message.role === 'user')
}

/** その人の最後の発言時刻（連投チェック用） */
export function lastUserMessageAt(userId: string): Date | null {
  return useDb()
    .select({ createdAt: schema.loungeMessages.createdAt })
    .from(schema.loungeMessages)
    .where(eq(schema.loungeMessages.userId, userId))
    .orderBy(desc(schema.loungeMessages.id))
    .limit(1)
    .get()?.createdAt ?? null
}

/** 来客の発言がひとつでもあるか（誰もいない部屋で独り言を始めないための判定） */
/**
 * この部屋に来客が来たことがあるか（一度も来ていない部屋では店主は黙っている）。
 * 直近 100 件だけを見ると、店主の独り言で埋まったときに「誰もいない」と誤判定して
 * 永久に黙り込むため、履歴全体に来客の発言があるかを見る。
 */
export function hasVisitorMessages(): boolean {
  const row = useDb()
    .select({ id: schema.loungeMessages.id })
    .from(schema.loungeMessages)
    .where(eq(schema.loungeMessages.role, 'user'))
    .limit(1)
    .get()
  return Boolean(row)
}

/** 来客の発言を共有チャットへ書き込む */
export function createLoungeUserMessage(user: User, content: string): LoungeMessageDto {
  const created = useDb()
    .insert(schema.loungeMessages)
    .values({ userId: user.id, role: 'user', kind: 'reply', content })
    .returning()
    .get()

  return toDto({
    id: created.id,
    role: created.role,
    kind: created.kind,
    content: created.content,
    createdAt: created.createdAt,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  })
}

/**
 * 店主（AI）の発言を共有チャットへ書き込む。
 * kind: 'reply' = 呼ばれて答えた返事 / 'monologue' = 呼ばれていないときの独り言
 */
export function createLoungeAssistantMessage(content: string, kind: 'reply' | 'monologue' = 'reply'): LoungeMessageDto {
  const created = useDb()
    .insert(schema.loungeMessages)
    .values({ userId: null, role: 'assistant', kind, content })
    .returning()
    .get()

  return toDto({
    id: created.id,
    role: created.role,
    kind: created.kind,
    content: created.content,
    createdAt: created.createdAt,
    username: null,
    displayName: null,
    avatarUrl: null,
  })
}

// ============================================================
// 店主（AI）の番を回すための錠
// dev では Nitro が複数インスタンス立ち上がることがあるので、状態は DB の 1 行に持つ。
// （プロセス内のフラグだけだと、同じ返事が二重に投稿されてしまう）
// ============================================================

const AI_STATE_ID = 1
/** 生成が想定より長引いたとき、錠を無効とみなす時間（ミリ秒） */
export const AI_LOCK_STALE_MS = 5 * 60 * 1000

/**
 * 錠の行（id = 1）を用意する。DB の更新を読み取り側で起こさないよう、
 * 「一度だけ」実行して以降はスキップする（書き込みは店主の番を掴むときだけ）。
 */
let stateRowEnsured = false

function ensureAiStateRow(): void {
  if (stateRowEnsured) return
  useDb().run(sql`INSERT OR IGNORE INTO lounge_ai_state (id, thinking_since, next_turn_at) VALUES (${AI_STATE_ID}, NULL, 0)`)
  stateRowEnsured = true
}

/**
 * 「店主の番」を掴めたら true。
 * 誰も返事中でないことに加えて、
 *   - 通常は「直前の返事から intervalMs 以上たっている」
 *   - force（＝店主さんと呼ばれた）ときは間隔を無視してすぐ返事する
 */
export function acquireLoungeAiTurn(intervalMs: number, options: { force?: boolean } = {}): boolean {
  ensureAiStateRow()
  const now = Date.now()
  const result = options.force
    ? useDb().run(sql`
        UPDATE lounge_ai_state
           SET thinking_since = ${now}
         WHERE id = ${AI_STATE_ID}
           AND (thinking_since IS NULL OR thinking_since <= ${now - AI_LOCK_STALE_MS})
      `)
    : useDb().run(sql`
        UPDATE lounge_ai_state
           SET thinking_since = ${now}
         WHERE id = ${AI_STATE_ID}
           AND (thinking_since IS NULL OR thinking_since <= ${now - AI_LOCK_STALE_MS})
           AND next_turn_at <= ${now}
      `)
  return result.changes === 1
}

/** 店主の番を終える。次の番は intervalMs 後 */
export function releaseLoungeAiTurn(intervalMs: number): void {
  const now = Date.now()
  useDb().run(sql`
    UPDATE lounge_ai_state
       SET thinking_since = NULL, next_turn_at = ${now + intervalMs}
     WHERE id = ${AI_STATE_ID}
  `)
}

/** 今、店主が返事を作っている最中か */
export function isLoungeAiThinking(): boolean {
  const row = useDb()
    .select({ thinkingSince: schema.loungeAiState.thinkingSince })
    .from(schema.loungeAiState)
    .where(eq(schema.loungeAiState.id, AI_STATE_ID))
    .get()

  const since = row?.thinkingSince?.getTime()
  return typeof since === 'number' && Date.now() - since < AI_LOCK_STALE_MS
}

/** 次に店主が話せる時刻（エポック ms）。まだ一度も話していなければ null */
export function nextLoungeAiTurnAt(): number | null {
  const row = useDb()
    .select({ nextTurnAt: schema.loungeAiState.nextTurnAt })
    .from(schema.loungeAiState)
    .where(eq(schema.loungeAiState.id, AI_STATE_ID))
    .get()

  const at = row?.nextTurnAt?.getTime()
  return typeof at === 'number' && at > 0 ? at : null
}

