// Schengen 90/180 rule engine.
// All dates are handled as integer "day numbers" (days since 1970-01-01 UTC)
// to avoid timezone / DST problems. Entry and exit days both count as days of stay.

export const WINDOW = 180
export const MAX_DAYS = 90
const MS_PER_DAY = 86400000

/** 'YYYY-MM-DD' -> day number (or null) */
export function toDay(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY)
}

/** day number -> 'YYYY-MM-DD' */
export function toIso(day) {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Today's local date as a day number */
export function todayDay() {
  const n = new Date()
  return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / MS_PER_DAY)
}

export function formatDay(day) {
  return new Date(day * MS_PER_DAY).toLocaleDateString(undefined, {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

/**
 * Validate trips and expand them into a Set of day numbers spent in Schengen.
 * A trip with no exit date is "ongoing" and counts up to `openEnd` (inclusive).
 */
export function collectDays(trips, openEnd) {
  const days = new Set()
  const errors = {}
  trips.forEach((t, i) => {
    const a = toDay(t.entry)
    const b = t.exit ? toDay(t.exit) : openEnd
    if (a == null) { if (t.exit) errors[i] = 'Entry date is missing'; return }
    if (b == null) return
    if (b < a) { errors[i] = 'Exit is before entry'; return }
    for (let d = a; d <= b; d++) days.add(d)
  })
  return { days, errors }
}

/** Number of stay days in the 180-day window ending on `day` (inclusive). */
export function usedOn(days, day) {
  let n = 0
  for (let d = day - WINDOW + 1; d <= day; d++) if (days.has(d)) n++
  return n
}

/**
 * If you enter on `start` (and nothing else changes), how many consecutive
 * days can you stay without exceeding 90 in any 180-day window?
 * Returns 0 if you cannot legally enter on that day at all.
 */
export function maxStayFrom(days, start) {
  const sim = new Set(days)
  let k = 0
  while (k < MAX_DAYS) {
    const d = start + k
    if (sim.has(d)) { k++; continue } // already counted (overlapping trip)
    sim.add(d)
    if (usedOn(sim, d) > MAX_DAYS) break
    k++
  }
  return k
}

/** Earliest day >= from on which you could enter and stay at least `minDays` days. */
export function earliestEntry(days, from, minDays = 1) {
  for (let d = from; d < from + WINDOW * 3; d++) {
    if (!days.has(d) && maxStayFrom(days, d) >= minDays) return d
  }
  return null
}

/**
 * Main entry point. Returns everything the UI needs.
 * @param trips [{entry:'YYYY-MM-DD', exit:'YYYY-MM-DD'|''}]
 * @param ref   day number to evaluate ("today" or chosen date)
 * @param dnvDate optional 'YYYY-MM-DD' of the Spanish DNV application
 */
export function analyse(trips, ref, dnvDate) {
  const ongoing = trips.some(t => t.entry && !t.exit)
  const { days, errors } = collectDays(trips, ref)
  const used = usedOn(days, ref)
  const sorted = [...days].sort((a, b) => a - b)
  const lastDay = sorted.length ? sorted[sorted.length - 1] : null
  const inside = days.has(ref)

  // Day on which the 90-day limit was first exceeded, looking at all history.
  let firstOverstay = null
  let peak = 0
  for (const d of sorted) {
    const u = usedOn(days, d)
    if (u > peak) peak = u
    if (u > MAX_DAYS && firstOverstay == null) firstOverstay = d
  }

  // Overstay days (days whose rolling count exceeded 90) and how many fall
  // on/after the DNV application date (i.e. covered by the pending application).
  const dnv = toDay(dnvDate)
  let overstayDays = 0
  let coveredDays = 0
  for (const d of sorted) {
    if (usedOn(days, d) > MAX_DAYS) {
      overstayDays++
      if (dnv != null && d >= dnv) coveredDays++
    }
  }
  // The application must be filed while still legally in Schengen
  const dnvFiledLate = dnv != null && firstOverstay != null && dnv > firstOverstay

  // Re-entry search starts the day after your last recorded day in Schengen
  // (for an ongoing trip that means "if you leave today").
  const searchFrom = lastDay != null && lastDay >= ref ? lastDay + 1 : ref
  const nextEntry = earliestEntry(days, searchFrom, 1)
  const nextEntryStay = nextEntry != null ? maxStayFrom(days, nextEntry) : 0
  // First day on which your last stay day drops out of the window => full 90 days available
  const fullReset = lastDay != null ? Math.max(lastDay + WINDOW, searchFrom) : ref

  // If you're inside and within the limit: last day you may legally remain.
  let legalUntil = null
  if (inside && used <= MAX_DAYS) {
    const sim = new Set(days)
    let d = ref
    while (d - ref < WINDOW) {
      const next = d + 1
      sim.add(next)
      if (usedOn(sim, next) > MAX_DAYS) break
      d = next
    }
    legalUntil = d
  }

  // Milestones: earliest day you can come back for at least N days
  const milestones = [7, 14, 30, 60, 90].map(n => ({
    days: n,
    date: earliestEntry(days, searchFrom, n),
  }))

  return {
    days, errors, used, remaining: MAX_DAYS - used, inside, ongoing,
    lastDay, firstOverstay, peak, overstayDays, coveredDays, dnv, dnvFiledLate,
    nextEntry, nextEntryStay, fullReset, legalUntil, milestones, searchFrom,
    windowStart: ref - WINDOW + 1,
  }
}

/** Rolling day counts for a chart, from `from` to `to` inclusive. */
export function series(days, from, to) {
  const out = []
  for (let d = from; d <= to; d++) out.push({ day: d, used: usedOn(days, d), present: days.has(d) })
  return out
}
