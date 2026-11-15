import { describe, it, expect } from 'vitest'
import { analyse, toDay, toIso, maxStayFrom, collectDays, usedOn } from './schengen.js'

const iso = d => (d == null ? null : toIso(d))

describe('basic counting', () => {
  it('counts entry and exit days inclusive', () => {
    const { days } = collectDays([{ entry: '2026-01-01', exit: '2026-01-10' }], 0)
    expect(days.size).toBe(10)
  })

  it('does not double count overlapping trips', () => {
    const { days } = collectDays([
      { entry: '2026-01-01', exit: '2026-01-10' },
      { entry: '2026-01-05', exit: '2026-01-12' },
    ], 0)
    expect(days.size).toBe(12)
  })

  it('flags exit before entry', () => {
    const { errors } = collectDays([{ entry: '2026-01-10', exit: '2026-01-01' }], 0)
    expect(errors[0]).toBeTruthy()
  })
})

describe('90/180 rule', () => {
  it('exactly 90 days is legal, full reset 180 days after last day', () => {
    // Jan 1 – Mar 31 2026 = 90 days
    const r = analyse([{ entry: '2026-01-01', exit: '2026-03-31' }], toDay('2026-03-31'))
    expect(r.used).toBe(90)
    expect(r.remaining).toBe(0)
    expect(r.overstayDays).toBe(0)
    // Jan 1 drops out of the window on Jun 30 (window Jan 2 – Jun 30)
    expect(iso(r.nextEntry)).toBe('2026-06-30')
    expect(r.nextEntryStay).toBe(90) // old days roll off as new ones are added
    expect(iso(r.fullReset)).toBe('2026-09-27')
  })

  it('after one long continuous stay, earliest re-entry already allows 90 days', () => {
    const r = analyse([{ entry: '2026-05-01', exit: '2026-11-15' }], toDay('2026-11-15'))
    expect(iso(r.nextEntry)).toBe('2027-02-14')
    expect(r.nextEntryStay).toBe(90)
    expect(r.milestones[4].date).toBe(r.nextEntry)
  })

  it('with gaps between trips, earliest re-entry and full-90 date differ', () => {
    const r = analyse([
      { entry: '2026-06-01', exit: '2026-07-15' },
      { entry: '2026-10-01', exit: '2026-11-15' },
    ], toDay('2026-11-15'))
    expect(iso(r.nextEntry)).toBe('2026-11-29')
    expect(r.nextEntryStay).toBe(44)
    expect(iso(r.milestones[4].date)).toBe('2027-02-14')
  })

  it('computes legal-until while inside', () => {
    const r = analyse([{ entry: '2026-01-01', exit: '' }], toDay('2026-01-10'))
    expect(r.used).toBe(10)
    expect(iso(r.legalUntil)).toBe('2026-03-31')
  })

  it('max stay accounts for days rolling out of the window', () => {
    const { days } = collectDays([{ entry: '2026-01-01', exit: '2026-01-30' }], 0) // 30 days
    // Entering 2026-03-01: 30 days already used, so 60 more, but Jan days roll out
    // starting Jun 30 – well after a 60 day stay ends. So exactly 60.
    expect(maxStayFrom(days, toDay('2026-03-01'))).toBe(60)
    // Entering 2026-05-01: Jan 1..30 roll off from Jun 30, you can stay 90 straight
    // until the window would hold >90; check result is between 60 and 90
    const s = maxStayFrom(days, toDay('2026-05-01'))
    expect(s).toBeGreaterThan(60)
    expect(s).toBeLessThanOrEqual(90)
  })
})

describe('overstay tolerance (pending DNV)', () => {
  it('reports overstay without breaking and computes re-entry', () => {
    // 150 days continuous: Jan 1 – May 30 2026
    const trips = [{ entry: '2026-01-01', exit: '2026-05-30' }]
    const r = analyse(trips, toDay('2026-06-01'), '2026-03-15')
    expect(r.used).toBe(150)
    expect(r.remaining).toBe(-60)
    expect(iso(r.firstOverstay)).toBe('2026-04-01')
    expect(r.overstayDays).toBe(60)
    expect(r.coveredDays).toBe(60)
    expect(r.dnvFiledLate).toBe(false)
    expect(r.nextEntry).not.toBeNull()
    // re-entry day must be legal by construction
    const sim = new Set(r.days); sim.add(r.nextEntry)
    expect(usedOn(sim, r.nextEntry)).toBeLessThanOrEqual(90)
    expect(iso(r.fullReset)).toBe('2026-11-26')
  })

  it('flags an application filed after the limit was already exceeded', () => {
    const r = analyse([{ entry: '2026-01-01', exit: '2026-05-30' }], toDay('2026-06-01'), '2026-04-10')
    expect(r.dnvFiledLate).toBe(true)
    expect(r.coveredDays).toBeLessThan(r.overstayDays)
  })
})
