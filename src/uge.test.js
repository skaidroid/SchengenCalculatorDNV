import { describe, it, expect } from 'vitest'
import { ugeDeadline, businessDaysBetween } from './uge.js'
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
    expect(r.skipped[0]).toMatchObject({ name: 'Todos los Santos', moved: toDay('2026-11-01') })
    expect(r.skipped[1]).toMatchObject({ name: 'La Almudena', city: true })
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

  describe('documents request (requerimiento) pause', () => {
    const req = (requested, responded = '') => [{ requested, responded }]

    it('skips every day from request to response, inclusive', () => {
      // Mon Feb 2 day 0; paused Mon Feb 9 – Fri Feb 13 (5 business days) → Mar 2 + 1 week
      const r = ugeDeadline('2026-02-02', toDay('2026-02-09'), req('2026-02-09', '2026-02-13'))
      expect(toIso(r.deadline)).toBe('2026-03-09')
      expect(r.elapsed).toBe(4)
      expect(r.pausedNow).toBe(true)
      expect(toIso(r.resumes)).toBe('2026-02-14')
      expect(r.pauses[0].businessDays).toBe(5)
    })

    it('paused days count only UGE work days', () => {
      // Fri Oct 30 – Mon Nov 9 2026: 11 calendar days, minus 2 weekends and the Nov 2 / Nov 9 holidays
      expect(businessDaysBetween(toDay('2026-10-30'), toDay('2026-11-09'))).toBe(5)
      const r = ugeDeadline('2026-10-29', 0, req('2026-10-30', '2026-11-09'))
      expect(r.pauses[0].businessDays).toBe(5)
      expect(businessDaysBetween(toDay('2026-02-07'), toDay('2026-02-08'))).toBe(0) // weekend only
    })

    it('multiple requests each pause the count', () => {
      // Two 1-week pauses (Feb 9–13, Feb 23–27) → Mar 2 + 2 weeks
      const r = ugeDeadline('2026-02-02', toDay('2026-02-02'), [
        { requested: '2026-02-23', responded: '2026-02-27' },
        { requested: '2026-02-09', responded: '2026-02-13' },
      ])
      expect(toIso(r.deadline)).toBe('2026-03-16')
      expect(r.pauses.map(p => p.index)).toEqual([1, 0]) // sorted by date
    })

    it('overlapping requests are merged, not double-counted', () => {
      const r = ugeDeadline('2026-02-02', toDay('2026-02-11'), [
        { requested: '2026-02-09', responded: '2026-02-12' },
        { requested: '2026-02-11', responded: '2026-02-13' },
      ])
      expect(toIso(r.deadline)).toBe('2026-03-09')
      expect(toIso(r.resumes)).toBe('2026-02-14')
    })

    it('a later unanswered request pauses after earlier answered ones', () => {
      const r = ugeDeadline('2026-02-02', toDay('2026-03-20'), [
        { requested: '2026-02-09', responded: '2026-02-13' },
        { requested: '2026-02-23', responded: '' },
      ])
      expect(r.paused).toBe(true)
      expect(toIso(r.pausedFrom)).toBe('2026-02-23')
      expect(r.elapsed).toBe(4 + 5) // Feb 3–6, Feb 16–20
    })

    it('empty rows are ignored', () => {
      const r = ugeDeadline('2026-02-02', 0, [{ requested: '', responded: '' }])
      expect(toIso(r.deadline)).toBe('2026-03-02')
      expect(r.pauses).toEqual([])
    })

    it('counting resumes the day after the response', () => {
      const r = ugeDeadline('2026-02-02', toDay('2026-02-16'), req('2026-02-09', '2026-02-13'))
      expect(r.elapsed).toBe(5) // Feb 3–6 + Feb 16
      expect(r.pausedNow).toBe(false)
    })

    it('no response yet: clock stays paused, no deadline', () => {
      const r = ugeDeadline('2026-02-02', toDay('2026-03-20'), req('2026-02-09'))
      expect(r.paused).toBe(true)
      expect(r.deadline).toBe(null)
      expect(r.passed).toBe(false)
      expect(r.elapsed).toBe(4)
      expect(r.remaining).toBe(16)
    })

    it('a request after the deadline changes nothing', () => {
      const r = ugeDeadline('2026-02-02', toDay('2026-02-02'), req('2026-03-10'))
      expect(toIso(r.deadline)).toBe('2026-03-02')
      expect(r.pauses).toEqual([])
    })

    it('holidays inside the pause are not listed as skipped holidays', () => {
      // Fri Oct 30 day 0; pause Nov 2 – Nov 6 covers the Nov 2 holiday
      const r = dl('2026-10-30')
      const p = ugeDeadline('2026-10-30', toDay('2026-10-30'), req('2026-11-02', '2026-11-06'))
      // Nov 3–6 paused (4 business days): Dec 1 → Dec 2, 3, 4, (7, 8 holidays), 9
      expect(p.skipped.map(h => toIso(h.day))).toEqual(['2026-11-09', '2026-12-07', '2026-12-08'])
      expect(toIso(r.deadline)).toBe('2026-12-01')
      expect(toIso(p.deadline)).toBe('2026-12-09')
    })

    it('rejects invalid ranges and ignores them', () => {
      expect(ugeDeadline('2026-02-02', 0, req('2026-02-01')).pauseErrors[0]).toBe('requestBeforeSubmission')
      const bad = ugeDeadline('2026-02-02', 0, req('2026-02-10', '2026-02-09'))
      expect(bad.pauseErrors[0]).toBe('responseBeforeRequest')
      expect(toIso(bad.deadline)).toBe('2026-03-02')
      // Error is keyed to the bad row; the good row still applies
      const mixed = ugeDeadline('2026-02-02', 0, [
        { requested: '2026-02-09', responded: '2026-02-13' },
        { requested: '2026-02-20', responded: '2026-02-19' },
      ])
      expect(Object.keys(mixed.pauseErrors)).toEqual(['1'])
      expect(toIso(mixed.deadline)).toBe('2026-03-09')
    })
  })

  it('unsupported outside 2026–2027', () => {
    expect(dl('2025-12-31').supported).toBe(false)
    expect(dl('2028-01-03').supported).toBe(false)
    expect(ugeDeadline('', 0)).toBe(null)
  })
})
