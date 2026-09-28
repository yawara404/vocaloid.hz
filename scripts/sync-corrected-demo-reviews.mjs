import Database from 'better-sqlite3'
import { resolve } from 'node:path'
import { review as king } from '../server/database/content/04-king.ts'
import { review as kanon } from '../server/database/content/05-hiiragi-magnetite.ts'
import { review as yoidore } from '../server/database/content/06-yoidore-shirazu.ts'
import {
  countWords,
  makeExcerpt,
  readingTimeMinutes,
  renderMarkdown,
} from '../shared/markdown.ts'

const db = new Database(process.env.NUXT_DB_PATH || resolve('data/vocaloid.hz.db'))

const corrections = [
  { review: king, oldTitle: '掠れを消さない勇気――KING と UTAU 重音テト' },
  { review: kanon, oldTitle: '磁石としての言葉――柊マグネタイトと語感の引力' },
  { review: yoidore, oldTitle: yoidore.title, oldText: '重音テトの掠れ' },
]

const updateTrack = db.prepare(`
  UPDATE tracks
  SET title = ?, producer_name = ?, voice_synthesizer = ?, engine_type = ?,
      release_year = ?, youtube_video_id = ?
  WHERE id = ?
`)
const updateReview = db.prepare(`
  UPDATE reviews
  SET title = ?, content_markdown = ?, content_html = ?, excerpt = ?,
      word_count = ?, reading_time_minutes = ?, category = ?,
      score_lyrics = ?, score_tuning = ?, score_structure = ?, updated_at = ?
  WHERE id = ?
`)
const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
const insertTag = db.prepare('INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)')
const insertReviewTag = db.prepare('INSERT OR IGNORE INTO review_tags (review_id, tag_id) VALUES (?, ?)')
const deleteReviewTags = db.prepare('DELETE FROM review_tags WHERE review_id = ?')

function slugify(value) {
  return value.trim().toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]/gu, '')
}

const sync = db.transaction(() => {
  let updated = 0
  for (const { review, oldTitle, oldText } of corrections) {
    const row = db.prepare(`
      SELECT r.id, r.title, r.content_markdown, t.id AS track_id
      FROM reviews r JOIN tracks t ON t.id = r.track_id
      WHERE r.slug = ?
    `).get(review.slug)
    if (!row || row.title !== oldTitle || (oldText && !row.content_markdown.includes(oldText))) continue

    updateTrack.run(
      review.track.title, review.track.producerName, review.track.voiceSynthesizer,
      review.track.engineType, review.track.releaseYear, review.track.youtubeVideoId,
      row.track_id,
    )
    updateReview.run(
      review.title, review.contentMarkdown, renderMarkdown(review.contentMarkdown),
      makeExcerpt(review.contentMarkdown), countWords(review.contentMarkdown),
      readingTimeMinutes(review.contentMarkdown), review.category,
      review.scores.lyrics, review.scores.tuning, review.scores.structure,
      Date.now(), row.id,
    )

    deleteReviewTags.run(row.id)
    for (const name of review.tags) {
      let tag = findTag.get(name)
      if (!tag) {
        let slug = slugify(name) || 'tag'
        const base = slug
        let suffix = 2
        while (db.prepare('SELECT id FROM tags WHERE slug = ?').get(slug)) slug = `${base}-${suffix++}`
        const id = crypto.randomUUID()
        insertTag.run(id, name, slug)
        tag = { id }
      }
      insertReviewTag.run(row.id, tag.id)
    }
    updated++
  }
  return updated
})

try {
  console.log(`修正したダミー記事: ${sync()} 件`)
}
finally {
  db.close()
}
