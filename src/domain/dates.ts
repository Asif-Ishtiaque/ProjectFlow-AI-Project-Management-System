const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** All dates in the prototype are plain ISO days (YYYY-MM-DD) or ISO datetimes. */
export const day = (iso: string) => iso.slice(0, 10)

export const parse = (iso: string) => {
  const [y, m, d] = day(iso).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  const dt = parse(iso)
  return `${String(dt.getUTCDate()).padStart(2, '0')} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

export const fmtShort = (iso?: string) => {
  if (!iso) return '—'
  const dt = parse(iso)
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`
}

export const fmtTime = (iso: string) => {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime()) || iso.length <= 10) return ''
  let h = dt.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(dt.getMinutes()).padStart(2, '0')} ${ampm}`
}

export const addDays = (iso: string, days: number) => {
  const dt = parse(iso)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((parse(toIso).getTime() - parse(fromIso).getTime()) / 86400000)

/** Positive = overdue by n days, 0 or negative = not overdue. */
export const daysOverdue = (dueIso: string, todayIso: string) =>
  Math.max(0, daysBetween(dueIso, todayIso))

export const isSameDay = (a: string, b: string) => day(a) === day(b)

export const relativeDay = (iso: string, todayIso: string) => {
  const d = daysBetween(day(iso), day(todayIso))
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d === -1) return 'Tomorrow'
  return fmtDate(iso)
}

export const monthKey = (iso: string) => day(iso).slice(0, 7)
