// Calendar days as yyyy-mm-dd strings in the browser's own time zone, which is the lab's.

const pad = (n: number) => String(n).padStart(2, '0')

export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => isoDay(new Date())

export function addDays(day: string, days: number) {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDay(d)
}

export type Period = 'today' | 'week' | 'month' | 'year'

/** The days a period button stands for, ending today. */
export function periodRange(period: Period): { from: string; to: string } {
  const to = today()
  const now = new Date()
  switch (period) {
    case 'today':
      return { from: to, to }
    case 'week':
      return { from: addDays(to, -6), to }
    case 'month':
      return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to }
    case 'year':
      return { from: isoDay(new Date(now.getFullYear(), 0, 1)), to }
  }
}

/** Buddhist-era year ↔ Gregorian, for the date-of-birth fields people fill in either way. */
export const toBuddhistYear = (year: number) => year + 543
export const fromBuddhistYear = (year: number) => year - 543

/** Whole years from a yyyy-mm-dd birth date to today; null when there is none. */
export function ageFrom(birth: string | null): number | null {
  if (!birth) return null
  const now = new Date()
  const [y, m, d] = birth.split('-').map(Number)
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age >= 0 ? age : null
}
