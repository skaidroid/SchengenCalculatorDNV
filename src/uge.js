// UGE (Unidad de Grandes Empresas y Colectivos Estratégicos) response deadline.
//
// Ley 14/2013 art. 76: the UGE must resolve a DNV / teleworker residence application within
// 20 días hábiles. Under Ley 39/2015 art. 30, días hábiles exclude Saturdays, Sundays and
// public holidays: national, regional (Comunidad de Madrid) and local (city of Madrid, where
// the UGE sits). The submission day is day 0; counting starts the next business day.
// August counts as normal (it is only non-working for courts, not for the administration).

import { toDay, toIso } from './schengen.js'

export const UGE_DAYS = 20

// Weekday holidays only matter, but weekend ones are kept so the list matches the official calendars.
// 2026: Decreto 75/2025 (BOCM 25-09-2025) + Madrid city local holidays.
// 2027: Decreto 82/2026 (BOCM 01-10-2026, verified against the official PDF) + Madrid city
//       local holidays (May 15 / Nov 9 assumed; check once the city's 2027 list is in the BOCM).
//       Note: some aggregator sites wrongly omit San José (Mar 19) and the Aug 16 transfer.
// Jan 2028: national holidays only, so applications filed in late Dec 2027 still compute.
// Names are the official Spanish ones; `city` = Madrid city local holiday, `moved` = original date.
export const HOLIDAYS = {
  '2026-01-01': { name: 'Año Nuevo' },
  '2026-01-06': { name: 'Epifanía del Señor' },
  '2026-04-02': { name: 'Jueves Santo' },
  '2026-04-03': { name: 'Viernes Santo' },
  '2026-05-01': { name: 'Fiesta del Trabajo' },
  '2026-05-02': { name: 'Día de la Comunidad de Madrid' },
  '2026-05-15': { name: 'San Isidro', city: true },
  '2026-08-15': { name: 'Asunción de la Virgen' },
  '2026-10-12': { name: 'Fiesta Nacional de España' },
  '2026-11-02': { name: 'Todos los Santos', moved: '2026-11-01' },
  '2026-11-09': { name: 'La Almudena', city: true },
  '2026-12-07': { name: 'Día de la Constitución', moved: '2026-12-06' },
  '2026-12-08': { name: 'Inmaculada Concepción' },
  '2026-12-25': { name: 'Navidad' },

  '2027-01-01': { name: 'Año Nuevo' },
  '2027-01-06': { name: 'Epifanía del Señor' },
  '2027-03-19': { name: 'San José' },
  '2027-03-25': { name: 'Jueves Santo' },
  '2027-03-26': { name: 'Viernes Santo' },
  '2027-05-01': { name: 'Fiesta del Trabajo' },
  '2027-05-15': { name: 'San Isidro', city: true },
  '2027-08-16': { name: 'Asunción de la Virgen', moved: '2027-08-15' },
  '2027-10-12': { name: 'Fiesta Nacional de España' },
  '2027-11-01': { name: 'Todos los Santos' },
  '2027-11-09': { name: 'La Almudena', city: true },
  '2027-12-06': { name: 'Día de la Constitución' },
  '2027-12-08': { name: 'Inmaculada Concepción' },
  '2027-12-25': { name: 'Navidad' },

  '2028-01-01': { name: 'Año Nuevo' },
  '2028-01-06': { name: 'Epifanía del Señor' },
}

export const SUPPORTED_FROM = toDay('2026-01-01')
export const SUPPORTED_TO = toDay('2027-12-31')

const holidaySet = new Set(Object.keys(HOLIDAYS).map(toDay))

const weekday = day => new Date(day * 86400000).getUTCDay() // 0 = Sun, 6 = Sat
export const isWeekend = day => { const w = weekday(day); return w === 0 || w === 6 }
/** { name, city?, moved? (day number) } or null */
export const holidayInfo = day => {
  const h = HOLIDAYS[toIso(day)]
  return h ? { ...h, moved: h.moved ? toDay(h.moved) : undefined } : null
}
export const isBusinessDay = day => !isWeekend(day) && !holidaySet.has(day)

