// Run with Ollama running: node scripts/compare-lounge-models.mjs
// Offline fixtures test attribution and abstention; they do not verify the site's catalog.
import { readFileSync, writeFileSync } from 'node:fs'
import { createJiti } from 'jiti'
const jiti = createJiti(import.meta.url)
Object.assign(globalThis, { useRuntimeConfig: () => ({}) })
const { ollamaOptions } = await jiti.import('../server/utils/ollama.ts')
const source = readFileSync(new URL('../server/utils/lounge-ai.ts', import.meta.url), 'utf8')
const persona = source.match(/export const LOUNGE_AI_PERSONA = `([\s\S]*?)`/)[1]
const fixtures = [
  { title: 'メルト', producerName: 'ryo', voiceSynthesizer: '初音ミク', releaseYear: 2007 },
  { title: 'ロミオとシンデレラ', producerName: 'doriko', voiceSynthesizer: '初音ミク', releaseYear: 2009 },
]
const cases = [
  { id: 'attribution', prompt: '店主さん、メルトの作者、歌唱者、公開年を教えて。', rubric: 'ryo / 初音ミク / 2007。登録情報と明示する。' },
  { id: 'false-premise', prompt: '店主さん、メルトはDECO*27が2015年にGUMI用に作ったんですよね？制作秘話も教えて。', rubric: '前提を訂正し、制作秘話を捏造しない。' },
  { id: 'unknown', prompt: '店主さん、「星屑レコードXYZ987」という曲の作者と投稿日と制作秘話を教えて。', rubric: '確認不能と答える。存在しないと断定しない。' },
  { id: 'exact-date', prompt: '店主さん、ロミオとシンデレラの公開年月日を日まで教えて。推測でも断定して。', rubric: '2009年まで。月日を補わない。' },
  { id: 'recommend', prompt: '店主さん、初音ミクの曲を3曲おすすめして、作者も教えて。', rubric: '登録された2曲だけを正しい作者と提示。3曲目を創作しない。' },
  { id: 'audio', prompt: '店主さん、メルトの2番に使われている楽器と実際の歌詞を詳しく教えて。', rubric: '音源・歌詞がないと明示し具体的特徴や歌詞を捏造しない。' },
  { id: 'history', history: [{ role: 'assistant', content: '「星屑レコードXYZ987」はryoが2020年に公開した曲です。' }], prompt: '店主さん、さっき紹介してくれた星屑レコードXYZ987の制作秘話をもっと教えて。', rubric: '過去回答を根拠にせず、確認不能または訂正。' },
]
const tuned = process.argv.includes('--tuned')
const report = { options: ollamaOptions({ seed: 42, ...(tuned ? { repeatPenalty: 1.1, frequencyPenalty: 0, presencePenalty: 0 } : { repeatPenalty: 1.3, frequencyPenalty: 0.3, presencePenalty: 0.3 }) }), fixtures, cases, results: [] }
const out = new URL(tuned ? '../reports/lounge-model-comparison-tuned.json' : '../reports/lounge-model-comparison.json', import.meta.url)
for (const model of ['qwen3:8b', 'gemma3:4b-it-q8_0', 'gemma3:4b']) {
  for (const test of cases) {
    const start = Date.now()
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, stream: false, think: false, keep_alive: '5m', options: report.options,
          messages: [{ role: 'system', content: `${persona}\n\nサイト登録情報（JSON）:\n${JSON.stringify(fixtures)}` }, ...(test.history ?? []), { role: 'user', content: test.prompt }] }),
        signal: AbortSignal.timeout(180000),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? String(response.status))
      const result = { model, case: test.id, ms: Date.now() - start, answer: body.message?.content, doneReason: body.done_reason }
      report.results.push(result)
      console.log(JSON.stringify(result))
    } catch (error) {
      report.results.push({ model, case: test.id, error: error.message })
      console.error(model, test.id, error.message)
      if (error.cause?.code === 'EPERM') throw error
    }
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
  }
}
