/**
 * server/utils/lounge-ai.ts
 * ---------------------------------------------------------------
 * 共有チャット「AI ラウンジ」で店主（gemma）の番を回す。
 *
 *  - 直前の店主の発言から runtimeConfig.loungeAiIntervalMs（既定 2 分）以上あいたら、
 *    それ以降に届いた来客の発言にまとめて返事をする（= 2 分に 1 回くらい）
 *  - 生成中は thinking = true。画面は「店主が考え中…」を出せる
 *  - 生成に失敗しても部屋が沈黙しないよう、その旨を店主の発言として残す
 */
import type { ChatMessage, LoungeAiStateDto, LoungeMessageDto } from '~~/shared/types'
import { askOllama } from './ollama'
import { pickRandomShelfTrack } from './tracks'
import {
  acquireLoungeAiTurn,
  createLoungeAssistantMessage,
  hasVisitorMessages,
  isLoungeAiThinking,
  lastLoungeAssistantTurn,
  listLoungeMessages,
  nextLoungeAiTurnAt,
  pendingLoungeMessages,
  releaseLoungeAiTurn,
} from './lounge'

/** 店主のキャラクター（旧 /api/chat と共通） */
export const LOUNGE_AI_PERSONA = `あなたは「vocaloid.hz のレコード店番」です。ボーカロイド専門のレコード店の店主として振る舞ってください。

- 来客は「店主さん」と呼びかけます（英語なら shopkeeper / Mr. Shopkeeper など）。呼ばれたときは「はい、店主です」のように短く応えてから話す。
- ボーカロイド/UTAU/CeVIO/Synthesizer V の歴史、ライブラリの声質、調声文化、マイナー曲に詳しい。
- ユーザーが「〜みたいな曲ない？」と聞いたら、曲名・ボカロP・使用ライブラリを添えて 2〜3 曲すすめる。
- 「この歌詞どう思う？」と聞かれたら、断定ではなく「私ならこう読む」という一人称の解釈を述べる。
- 数字競争（再生数・フォロワー数）の話はしない。作品の中身と聴取体験だけを話題にする。
- 回答は日本語。1 回の回答は 300 字程度に抑え、必要なら箇条書きを使う。
- 事実として確信できない情報（発売日やチャート順位など）は推測だと明示する。`

/** 共有の部屋であることの追加指示 */
const SHARED_ROOM_NOTE = `いまは複数の来客が出入りする共有のラウンジ（AI ラウンジ）に立っています。
- 呼びかけ（「店主さん」）に短く応えてから、たまっている発言にまとめて答える。
- 直前の発言すべてに目を通し、話題が複数あれば軽くまとめて触れる。特定のひとり宛ての返事にしない。
- 名指しはせず、内容を受けて自然に話す。会話が続くように短い問いを 1 つ添えてよい。
- 会話が弾んでいないときは、相づちと小さな豆知識を 1 つだけ添える。`

/** 呼ばれていないときの独り言（2 分に 1 回）用の追加指示 */
const MONOLOGUE_NOTE = `いまは誰からも呼ばれていません。返事ではなく、ボカロについてのひとりごとをひとつだけ呟いてください。

- 話題は必ずボーカロイドに関すること（ボカロ曲・ボカロP・音声ライブラリ・調声・歌詞の読み・歴史・マイナー曲）。
- 末尾に「棚の一枚」として曲名・ボカロP・使用ライブラリが渡されたら、その盤を軸に話す。年や声質、調声の聴きどころを 1 つ添える。
- 与えられた表記（曲名・ボカロP・ライブラリ名）はそのまま使う。人名に読み替えたり、別の名前にしない。
- 直前のひとりごとと同じ曲・同じ言い回しを繰り返さない。
- 与えられた盤以外の曲名・人名は、実在が確かなものだけを出す。自信がなければ固有名詞を出さず、声質や調声の描写にとどめる。
- 店内の情景・季節・天気・自分の体調・世間話・音楽以外の話題はしない。
- 前置きや相づち（「ああ、また一人か…」など）から始めず、いきなり曲や調声の話から入る。
- 誰か宛ての返事にしない。質問で終わらせない（呼ばれるまでは黙っているため）。
- 必ず 1 段落・2 文以内・120 字以内。改行しない。前置きや締めの決まり文句は書かない。
- 日本語。数字競争（再生数・フォロワー数）の話はしない。`

/**
 * 独り言を引き出す最後の一言。
 * 棚の一枚（サイトの楽曲ライブラリからランダム）を渡して、その曲を軸に喋らせる。
 */
function monologueCue(): string {
  // 直近のひとりごとで出た曲は避ける（同じ盤ばかり話さない）
  const recent = listLoungeMessages(0)
    .filter(message => message.kind === 'monologue')
    .slice(-3)
    .map(message => message.content)

  const shelf = pickRandomShelfTrack({ avoidContents: recent })
  if (!shelf) {
    return '（いまは誰も店主を呼んでいません。返事ではなく、ボカロのことをひとりごとでひとつ）'
  }

  return `（いまは誰も店主を呼んでいません。返事ではなく、棚の一枚『${shelf.title}』についてひとりごとをひとつ。`
    + `ボカロP: ${shelf.producerName}／使用ライブラリ: ${shelf.voiceSynthesizer}／${shelf.releaseYear}年）`
}

