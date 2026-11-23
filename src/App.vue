<script setup>
import { ref, computed, watch } from 'vue'
import { analyse, series, maxStayFrom, todayDay, toDay, toIso, formatDay, MAX_DAYS } from './schengen.js'
import UsageChart from './UsageChart.vue'
import { ugeDeadline, businessDaysBetween, UGE_DAYS } from './uge.js'
import { t, lang, locale, LANGS } from './i18n.js'

const STORAGE_KEY = 'schengen-dnv-calculator:v1'

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (s && Array.isArray(s.trips)) return s
  } catch { /* storage unavailable */ }
  return null
}

const saved = load()
const trips = ref(saved?.trips?.length ? saved.trips : [{ entry: '', exit: '' }])
const dnvDate = ref(saved?.dnvDate ?? '')
const emptyRequest = () => ({ requested: '', responded: '' })
function loadDocsRequest(s) {
  if (s && Array.isArray(s.items)) return { enabled: !!s.enabled, items: s.items.length ? s.items : [emptyRequest()] }
  // Earlier format: a single { enabled, requested, responded }
  if (s) return { enabled: !!s.enabled, items: [{ requested: s.requested ?? '', responded: s.responded ?? '' }] }
  return { enabled: false, items: [emptyRequest()] }
}
const docsRequest = ref(loadDocsRequest(saved?.docsRequest))
function addRequest() { docsRequest.value.items.push(emptyRequest()) }
function removeRequest(i) {
  docsRequest.value.items.splice(i, 1)
  if (!docsRequest.value.items.length) addRequest()
}
const refDate = ref(toIso(todayDay()))
const planEntry = ref('')

watch([trips, dnvDate, docsRequest], () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips: trips.value, dnvDate: dnvDate.value, docsRequest: docsRequest.value }))
  } catch { /* ignore */ }
}, { deep: true })

function addTrip() { trips.value.push({ entry: '', exit: '' }) }
function removeTrip(i) {
  trips.value.splice(i, 1)
  if (!trips.value.length) addTrip()
}
function clearAll() {
  if (!confirm(t('confirmClear'))) return
  trips.value = [{ entry: '', exit: '' }]
  dnvDate.value = ''
  docsRequest.value = loadDocsRequest(null)
}

const refDay = computed(() => toDay(refDate.value) ?? todayDay())
const hasData = computed(() => trips.value.some(t => t.entry))
const r = computed(() => analyse(trips.value, refDay.value, dnvDate.value))

const tripLength = t => {
  const a = toDay(t.entry), b = t.exit ? toDay(t.exit) : refDay.value
  return a != null && b != null && b >= a ? b - a + 1 : null
}

const status = computed(() => {
  const x = r.value
  if (x.used > MAX_DAYS) return x.dnv != null && !x.dnvFiledLate && x.dnv <= refDay.value ? 'covered' : 'over'
  if (x.remaining <= 10) return 'low'
  return 'ok'
})

const plan = computed(() => {
  const d = toDay(planEntry.value)
  if (d == null) return null
  const days = r.value.days
  if (days.has(d)) return { day: d, overlaps: true }
  const stay = maxStayFrom(days, d)
  return { day: d, stay, lastDay: stay ? d + stay - 1 : null, overlaps: false }
})

const chart = computed(() => {
  const x = r.value
  if (!x.days.size) return []
  const first = Math.min(...x.days)
  const from = Math.max(first, refDay.value - 365)
  const to = Math.max(x.fullReset, refDay.value) + 7
  return series(x.days, from, Math.min(to, from + 730))
})

// When the earliest re-entry already allows 90 days, the separate "90-day stay" card would just repeat it
const fullStayAtReentry = computed(() => r.value.nextEntry != null && r.value.nextEntryStay >= MAX_DAYS)

const uge = computed(() => ugeDeadline(dnvDate.value, refDay.value, docsRequest.value.enabled ? docsRequest.value.items : []))
// UGE work days inside a request's range (weekends and holidays don't count)
const requestLength = q => {
  const a = toDay(q.requested), b = toDay(q.responded)
  return a != null && b != null && b >= a ? businessDaysBetween(a, b) : null
}
const ugePct = computed(() => (uge.value?.supported ? Math.min(100, (uge.value.elapsed / UGE_DAYS) * 100) : 0))

