import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { createJiti } from 'jiti'

const temp = mkdtempSync(join(tmpdir(), 'lounge-ai-test-'))
process.env.NUXT_DB_PATH = join(temp, 'test.db')
const db = new Database(process.env.NUXT_DB_PATH)
db.exec(`
  PRAGMA user_version = 7;
  CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, display_name TEXT, avatar_url TEXT);
  CREATE TABLE lounge_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT,
    role TEXT, kind TEXT, content TEXT, created_at INTEGER DEFAULT 0);
  CREATE TABLE lounge_ai_state (id INTEGER PRIMARY KEY, thinking_since INTEGER, next_turn_at INTEGER);
  CREATE TABLE tracks (title TEXT, producer_name TEXT, voice_synthesizer TEXT, release_year INTEGER);
  INSERT INTO tracks VALUES ('メルト', 'ryo', '初音ミク', 2007), ('ロミオとシンデレラ', 'doriko', '初音ミク', 2009);
`)
const jiti = createJiti(import.meta.url, { alias: { '~~': fileURLToPath(new URL('../', import.meta.url)) } })
Object.assign(globalThis, { useRuntimeConfig: () => ({ loungeAiIntervalMs: 0, ollamaUrl: 'http://ollama.invalid/api/chat' }) })
const requests = []
let responses = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (_url, init) => {
  requests.push(JSON.parse(init.body))
  assert.ok(responses.length, 'unexpected extra generation')
  return Response.json({ message: { content: responses.shift() } })
}
let connection
try {
  const { isDegenerateAiText, isRepeatedMonologue } = await jiti.import('../server/utils/lounge-ai-quality.ts')
  assert.equal(isDegenerateAiText('まだ… '.repeat(20)), true)
  assert.equal(isDegenerateAiText('ボーカロイドの歌声が好きです。'.repeat(8)), true)
  assert.equal(isDegenerateAiText('2011年の作品です。価格は10000円でした。'), false)
  assert.equal(isRepeatedMonologue('声の子音に注目すると、歌い方の違いを楽しめます。', ['声の子音に注目すると歌い方の違いを楽しめます！']), true)

  const { runLoungeAiTurn } = await jiti.import('../server/utils/lounge-ai.ts')
  const { pickRandomShelfTrack } = await jiti.import('../server/utils/tracks.ts')
  const { getDatabase } = await jiti.import('../server/database/db.ts')
  const insert = db.prepare('INSERT INTO lounge_messages (role, kind, content) VALUES (?, ?, ?)')
  const latest = () => db.prepare('SELECT * FROM lounge_messages ORDER BY id DESC LIMIT 1').get()
  insert.run('assistant', 'reply', 'まだ… '.repeat(20))
  insert.run('user', 'reply', '店主さん、おすすめの曲は？')
  responses = ['まだ… '.repeat(20), '初音ミクの「メルト」はいかがでしょう。']
  await runLoungeAiTurn()
  assert.equal(latest().content, '初音ミクの「メルト」はいかがでしょう。')
  assert.ok(requests.every(request => request.messages.every(message => !message.content.includes('まだ…'))))
  assert.equal(requests.length, 2)
  assert.ok(requests.every(request => request.messages[0].content.includes('サイト登録情報（JSON）') && request.messages[0].content.includes('doriko')), 'replies and retries must receive catalog facts')
  assert.ok(requests.every(request => request.model === 'qwen3:8b' && request.think === false), 'Qwen must generate replies without a separate thinking phase')

  insert.run('user', 'reply', '店主さん、もう一曲')
  responses = ['同じ言葉の繰り返しです。'.repeat(8), 'まだ… '.repeat(20)]
  await runLoungeAiTurn()
  assert.match(latest().content, /うまく返事を作れませんでした/)
  assert.equal(db.prepare('SELECT thinking_since FROM lounge_ai_state').get().thinking_since, null)

  const before = latest().id
  responses = ['まだ… '.repeat(20)]
  await runLoungeAiTurn()
  assert.equal(latest().id, before, 'broken monologues must not be posted')
  assert.equal(requests.at(-1).messages.length, 2, 'monologue must contain only system and fresh cue')
  const fresh = '「メルト」を聴くときは、歌詞の言葉の響きにも注目してみたいですね。'
  responses = [fresh]
  await runLoungeAiTurn()
  assert.equal(latest().content, fresh)
  responses = [fresh]
  await runLoungeAiTurn()
  assert.equal(latest().id, before + 1, 'duplicate monologues must not be posted')
  assert.equal(pickRandomShelfTrack({ avoidContents: ['メルト', 'ロミオとシンデレラ'] }).title, 'メルト')
  assert.equal(pickRandomShelfTrack({ avoidContents: ['メルト'] }).title, 'ロミオとシンデレラ')
  connection = getDatabase().sqlite
  console.log('PASS: repetition detection, clean retry, bounded fallback, isolated monologues, duplicate suppression, track rotation')
}
finally {
  globalThis.fetch = originalFetch
  connection?.close()
  db.close()
  rmSync(temp, { recursive: true, force: true })
}
