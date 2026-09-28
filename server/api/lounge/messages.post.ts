import type { LoungeMessageDto } from '~~/shared/types'
import { requireUser } from '../../utils/auth'
import { createLoungeUserMessage, lastUserMessageAt } from '../../utils/lounge'
import { runLoungeAiTurn } from '../../utils/lounge-ai'

/** 同じ人の連投を抑える間隔（ミリ秒） */
const MIN_GAP_MS = 1000

export default defineEventHandler(async (event): Promise<{ message: LoungeMessageDto }> => {
  const user = requireUser(event)
  const body = await readBody<{ content?: unknown }>(event)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) throw createError({ statusCode: 400, message: 'メッセージを入力してください' })
  if (content.length > 500) throw createError({ statusCode: 400, message: 'メッセージは500文字以内で入力してください' })

  const previous = lastUserMessageAt(user.id)
  if (previous && Date.now() - previous.getTime() < MIN_GAP_MS) {
    throw createError({ statusCode: 429, message: '少し待ってから送信してください' })
  }

  const message = createLoungeUserMessage(user, content)
  setResponseStatus(event, 201)

  // 店主の番（前回の発言から 2 分以上）が来ていれば、待たせずに裏で返事を用意する
  void runLoungeAiTurn().catch(() => {})

  return { message }
})
