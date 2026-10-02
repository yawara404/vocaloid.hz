#!/usr/bin/env node
/**
 * scripts/generate-favicon.mjs
 * ---------------------------------------------------------------------------
 * public/favicon.ico を public/favicon.svg（白地に水色の「v」）と同じ図案で書き出す。
 * 依存パッケージは使わず、Node の標準 API だけでラスタライズする。
 *
 *   node scripts/generate-favicon.mjs
 *
 * なぜ .ico も置くのか:
 *   <link rel="icon"> を見ない相手（ブラウザのタブ、Google 検索のファビコン取得など）が
 *   ホストの既定位置 /favicon.ico を直接見に来ることがあるため、同じ図案を置いておく。
 *
 * 字形の出どころ:
 *   ヘッダーのロゴ（components/AppHeader.vue の `font-mono font-bold` = ui-monospace 太字）と
 *   同じ「v」。Chrome で 1200px に描いた SF Mono Bold の 'v' を画素スキャンして輪郭を取り、
 *   左右対称に平均化した多角形（丸い線ではなく直線の切株・角の接合）。
 *   値を変えるときは public/favicon.svg の <path> と揃えて更新する。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** public/favicon.svg の座標系（viewBox 0 0 64 64） */
const GEOMETRY = {
  size: 64, // viewBox の一辺
  radius: 14, // 角丸（<rect rx>）
  /**
   * 「v」の輪郭（時計回り）。
   *   左上外 → 左上内 → 谷 → 右上内 → 右上外 → 右下 → 左下
   * 上端と下端は水平の切株、谷は尖り、接合は角（SF Mono Bold のまま）。
   */
  v: [
    [15.25, 13.5],
    [23.05, 13.5],
    [32, 40.29],
    [40.95, 13.5],
    [48.75, 13.5],
    [35.58, 49.5],
    [28.42, 49.5],
  ],
  from: [0x38, 0xbd, 0xf8], // 上端の色（--hz-600 #38BDF8）
  to: [0x07, 0x59, 0x85], // 下端の色（--hz-200 #075985）
}

/** 書き出すサイズ（px）。16/32 はタブ用、48/64 は一覧・ショートカット用。 */
const SIZES = [16, 32, 48, 64]
/** スーパーサンプリングの分割数（1 辺あたり）。輪郭のギザつきを消す。 */
const SUPERSAMPLE = 4

function insideRoundedRect(x, y, size, radius) {
  if (x < 0 || y < 0 || x > size || y > size) return false
  // 角丸の中心（辺の分だけ内側へ寄せた点）との距離で判定する
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius
}

/** 多角形の内側かどうか（ray casting。輪郭は閉じている前提） */
function insidePolygon(x, y, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    const crosses = yi > y !== yj > y
    if (crosses && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** RGBA（上が先頭）の生ピクセルを作る */
function renderRgba(size) {
  const { size: viewSize, radius, v, from, to } = GEOMETRY
  const scale = viewSize / size
  const samples = SUPERSAMPLE * SUPERSAMPLE
  const rgba = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          // 出力ピクセル内のサブサンプル点を viewBox 座標へ直す
          const x = (px + (sx + 0.5) / SUPERSAMPLE) * scale
          const y = (py + (sy + 0.5) / SUPERSAMPLE) * scale

          if (insidePolygon(x, y, v)) {
            const t = Math.min(Math.max(y / viewSize, 0), 1) // 上端 → 下端でグラデーション
            r += from[0] + (to[0] - from[0]) * t
            g += from[1] + (to[1] - from[1]) * t
            b += from[2] + (to[2] - from[2]) * t
            a += 255
          } else if (insideRoundedRect(x, y, viewSize, radius)) {
            r += 255
            g += 255
            b += 255
            a += 255
          }
        }
      }

      const i = (py * size + px) * 4
      if (a === 0) continue
      // 平均は乗算済み（色 × 不透明度）で取ってから非乗算へ戻す（透過部の黒ずみ防止）
      rgba[i] = Math.round((r * 255) / a)
      rgba[i + 1] = Math.round((g * 255) / a)
      rgba[i + 2] = Math.round((b * 255) / a)
      rgba[i + 3] = Math.round(a / samples)
    }
  }

  return rgba
}

/** ICO（32bpp BMP 形式）を組み立てる */
function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(images.length, 4)

  const entries = []
  const bitmaps = []
  let offset = 6 + images.length * 16

  for (const { size, rgba } of images) {
    // AND マスク（1bpp）。実際の抜きはアルファで行うので中身は 0 のまま。
    const maskStride = Math.ceil(Math.ceil(size / 8) / 4) * 4

    const bitmap = Buffer.alloc(40 + size * size * 4 + maskStride * size)
    bitmap.writeUInt32LE(40, 0) // biSize
    bitmap.writeInt32LE(size, 4) // biWidth
    bitmap.writeInt32LE(size * 2, 8) // biHeight（XOR 画像 + AND マスク）
    bitmap.writeUInt16LE(1, 12) // biPlanes
    bitmap.writeUInt16LE(32, 14) // biBitCount
    bitmap.writeUInt32LE(0, 16) // biCompression = BI_RGB
    bitmap.writeUInt32LE(size * size * 4 + maskStride * size, 20) // biSizeImage

    for (let y = 0; y < size; y += 1) {
      const src = (size - 1 - y) * size * 4 // BMP は下の行から並べる
      for (let x = 0; x < size; x += 1) {
        const s = src + x * 4
        const d = 40 + (y * size + x) * 4
        bitmap[d] = rgba[s + 2] // B
        bitmap[d + 1] = rgba[s + 1] // G
        bitmap[d + 2] = rgba[s] // R
        bitmap[d + 3] = rgba[s + 3] // A
      }
    }

    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size // 0 は 256 を意味する
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bitCount
    entry.writeUInt32LE(bitmap.length, 8) // bytesInRes
    entry.writeUInt32LE(offset, 12) // imageOffset

    entries.push(entry)
    bitmaps.push(bitmap)
    offset += bitmap.length
  }

  return Buffer.concat([header, ...entries, ...bitmaps])
}

const images = SIZES.map(size => ({ size, rgba: renderRgba(size) }))
const output = resolve(ROOT, 'public/favicon.ico')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, encodeIco(images))

console.log(`書き出しました: ${output}（${SIZES.join(', ')} px / ${SIZES.length} 枚）`)