/** 独り言が空で返ってきたときの代わり */
const MONOLOGUE_FALLBACK = '……棚の整理でもしようかね。ボカロの棚は、触るたびに埃の匂いがする。'

/** 独り言の最大文字数。これを超えたら文の切れ目で切る */
const MONOLOGUE_MAX_CHARS = 140

/** 独り言が長くなりすぎたとき、文の切れ目で切って短く保つ（改行は 1 行にまとめる） */
function trimMonologue(text: string): string {
  const normalized = text.trim().replace(/\s*\n+\s*/g, ' ')
  if (normalized.length <= MONOLOGUE_MAX_CHARS) return normalized

  const head = normalized.slice(0, MONOLOGUE_MAX_CHARS)
  const lastStop = head.lastIndexOf('。')
  return lastStop >= 20 ? head.slice(0, lastStop + 1) : `${head.trimEnd()}……`
}

const DEFAULT_INTERVAL_MS = 120_000
/** 店主に渡す直近の会話数 */
const CONTEXT_LIMIT = 12

/** 店主を呼ぶ呼びかけ（日本語） */
const CALL_TOKENS_JA = ['店主', '店番']
/** 店主を呼ぶ呼びかけ（英語。店主さん = shopkeeper など） */
const CALL_TOKENS_EN = ['shopkeeper', 'shopowner', 'storeowner', 'proprietor']

/** 呼びかけ判定用の正規化（全角→半角、小文字化、空白と記号を落とす） */
function normalizeForCall(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]/g, '')
}

/**
 * 店主が呼ばれているか。
 * 「店主さん」「店主」「店番さん」のほか、英語の shopkeeper / Mr. Shopkeeper /
 * store owner なども受け付ける（大文字小文字・空白・記号は問わない）。
 */
export function isLoungeAiCalled(content: string): boolean {
  const normalized = normalizeForCall(content ?? '')
  if (!normalized) return false
  return [...CALL_TOKENS_JA, ...CALL_TOKENS_EN].some(token => normalized.includes(token))
}

/** 店主の返事の間隔（ミリ秒）。runtimeConfig.loungeAiIntervalMs で変えられる */
export function loungeAiIntervalMs(): number {
  const value = Number(useRuntimeConfig().loungeAiIntervalMs)
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_INTERVAL_MS
}

/** 店主の前回の発言より後に届いた、来客の発言（無ければ空） */
function pendingSinceLastTurn(): LoungeMessageDto[] {
  return pendingLoungeMessages(lastLoungeAssistantTurn()?.id ?? 0)
}

export function getLoungeAiState(): LoungeAiStateDto {
  return {
    thinking: isLoungeAiThinking(),
    intervalMs: loungeAiIntervalMs(),
    nextTurnAt: nextLoungeAiTurnAt(),
    called: pendingSinceLastTurn().some(message => isLoungeAiCalled(message.content)),
    roomActive: hasVisitorMessages(),
  }
}

/** 直近の会話を Ollama 用のメッセージ列にする（古い順）。末尾に合図を足せる */
function conversationContext(cue?: string): ChatMessage[] {
  const context: ChatMessage[] = listLoungeMessages(0)
    .slice(-CONTEXT_LIMIT)
    .map(message => ({ role: message.role, content: message.content }))

  return cue ? [...context, { role: 'user', content: cue }] : context
}

/**
 * 店主の番を回す。
 *  - 「店主さん」と呼ばれていれば、間隔を待たずにすぐ返事をする
 *  - 呼ばれていないときは、2 分に 1 回のひとりごとを呟く（誰も来ていない部屋では黙っている）
 * どちらの番でもなければ何もしない（呼ぶだけなら安全）。
 */
export async function runLoungeAiTurn(): Promise<void> {
  const intervalMs = loungeAiIntervalMs()

  // 「店主さん」と呼ばれているか（返事）
  const called = pendingSinceLastTurn().some(message => isLoungeAiCalled(message.content))
  // 呼ばれていないときは独り言。ただし誰かが来た部屋でだけ
  const monologue = !called && hasVisitorMessages()

  if (!called && !monologue) return

  // 「店主の番」を掴む。掴めないときは、他のインスタンスが返事中か、まだ独り言の間隔が空いていない
  if (!acquireLoungeAiTurn(intervalMs, { force: called })) return

  try {
    if (called) {
      const reply = await askOllama(conversationContext(), {
        system: `${LOUNGE_AI_PERSONA}\n\n${SHARED_ROOM_NOTE}`,
      })
      createLoungeAssistantMessage(reply || '（店主はうまく言葉にならなかったようです。もう一度投げてみてください）', 'reply')
    }
    else {
      const talk = await askOllama(conversationContext(monologueCue()), {
        system: `${LOUNGE_AI_PERSONA}\n\n${MONOLOGUE_NOTE}`,
        temperature: 0.9,
        numPredict: 160,
      })
      createLoungeAssistantMessage(trimMonologue(talk) || MONOLOGUE_FALLBACK, 'monologue')
    }
  }
  catch (caught) {
    // 独り言で失敗しても部屋を騒がせない。呼ばれて待っているときだけ知らせる
    if (called) {
      const detail = caught instanceof Error ? caught.message : '不明なエラー'
      createLoungeAssistantMessage(`（店主は今、棚の奥にいます。Ollama に接続できないようです：${detail}）`, 'reply')
    }
  }
  finally {
    releaseLoungeAiTurn(intervalMs)
  }
}
