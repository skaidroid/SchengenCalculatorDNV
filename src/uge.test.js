import { describe, it, expect } from 'vitest'
import { ugeDeadline } from './uge.js'
import { toDay, toIso } from './schengen.js'

const dl = (iso, ref = iso) => ugeDeadline(iso, toDay(ref))

describe('UGE 20 business-day deadline', () => {
  it('plain period with no holidays: 4 full weeks', () => {
    // Mon 2026-02-02 = day 0 → 20 business days later is Mon 2026-03-02
    const r = dl('2026-02-02')
    expect(toIso(r.deadline)).toBe('2026-03-02')
    expect(r.skipped).toEqual([])
  })

  it('skips Easter (Jueves/Viernes Santo 2026)', () => {
    // Mon 2026-03-23: 20 business days → 2026-04-20 normally, +2 for Apr 2–3
    expect(toIso(dl('2026-03-23').deadline)).toBe('2026-04-22')
  })

  it('skips Madrid regional and city holidays around Nov/Dec 2026', () => {
    // Fri 2026-10-30 day 0; skips Mon Nov 2 (Todos los Santos) and Mon Nov 9 (Almudena)
    const r = dl('2026-10-30')
    expect(r.skipped.map(h => toIso(h.day))).toEqual(['2026-11-02', '2026-11-09'])
    expect(toIso(r.deadline)).toBe('2026-12-01')
  })

  it('weekend submission is day 0 itself; day 1 is the next business day', () => {
    const r = dl('2026-02-01') // Sunday
    expect(toIso(r.day0)).toBe('2026-02-01')
    expect(toIso(r.deadline)).toBe('2026-02-27') // Feb 2 = day 1 … Feb 27 = day 20
  })

  it('Fri Oct 30 and Sat Oct 31 2026 are at the same business day count', () => {
    // Nov 2 and Nov 9 are holidays; as of Sun Nov 15 both are at day 8
    expect(dl('2026-10-30', '2026-11-15').elapsed).toBe(8)
    expect(dl('2026-10-31', '2026-11-15').elapsed).toBe(8)
    expect(dl('2026-10-31').deadline).toBe(dl('2026-10-30').deadline)
  })

  it('holiday submission is day 0 itself', () => {
    // Mon Nov 2 2026 (holiday) is day 0, so Tue Nov 3 is day 1
    expect(dl('2026-11-02', '2026-11-03').elapsed).toBe(1)
  })

  it('2027: skips San José and Easter', () => {
    // Mon 2027-03-15 day 0; skips Fri Mar 19, Thu Mar 25, Fri Mar 26
    const r = dl('2027-03-15')
    expect(r.skipped.length).toBe(3)
    expect(toIso(r.deadline)).toBe('2027-04-15')
  })

  it('late Dec 2027 crosses into 2028', () => {
    // Thu 2027-12-30: skips Thu 2028-01-06
    expect(toIso(dl('2027-12-30').deadline)).toBe('2028-01-28')
  })

  it('tracks elapsed / remaining and passed', () => {
    const r = dl('2026-02-02', '2026-02-09') // one week later
    expect(r.elapsed).toBe(5)
    expect(r.remaining).toBe(15)
    expect(dl('2026-02-02', '2026-03-03').passed).toBe(true)
  })

  it('unsupported outside 2026–2027', () => {
    expect(dl('2025-12-31').supported).toBe(false)
    expect(dl('2028-01-03').supported).toBe(false)
    expect(ugeDeadline('', 0)).toBe(null)
  })
})
