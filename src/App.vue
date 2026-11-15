<script setup>
import { ref, computed, watch } from 'vue'
import { analyse, series, maxStayFrom, todayDay, toDay, toIso, formatDay, MAX_DAYS } from './schengen.js'
import UsageChart from './UsageChart.vue'

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
const refDate = ref(toIso(todayDay()))
const planEntry = ref('')

watch([trips, dnvDate], () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips: trips.value, dnvDate: dnvDate.value }))
  } catch { /* ignore */ }
}, { deep: true })

function addTrip() { trips.value.push({ entry: '', exit: '' }) }
function removeTrip(i) {
  trips.value.splice(i, 1)
  if (!trips.value.length) addTrip()
}
function clearAll() {
  if (!confirm('Remove all trips and the DNV date?')) return
  trips.value = [{ entry: '', exit: '' }]
  dnvDate.value = ''
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

const fmt = d => (d == null ? '—' : formatDay(d))
const daysFrom = d => {
  if (d == null) return ''
  const n = d - refDay.value
  if (n === 0) return 'today'
  return n > 0 ? `in ${n} day${n === 1 ? '' : 's'}` : `${-n} day${n === -1 ? '' : 's'} ago`
}
</script>

<template>
  <header class="hero">
    <div class="wrap">
      <h1>Schengen 90/180 Calculator</h1>
      <p class="sub">For digital nomads with a <strong>pending Spanish Digital Nomad Visa</strong> application —
        overstays are counted and shown, not rejected.</p>
    </div>
  </header>

  <main class="wrap">
    <section class="card">
      <div class="card-head">
        <h2>Your Schengen stays</h2>
        <button class="ghost small" @click="clearAll">Clear all</button>
      </div>
      <p class="hint">Entry and exit days both count as days in Schengen. Leave <em>exit</em> empty if you are still inside.</p>

      <div class="trips">
        <div class="trip trip-labels" aria-hidden="true">
          <span>#</span><span>Entry</span><span>Exit</span><span>Days</span><span></span>
        </div>
        <div v-for="(t, i) in trips" :key="i" class="trip" :class="{ invalid: r.errors[i] }">
          <span class="idx">{{ i + 1 }}</span>
          <label><span class="m-label">Entry</span><input type="date" v-model="t.entry" :aria-label="`Trip ${i + 1} entry date`" /></label>
          <label><span class="m-label">Exit</span><input type="date" v-model="t.exit" :min="t.entry" :aria-label="`Trip ${i + 1} exit date`" /></label>
          <span class="len">
            <span v-if="tripLength(t)">{{ tripLength(t) }}<small> days</small></span>
            <span v-if="t.entry && !t.exit" class="tag">ongoing</span>
          </span>
          <button class="icon" @click="removeTrip(i)" :aria-label="`Remove trip ${i + 1}`" title="Remove">✕</button>
          <p v-if="r.errors[i]" class="err">{{ r.errors[i] }}</p>
        </div>
      </div>
      <button class="primary" @click="addTrip">+ Add stay</button>

      <div class="grid2 settings">
        <label class="field">
          <span>DNV application submitted <small>(optional)</small></span>
          <input type="date" v-model="dnvDate" />
          <small class="hint">Days after this date are shown as “covered by pending application”.</small>
        </label>
        <label class="field">
          <span>Calculate as of</span>
          <input type="date" v-model="refDate" />
          <small class="hint">Defaults to today. Change it to see a past or future date.</small>
        </label>
      </div>
    </section>

    <template v-if="hasData">
      <section class="card status" :class="status">
        <div class="big">
          <div class="num">{{ r.used }}<span>/ {{ MAX_DAYS }}</span></div>
          <div class="lbl">days used in the 180-day window<br /><small>{{ fmt(r.windowStart) }} → {{ fmt(refDay) }}</small></div>
        </div>
        <div class="msg">
          <template v-if="status === 'ok' || status === 'low'">
            <strong>{{ r.remaining }} day{{ r.remaining === 1 ? '' : 's' }} remaining</strong> in the current window.
            <span v-if="r.legalUntil != null"><br />If you stay continuously, your last legal day is <strong>{{ fmt(r.legalUntil) }}</strong>.</span>
          </template>
          <template v-else-if="status === 'covered'">
            <strong>{{ -r.remaining }} day{{ r.remaining === -1 ? '' : 's' }} over the 90-day limit</strong> — covered by your
            pending DNV application (filed {{ fmt(r.dnv) }}). You may remain in Spain while it is being processed.
          </template>
          <template v-else>
            <strong>{{ -r.remaining }} day{{ r.remaining === -1 ? '' : 's' }} over the 90-day limit.</strong>
            <span v-if="r.dnvFiledLate"> Your DNV application date is after the day you first exceeded 90 days ({{ fmt(r.firstOverstay) }}) — applications normally must be filed while your stay is still legal.</span>
            <span v-else> If you have a pending DNV application, enter its date above.</span>
          </template>
        </div>
      </section>

      <section class="grid3" :class="{ two: fullStayAtReentry }">
        <div class="card stat">
          <div class="stat-lbl">Earliest re-entry</div>
          <div class="stat-val">{{ fmt(r.nextEntry) }}</div>
          <div class="stat-sub">{{ daysFrom(r.nextEntry) }}<template v-if="r.nextEntry != null"> · up to <strong>{{ r.nextEntryStay }}</strong> day{{ r.nextEntryStay === 1 ? '' : 's' }}</template></div>
          <p class="hint" v-if="fullStayAtReentry">You can stay the full 90 days from this date: old days drop out of the window as fast as you add new ones.</p>
          <p class="hint" v-if="r.ongoing">Assumes you leave on {{ fmt(r.searchFrom - 1) }}.</p>
          <p class="hint" v-else-if="r.lastDay >= refDay">Assumes you leave on {{ fmt(r.lastDay) }}.</p>
        </div>
        <div class="card stat" v-if="!fullStayAtReentry">
          <div class="stat-lbl">90-day continuous stay</div>
          <div class="stat-val">{{ fmt(r.milestones[4].date) }}</div>
          <div class="stat-sub">{{ daysFrom(r.milestones[4].date) }}</div>
          <p class="hint">Earliest date you can enter and stay 90 days in a row. Entering earlier gives you a shorter stay (see the table below).</p>
        </div>
        <div class="card stat">
          <div class="stat-lbl">Window completely clear</div>
          <div class="stat-val">{{ fmt(r.fullReset) }}</div>
          <div class="stat-sub">{{ daysFrom(r.fullReset) }}</div>
          <p class="hint">180 days after your last recorded day — no past days count any more.</p>
        </div>
      </section>

      <section class="card" v-if="r.overstayDays > 0">
        <h2>Overstay summary</h2>
        <ul class="facts">
          <li>Limit first exceeded on <strong>{{ fmt(r.firstOverstay) }}</strong> (peak {{ r.peak }} days in a window).</li>
          <li><strong>{{ r.overstayDays }}</strong> day{{ r.overstayDays === 1 ? '' : 's' }} in total were beyond the 90-day limit.</li>
          <li v-if="r.dnv != null"><strong>{{ r.coveredDays }}</strong> of them fall on/after your DNV application date<template v-if="r.overstayDays - r.coveredDays > 0">; <strong class="warn">{{ r.overstayDays - r.coveredDays }}</strong> are before it</template>.</li>
        </ul>
        <p class="hint">Re-entry dates above still apply the normal 90/180 rule to all days you were physically present — that's what border systems (EES) count if you travel on your passport before your residence card is issued.</p>
      </section>

      <section class="card">
        <h2>When can I come back, and for how long?</h2>
        <table class="milestones">
          <thead><tr><th>To stay at least</th><th>Earliest entry date</th><th></th></tr></thead>
          <tbody>
            <tr v-for="m in r.milestones" :key="m.days">
              <td>{{ m.days }} days</td>
              <td><strong>{{ fmt(m.date) }}</strong></td>
              <td class="muted">{{ daysFrom(m.date) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="plan">
          <label class="field">
            <span>Check a specific entry date</span>
            <input type="date" v-model="planEntry" />
          </label>
          <div v-if="plan" class="plan-result">
            <template v-if="plan.overlaps">That date is already part of a recorded stay.</template>
            <template v-else-if="plan.stay === 0">❌ You can't enter on <strong>{{ fmt(plan.day) }}</strong> — the window would already be full.</template>
            <template v-else>✅ Entering on <strong>{{ fmt(plan.day) }}</strong> you can stay <strong>{{ plan.stay }} day{{ plan.stay === 1 ? '' : 's' }}</strong>, leaving by <strong>{{ fmt(plan.lastDay) }}</strong>.</template>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Rolling day count</h2>
        <UsageChart :data="chart" :today="refDay" :dnv="r.dnv" />
      </section>
    </template>

    <section class="card info">
      <h2>How this works</h2>
      <ul>
        <li><strong>90/180 rule:</strong> in any rolling 180-day period you may spend at most 90 days in the Schengen Area. Entry and exit days both count.</li>
        <li><strong>Overstay tolerance:</strong> if you applied for Spain's Digital Nomad Visa (residence authorisation for international teleworkers) from inside Spain while your stay was still legal, you may remain while the application is processed. This calculator therefore never rejects stays above 90 days — it shows them and still tells you when you could re-enter.</li>
        <li><strong>Re-entry:</strong> the earliest date on which entering would keep you at or under 90 days in the preceding 180, and how long you could then stay as old days roll out of the window.</li>
        <li>Your data stays in your browser (localStorage). Nothing is sent anywhere.</li>
      </ul>
      <p class="disclaimer">Not legal advice. Rules, processing practice and border-control interpretation can change — check with the Spanish authorities or an immigration lawyer before travelling.</p>
    </section>
  </main>

  <footer class="wrap foot">Schengen DNV Calculator · open source · runs entirely in your browser</footer>
</template>
