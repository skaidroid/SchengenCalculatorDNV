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
export const HOLIDAYS = {
  '2026-01-01': 'Año Nuevo',
  '2026-01-06': 'Epifanía del Señor',
  '2026-04-02': 'Jueves Santo',
  '2026-04-03': 'Viernes Santo',
  '2026-05-01': 'Fiesta del Trabajo',
  '2026-05-02': 'Día de la Comunidad de Madrid',
  '2026-05-15': 'San Isidro (Madrid city)',
  '2026-08-15': 'Asunción de la Virgen',
  '2026-10-12': 'Fiesta Nacional de España',
  '2026-11-02': 'Todos los Santos (moved from Sun 1 Nov)',
  '2026-11-09': 'La Almudena (Madrid city)',
  '2026-12-07': 'Día de la Constitución (moved from Sun 6 Dec)',
  '2026-12-08': 'Inmaculada Concepción',
  '2026-12-25': 'Navidad',

  '2027-01-01': 'Año Nuevo',
  '2027-01-06': 'Epifanía del Señor',
  '2027-03-19': 'San José',
  '2027-03-25': 'Jueves Santo',
  '2027-03-26': 'Viernes Santo',
  '2027-05-01': 'Fiesta del Trabajo',
  '2027-05-15': 'San Isidro (Madrid city)',
  '2027-08-16': 'Asunción de la Virgen (moved from Sun 15 Aug)',
  '2027-10-12': 'Fiesta Nacional de España',
  '2027-11-01': 'Todos los Santos',
  '2027-11-09': 'La Almudena (Madrid city)',
  '2027-12-06': 'Día de la Constitución',
  '2027-12-08': 'Inmaculada Concepción',
  '2027-12-25': 'Navidad',

  '2028-01-01': 'Año Nuevo',
  '2028-01-06': 'Epifanía del Señor',
}

export const SUPPORTED_FROM = toDay('2026-01-01')
export const SUPPORTED_TO = toDay('2027-12-31')

const holidaySet = new Set(Object.keys(HOLIDAYS).map(toDay))

const weekday = day => new Date(day * 86400000).getUTCDay() // 0 = Sun, 6 = Sat
export const isWeekend = day => { const w = weekday(day); return w === 0 || w === 6 }
export const holidayName = day => HOLIDAYS[toIso(day)] ?? null
export const isBusinessDay = day => !isWeekend(day) && !holidaySet.has(day)

/**
 * @param submittedIso 'YYYY-MM-DD'
 * @param ref day number used for "elapsed / remaining"
 * Returns null if no date, or { supported:false } outside 2026–2027.
 */
export function ugeDeadline(submittedIso, ref) {
  const submitted = toDay(submittedIso)
  if (submitted == null) return null
  if (submitted < SUPPORTED_FROM || submitted > SUPPORTED_TO) return { submitted, supported: false }

  // The submission day is always day 0, even on a weekend or holiday; day 1 is the next business day.
  const day0 = submitted

  let deadline = day0
  let count = 0
  const skipped = [] // weekday holidays inside the counting period
  while (count < UGE_DAYS) {
    deadline++
    if (isBusinessDay(deadline)) count++
    else if (!isWeekend(deadline)) skipped.push({ day: deadline, name: holidayName(deadline) })
  }

  let elapsed = 0
  for (let d = day0 + 1; d <= Math.min(ref, deadline); d++) if (isBusinessDay(d)) elapsed++

  return {
    supported: true,
    submitted,
    day0,
    deadline,
    skipped,
    elapsed,
    remaining: UGE_DAYS - elapsed,
    calendarDays: deadline - submitted,
    passed: ref > deadline,
  }
}
