/** 壊れた生成結果は、整形して隠す前に検出する。数字や罫線の連続は対象外。 */
export function isDegenerateAiText(text: string): boolean {
  if ((text.match(/…|\.\.\./g) ?? []).length >= 8) return true
  const compact = text.normalize('NFKC').replace(/\s+/g, '')
  const repeats = compact.matchAll(/(.{1,80}?)\1{3,}/gu)
  return [...repeats].some(match => /[\p{L}]/u.test(match[1]!))
}

/** 表記や句読点だけを変えた、直近の独り言の焼き直しも避ける。 */
export function isRepeatedMonologue(text: string, recent: string[]): boolean {
  const normalize = (value: string) => value.normalize('NFKC').replace(/[\p{P}\p{S}\s]/gu, '').toLowerCase()
  const candidate = normalize(text)
  if (!candidate) return true
  const grams = (value: string) => new Set(Array.from({ length: Math.max(0, value.length - 3) }, (_, i) => value.slice(i, i + 4)))
  const current = grams(candidate)
  return recent.some((previous) => {
    const normalized = normalize(previous)
    if (candidate === normalized) return true
    const old = grams(normalized)
    if (Math.min(current.size, old.size) < 12) return false
    const overlap = [...current].filter(gram => old.has(gram)).length
    return overlap / Math.min(current.size, old.size) >= 0.8
  })
}
