import type { ReferenceRange, ResultFlag, ResultType, Sex } from './api'

// The same rules as the server's ResultRules (backend/src/HsmLis.Domain/ResultRules.cs), so the
// entry screen can show a flag while typing. The server's flag, set on saving, is the one kept.

export function pickRange(ranges: ReferenceRange[], sex: Sex, age: number | null): ReferenceRange | null {
  let best: ReferenceRange | null = null
  let bestScore = -1
  for (const r of ranges) {
    if (r.sex && r.sex !== sex) continue
    const hasAge = r.ageMinYears !== null || r.ageMaxYears !== null
    if (hasAge) {
      if (age === null) continue
      if (r.ageMinYears !== null && age < r.ageMinYears) continue
      if (r.ageMaxYears !== null && age > r.ageMaxYears) continue
    }
    const score = (r.sex ? 2 : 0) + (hasAge ? 1 : 0)
    if (score > bestScore) {
      best = r
      bestScore = score
    }
  }
  return best
}

export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(/^[<>=≤≥]+/, '').replace(/,/g, '').trim()
  if (!/^[-+]?\d*\.?\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

const normalize = (s: string) => s.trim().toLowerCase().split(/\s+/).join(' ')
const NEGATIVE = ['negative', 'neg', 'non reactive', 'non-reactive', 'nonreactive', 'not detected', 'undetected', 'no growth', 'absent', 'susceptible']
const NOT_REPORTABLE = ['not done', 'invalid', 'insufficient', 'rejected']
const POSITIVE = ['positive', 'pos', 'reactive', 'detected', 'present', 'resistant', 'growth']

export function isPositive(text: string) {
  const t = normalize(text)
  if (NEGATIVE.includes(t) || NOT_REPORTABLE.includes(t)) return false
  return POSITIVE.includes(t) || t === '+' || /^\d\+$/.test(t)
}

export function evaluate(type: ResultType, value: string, range: ReferenceRange | null): ResultFlag {
  const text = value.trim()
  if (!text) return 'None'
  const n = type === 'Numeric' || type === 'NumericText' ? parseNumber(text) : null
  if (n !== null) {
    if (!range) return 'None'
    if (range.criticalLow !== null && n <= range.criticalLow) return 'CriticalLow'
    if (range.criticalHigh !== null && n >= range.criticalHigh) return 'CriticalHigh'
    if (range.low !== null && n < range.low) return 'Low'
    if (range.high !== null && n > range.high) return 'High'
    return 'None'
  }
  if (isPositive(text)) return 'Positive'
  if (range?.normalText && normalize(range.normalText) !== normalize(text)) {
    const t = normalize(text)
    return NEGATIVE.includes(t) || NOT_REPORTABLE.includes(t) ? 'None' : 'Abnormal'
  }
  return 'None'
}

export function describe(range: ReferenceRange | null): string | null {
  if (!range) return null
  if (range.normalText) return range.normalText
  if (range.low !== null && range.high !== null) return `${range.low} - ${range.high}`
  if (range.low !== null) return `≥ ${range.low}`
  if (range.high !== null) return `≤ ${range.high}`
  return null
}
