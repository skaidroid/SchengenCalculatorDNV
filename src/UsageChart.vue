<script setup>
import { computed, ref } from 'vue'
import { formatDay, MAX_DAYS } from './schengen.js'

const props = defineProps({ data: Array, today: Number, dnv: Number })

const W = 800, H = 220, PAD_L = 34, PAD_R = 8, PAD_T = 10, PAD_B = 26
const hover = ref(null)

const yMax = computed(() => Math.max(120, ...props.data.map(p => p.used)) )
const n = computed(() => props.data.length)
const bw = computed(() => (W - PAD_L - PAD_R) / Math.max(n.value, 1))
const x = i => PAD_L + i * bw.value
const y = v => PAD_T + (H - PAD_T - PAD_B) * (1 - v / yMax.value)
const idxOf = day => (props.data.length ? day - props.data[0].day : -1)

const ticks = computed(() => {
  const out = []
  props.data.forEach((p, i) => {
    const d = new Date(p.day * 86400000)
    if (d.getUTCDate() === 1) out.push({ i, label: d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }) + (d.getUTCMonth() === 0 ? ` ${d.getUTCFullYear()}` : '') })
  })
  // thin out labels on narrow ranges
  const step = Math.ceil(out.length / 12)
  return out.filter((_, k) => k % step === 0)
})

function onMove(e) {
  const svg = e.currentTarget
  const pt = svg.createSVGPoint()
  pt.x = e.clientX; pt.y = e.clientY
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse())
  const i = Math.floor((loc.x - PAD_L) / bw.value)
  hover.value = i >= 0 && i < n.value ? i : null
}
</script>

<template>
  <div class="chart" v-if="data.length">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" @mousemove="onMove" @mouseleave="hover = null" role="img"
      aria-label="Days used in rolling 180-day window over time">
      <line v-for="v in [0, 30, 60]" :key="v" :x1="PAD_L" :x2="W - PAD_R" :y1="y(v)" :y2="y(v)" class="grid" />
      <text v-for="v in [0, 30, 60, 90]" :key="'l' + v" :x="PAD_L - 6" :y="y(v) + 4" class="axis" text-anchor="end">{{ v }}</text>
      <rect v-for="(p, i) in data" :key="p.day" :x="x(i)" :y="y(p.used)" :width="Math.max(bw, 0.6)" :height="y(0) - y(p.used)"
        :class="['bar', p.used > MAX_DAYS ? 'over' : p.present ? 'in' : 'out', { future: p.day > today }]" />
      <line :x1="PAD_L" :x2="W - PAD_R" :y1="y(MAX_DAYS)" :y2="y(MAX_DAYS)" class="limit" />
      <line v-if="idxOf(today) >= 0 && idxOf(today) < data.length" :x1="x(idxOf(today))" :x2="x(idxOf(today))" :y1="PAD_T" :y2="y(0)" class="today" />
      <line v-if="dnv != null && idxOf(dnv) >= 0 && idxOf(dnv) < data.length" :x1="x(idxOf(dnv))" :x2="x(idxOf(dnv))" :y1="PAD_T" :y2="y(0)" class="dnv" />
      <text v-for="t in ticks" :key="'t' + t.i" :x="x(t.i)" :y="H - 8" class="axis">{{ t.label }}</text>
      <line v-if="hover != null" :x1="x(hover) + bw / 2" :x2="x(hover) + bw / 2" :y1="PAD_T" :y2="y(0)" class="hover" />
    </svg>
    <div class="chart-tip" v-if="hover != null">
      {{ formatDay(data[hover].day) }} · <strong>{{ data[hover].used }}</strong> days in window
      <span v-if="data[hover].present"> · in Schengen</span>
    </div>
    <div class="legend">
      <span><i class="sw in"></i>In Schengen</span>
      <span><i class="sw out"></i>Outside</span>
      <span><i class="sw over"></i>Over 90</span>
      <span><i class="ln limit"></i>90-day limit</span>
      <span><i class="ln today"></i>Selected date</span>
      <span v-if="dnv != null"><i class="ln dnv"></i>DNV filed</span>
    </div>
  </div>
</template>