/** Business days from `from` to `to`, both inclusive (0 if the range is empty or invalid). */
export function businessDaysBetween(from, to) {
  if (from == null || to == null) return 0
  let n = 0
  for (let d = from; d <= to; d++) if (isBusinessDay(d)) n++
  return n
}

/**
 * @param submittedIso 'YYYY-MM-DD'
 * @param ref day number used for "elapsed / remaining"
 * @param requests optional list of { requested, responded } ISO dates of requests for more
 *   documents (requerimientos, Ley 39/2015 art. 22.1.a). Every day from `requested` to
 *   `responded` (both inclusive) is skipped like a weekend; counting resumes the day after
 *   `responded`. With no `responded` date the clock is paused from `requested` on and there is
 *   no deadline yet. Overlapping requests are merged. Rows with no `requested` date are ignored.
 * Returns null if no date, or { supported:false } outside 2026–2027.
 */
export function ugeDeadline(submittedIso, ref, requests = []) {
  const submitted = toDay(submittedIso)
  if (submitted == null) return null
  if (submitted < SUPPORTED_FROM || submitted > SUPPORTED_TO) return { submitted, supported: false }

  // The submission day is always day 0, even on a weekend or holiday; day 1 is the next business day.
  const day0 = submitted

  const pauseErrors = {} // index in `requests` → message
  const valid = [] // { from, to, index }; to = null while still waiting for the applicant
  ;(requests ?? []).forEach((req, index) => {
    const from = toDay(req?.requested)
    if (from == null) return
    const to = toDay(req?.responded)
    // Errors are message codes, translated in the UI
    if (from <= day0) pauseErrors[index] = 'requestBeforeSubmission'
    else if (to != null && to < from) pauseErrors[index] = 'responseBeforeRequest'
    else valid.push({ from, to, index })
  })
  const openFrom = valid.reduce((m, p) => (p.to == null && (m == null || p.from < m) ? p.from : m), null)
  const inPause = d => valid.some(p => d >= p.from && (p.to == null || d <= p.to))
  const counts = d => isBusinessDay(d) && !inPause(d)

  let deadline = day0
  let count = 0
  let paused = false // open-ended pause reached before the 20th day
  const skipped = [] // weekday holidays inside the counting period
  while (count < UGE_DAYS) {
    if (openFrom != null && deadline + 1 >= openFrom) { paused = true; break }
    deadline++
    if (counts(deadline)) count++
    else if (!isWeekend(deadline) && !inPause(deadline)) skipped.push({ day: deadline, ...holidayInfo(deadline) })
  }

  const end = paused ? ref : Math.min(ref, deadline)
  let elapsed = 0
  for (let d = day0 + 1; d <= end; d++) if (counts(d)) elapsed++

  // Pauses that start after the deadline (or after an earlier unanswered request) have no effect
  const limit = paused ? openFrom : deadline
  const pauses = valid
    .filter(p => p.from <= limit)
    .sort((a, b) => a.from - b.from)
    .map(p => ({ ...p, businessDays: p.to == null ? null : businessDaysBetween(p.from, p.to) }))
  const current = pauses.find(p => ref >= p.from && (p.to == null || ref <= p.to)) ?? null
  // Resume day for the current pause, following any overlapping/adjacent closed pauses
  let resumes = current && current.to != null ? current.to + 1 : null
  for (let next; resumes != null && (next = valid.find(p => p.from <= resumes && (p.to == null || p.to >= resumes)));) {
    resumes = next.to == null ? null : next.to + 1
  }

  return {
    supported: true,
    submitted,
    day0,
    deadline: paused ? null : deadline,
    skipped,
    elapsed,
    remaining: UGE_DAYS - elapsed,
    calendarDays: paused ? null : deadline - submitted,
    passed: !paused && ref > deadline,
    paused,
    pausedFrom: paused ? openFrom : null,
    pausedNow: current != null,
    resumes, // day counting resumes when `ref` is inside a closed pause
    pauses,
    pauseErrors,
  }
}