const fmt = d => (d == null ? '—' : formatDay(d, locale.value))
const fmtShort = d => formatDay(d, locale.value, { weekday: 'short', day: 'numeric', month: 'short' })
const daysFrom = d => {
  if (d == null) return ''
  const n = d - refDay.value
  if (n === 0) return t('today')
  return n > 0 ? t('inDays', { n }) : t('daysAgo', { n: -n })
}
const holidayLabel = h => {
  const notes = [h.city && t('holidayCity'), h.moved != null && t('holidayMoved', { date: fmtShort(h.moved) })].filter(Boolean)
  return `${fmt(h.day)} (${h.name}${notes.length ? `, ${notes.join(', ')}` : ''})`
}
const skippedList = computed(() => (uge.value?.skipped ?? []).map(holidayLabel).join('; '))
</script>

<template>
  <header class="hero">
    <div class="wrap">
      <div class="lang-switch" role="group" :aria-label="t('language')">
        <button v-for="(name, code) in LANGS" :key="code" :class="{ active: lang === code }" :aria-pressed="lang === code" :lang="code" @click="lang = code">{{ name }}</button>
      </div>
      <h1>{{ t('title') }}</h1>
      <p class="sub" v-html="t('sub')"></p>
    </div>
  </header>

  <main class="wrap">
    <section class="card">
      <div class="card-head">
        <h2>{{ t('staysTitle') }}</h2>
        <button class="ghost small" @click="clearAll">{{ t('clearAll') }}</button>
      </div>
      <p class="hint" v-html="t('staysHint')"></p>

      <div class="trips">
        <div class="trip trip-labels" aria-hidden="true">
          <span>#</span><span>{{ t('entry') }}</span><span>{{ t('exit') }}</span><span>{{ t('days') }}</span><span></span>
        </div>
        <div v-for="(tr, i) in trips" :key="i" class="trip" :class="{ invalid: r.errors[i] }">
          <span class="idx">{{ i + 1 }}</span>
          <label><span class="m-label">{{ t('entry') }}</span><input type="date" v-model="tr.entry" :aria-label="t('tripEntryAria', { i: i + 1 })" /></label>
          <label><span class="m-label">{{ t('exit') }}</span><input type="date" v-model="tr.exit" :min="tr.entry" :aria-label="t('tripExitAria', { i: i + 1 })" /></label>
          <span class="len">
            <span v-if="tripLength(tr)">{{ tripLength(tr) }}<small>{{ t('daysUnit', { n: tripLength(tr) }) }}</small></span>
            <span v-if="tr.entry && !tr.exit" class="tag">{{ t('ongoing') }}</span>
          </span>
          <button class="icon" @click="removeTrip(i)" :aria-label="t('removeTripAria', { i: i + 1 })" :title="t('remove')">✕</button>
          <p v-if="r.errors[i]" class="err">{{ t('err_' + r.errors[i]) }}</p>
        </div>
      </div>
      <button class="primary" @click="addTrip">{{ t('addStay') }}</button>

      <div class="grid2 settings">
        <label class="field">
          <span>{{ t('dnvLabel') }} <small>{{ t('optional') }}</small></span>
          <input type="date" v-model="dnvDate" />
          <small class="hint">{{ t('dnvHint') }}</small>
        </label>
        <label class="field">
          <span>{{ t('refLabel') }}</span>
          <input type="date" v-model="refDate" />
          <small class="hint">{{ t('refHint') }}</small>
        </label>
      </div>
    </section>

    <section class="card uge" v-if="uge" :class="{ passed: uge.passed }">
      <template v-if="!uge.supported">
        <h2>{{ t('ugeTitle') }}</h2>
        <p class="hint">{{ t('ugeUnsupported') }}</p>
      </template>
      <template v-else>
        <div class="uge-head">
          <div>
            <div class="stat-lbl">{{ t('ugeMustRespond') }}</div>
            <template v-if="uge.paused">
              <div class="uge-date">{{ t('ugePaused') }}</div>
              <div class="stat-sub">{{ t('ugePausedSub') }}</div>
            </template>
            <template v-else>
              <div class="uge-date">{{ fmt(uge.deadline) }}</div>
              <div class="stat-sub">{{ daysFrom(uge.deadline) }} · {{ t('ugeCalendarAfter', { n: uge.calendarDays }) }}</div>
            </template>
          </div>
          <div class="uge-count">
            <div class="num">{{ uge.passed ? UGE_DAYS : uge.elapsed }}<span>/ {{ UGE_DAYS }}</span></div>
            <div class="lbl">{{ t('ugeElapsed') }}</div>
          </div>
        </div>
        <div class="uge-bar" role="progressbar" :aria-valuenow="uge.elapsed" aria-valuemin="0" :aria-valuemax="UGE_DAYS"><span :style="{ width: ugePct + '%' }"></span></div>
        <p class="uge-msg" v-if="uge.paused" v-html="t('ugeMsgPaused', { n: uge.remaining, date: fmt(uge.pausedFrom) })"></p>
        <p class="uge-msg" v-else-if="uge.pausedNow" v-html="t('ugeMsgPausedNow', { n: uge.remaining, date: fmt(refDay), resume: fmt(uge.resumes) })"></p>
        <p class="uge-msg" v-else-if="uge.passed" v-html="t('ugeMsgPassed', { date: fmt(uge.deadline) })"></p>
        <p class="uge-msg" v-else v-html="t('ugeMsgLeft', { n: uge.remaining, date: fmt(refDay) })"></p>
        <ul class="facts">
          <li v-html="t('ugeDay0', { date: fmt(uge.day0) })"></li>
          <li>{{ t('ugeWeekends') }}<template v-if="uge.skipped.length">{{ t('ugeSkipped', { list: skippedList }) }}</template></li>
          <li v-for="p in uge.pauses" :key="p.index" v-html="p.to != null
            ? t('ugePause', { i: p.index + 1, from: fmt(p.from), to: fmt(p.to), n: p.businessDays })
            : t('ugePauseOpen', { i: p.index + 1, from: fmt(p.from) })"></li>
        </ul>

        <div class="docs-req">
          <label class="check">
            <input type="checkbox" v-model="docsRequest.enabled" />
            <span v-html="t('docsCheck')"></span>
          </label>
          <template v-if="docsRequest.enabled">
            <p class="hint" v-html="t('docsHint')"></p>
            <div class="trips">
              <div class="trip trip-labels" aria-hidden="true">
                <span>#</span><span>{{ t('requested') }}</span><span>{{ t('responded') }}</span><span>{{ t('paused') }}</span><span></span>
              </div>
              <div v-for="(q, i) in docsRequest.items" :key="i" class="trip" :class="{ invalid: uge.pauseErrors[i] }">
                <span class="idx">{{ i + 1 }}</span>
                <label><span class="m-label">{{ t('requested') }}</span><input type="date" v-model="q.requested" :min="dnvDate" :aria-label="t('reqDateAria', { i: i + 1 })" /></label>
                <label><span class="m-label">{{ t('responded') }}</span><input type="date" v-model="q.responded" :min="q.requested" :aria-label="t('reqRespAria', { i: i + 1 })" /></label>
                <span class="len">
                  <span v-if="requestLength(q) != null">{{ requestLength(q) }}<small>{{ t('workDaysUnit', { n: requestLength(q) }) }}</small></span>
                  <span v-if="q.requested && !q.responded" class="tag">{{ t('waiting') }}</span>
                </span>
                <button class="icon" @click="removeRequest(i)" :aria-label="t('removeReqAria', { i: i + 1 })" :title="t('remove')">✕</button>
                <p v-if="uge.pauseErrors[i]" class="err">{{ t('err_' + uge.pauseErrors[i]) }}</p>
              </div>
            </div>
            <button class="primary" @click="addRequest">{{ t('addRequest') }}</button>
          </template>
        </div>

        <p class="hint">{{ t('ugeLegal') }}</p>
      </template>
    </section>

    <template v-if="hasData">
      <section class="card status" :class="status">
        <div class="big">
          <div class="num">{{ r.used }}<span>/ {{ MAX_DAYS }}</span></div>
          <div class="lbl">{{ t('usedLbl') }}<br /><small>{{ fmt(r.windowStart) }} → {{ fmt(refDay) }}</small></div>
        </div>
        <div class="msg">
          <template v-if="status === 'ok' || status === 'low'">
            <span v-html="t('remaining', { n: r.remaining })"></span>
            <span v-if="r.legalUntil != null"><br /><span v-html="t('legalUntil', { date: fmt(r.legalUntil) })"></span></span>
          </template>
          <span v-else-if="status === 'covered'" v-html="t('covered', { n: -r.remaining, date: fmt(r.dnv) })"></span>
          <template v-else>
            <span v-html="t('over', { n: -r.remaining })"></span>
            <span v-if="r.dnvFiledLate">{{ t('filedLate', { date: fmt(r.firstOverstay) }) }}</span>
            <span v-else>{{ t('enterDnv') }}</span>
          </template>
        </div>
      </section>

      <section class="grid3" :class="{ two: fullStayAtReentry }">
        <div class="card stat">
          <div class="stat-lbl">{{ t('earliest') }}</div>
          <div class="stat-val">{{ fmt(r.nextEntry) }}</div>
          <div class="stat-sub">{{ daysFrom(r.nextEntry) }}<span v-if="r.nextEntry != null" v-html="t('upTo', { n: r.nextEntryStay })"></span></div>
          <p class="hint" v-if="fullStayAtReentry">{{ t('fullStayHint') }}</p>
          <p class="hint" v-if="r.ongoing">{{ t('assumesLeave', { date: fmt(r.searchFrom - 1) }) }}</p>
          <p class="hint" v-else-if="r.lastDay >= refDay">{{ t('assumesLeave', { date: fmt(r.lastDay) }) }}</p>
        </div>
        <div class="card stat" v-if="!fullStayAtReentry">
          <div class="stat-lbl">{{ t('stay90') }}</div>
          <div class="stat-val">{{ fmt(r.milestones[4].date) }}</div>
          <div class="stat-sub">{{ daysFrom(r.milestones[4].date) }}</div>
          <p class="hint">{{ t('stay90Hint') }}</p>
        </div>
        <div class="card stat">
          <div class="stat-lbl">{{ t('clearWin') }}</div>
          <div class="stat-val">{{ fmt(r.fullReset) }}</div>
          <div class="stat-sub">{{ daysFrom(r.fullReset) }}</div>
          <p class="hint">{{ t('clearWinHint') }}</p>
        </div>
      </section>

      <section class="card" v-if="r.overstayDays > 0">
        <h2>{{ t('overTitle') }}</h2>
        <ul class="facts">
          <li v-html="t('overFirst', { date: fmt(r.firstOverstay), peak: r.peak })"></li>
          <li v-html="t('overTotal', { n: r.overstayDays })"></li>
          <li v-if="r.dnv != null" v-html="t('overCovered', { c: r.coveredDays, before: r.overstayDays - r.coveredDays })"></li>
        </ul>
        <p class="hint">{{ t('overHint') }}</p>
      </section>

      <section class="card">
        <h2>{{ t('msTitle') }}</h2>
        <table class="milestones">
          <thead><tr><th>{{ t('msStay') }}</th><th>{{ t('msEntry') }}</th><th></th></tr></thead>
          <tbody>
            <tr v-for="m in r.milestones" :key="m.days">
              <td>{{ t('msDays', { n: m.days }) }}</td>
              <td><strong>{{ fmt(m.date) }}</strong></td>
              <td class="muted">{{ daysFrom(m.date) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="plan">
          <label class="field">
            <span>{{ t('planLabel') }}</span>
            <input type="date" v-model="planEntry" />
          </label>
          <div v-if="plan" class="plan-result">
            <template v-if="plan.overlaps">{{ t('planOverlaps') }}</template>
            <span v-else-if="plan.stay === 0" v-html="t('planNo', { date: fmt(plan.day) })"></span>
            <span v-else v-html="t('planYes', { date: fmt(plan.day), n: plan.stay, last: fmt(plan.lastDay) })"></span>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>{{ t('chartTitle') }}</h2>
        <UsageChart :data="chart" :today="refDay" :dnv="r.dnv" />
      </section>
    </template>

    <section class="card info">
      <h2>{{ t('infoTitle') }}</h2>
      <ul>
        <li v-html="t('info1')"></li>
        <li v-html="t('info2')"></li>
        <li v-html="t('info3')"></li>
        <li>{{ t('info4') }}</li>
      </ul>
      <p class="disclaimer">{{ t('disclaimer') }}</p>
    </section>
  </main>

  <footer class="wrap foot">{{ t('footer') }}</footer>
</template>
