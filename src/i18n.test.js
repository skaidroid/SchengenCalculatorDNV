import { describe, it, expect } from 'vitest'
import { messages, t, lang, esc } from './i18n.js'

const params = { n: 2, i: 1, c: 1, before: 1, peak: 95, date: 'D', from: 'F', to: 'T', resume: 'R', last: 'L', list: 'X' }

describe('translations', () => {
  it('English and Spanish have the same keys', () => {
    expect(Object.keys(messages.es).sort()).toEqual(Object.keys(messages.en).sort())
  })

  it('every message renders to a non-empty string in both languages', () => {
    for (const code of Object.keys(messages)) {
      lang.value = code
      for (const key of Object.keys(messages[code])) {
        const out = t(key, params)
        expect(typeof out, `${code}.${key}`).toBe('string')
        expect(out.length, `${code}.${key}`).toBeGreaterThan(0)
        expect(out, `${code}.${key}`).not.toMatch(/undefined|\[object/)
      }
    }
  })

  it('singular and plural', () => {
    lang.value = 'en'
    expect(t('inDays', { n: 1 })).toBe('in 1 day')
    expect(t('inDays', { n: 3 })).toBe('in 3 days')
    lang.value = 'es'
    expect(t('inDays', { n: 1 })).toBe('dentro de 1 día')
    expect(t('daysAgo', { n: 3 })).toBe('hace 3 días')
  })

  it('escapes interpolated values in HTML messages', () => {
    lang.value = 'en'
    expect(t('ugeDay0', { date: '<img>' })).toContain('&lt;img&gt;')
    expect(esc('a & "b"')).toBe('a &amp; &quot;b&quot;')
  })
})
