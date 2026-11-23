// Minimal English / Spanish translations (no dependency).
// Messages are strings or functions of a params object. Messages used with v-html may contain
// markup; anything interpolated into them goes through `b()` / `esc()` so it is always escaped.

import { ref, computed, watch } from 'vue'

export const LANGS = { en: 'English', es: 'Español' }
const LANG_KEY = 'schengen-dnv-calculator:lang'

const browserLangs = () => (typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language])).filter(Boolean).map(String)

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved in LANGS) return saved
  } catch { /* storage unavailable */ }
  for (const l of browserLangs()) {
    const base = l.slice(0, 2).toLowerCase()
    if (base in LANGS) return base
  }
  return 'en'
}

export const lang = ref(detect())

// Keep the browser's regional date order when it matches the chosen language
// (en-US vs en-GB, es-ES vs es-MX …); otherwise use a European default.
export const locale = computed(() => {
  const browser = browserLangs().find(l => l.toLowerCase().startsWith(lang.value))
  return browser ?? (lang.value === 'es' ? 'es-ES' : 'en-GB')
})

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const b = s => `<strong>${esc(s)}</strong>`
const pl = (n, one, other) => (n === 1 ? one : other)

const en = {
  docTitle: 'Schengen & UGE Work Days Calculator',
  language: 'Language',
  title: 'Schengen 90/180 & UGE Work Days Calculator',
  sub: 'For digital nomads with a <strong>pending Spanish Digital Nomad Visa</strong> application — overstays are counted and shown, not rejected. Enter your application date to also calculate the <strong>20 UGE work days</strong> the UGE has to respond, skipping weekends and Madrid holidays.',

  staysTitle: 'Your Schengen stays',
  clearAll: 'Clear all',
  confirmClear: 'Remove all trips, the DNV date and the documents requests?',
  staysHint: 'Entry and exit days both count as days in Schengen. Leave <em>exit</em> empty if you are still inside.',
  entry: 'Entry',
  exit: 'Exit',
  days: 'Days',
  daysUnit: ({ n }) => pl(n, ' day', ' days'),
  workDaysUnit: ({ n }) => pl(n, ' work day', ' work days'),
  ongoing: 'ongoing',
  remove: 'Remove',
  tripEntryAria: ({ i }) => `Trip ${i} entry date`,
  tripExitAria: ({ i }) => `Trip ${i} exit date`,
  removeTripAria: ({ i }) => `Remove trip ${i}`,
  addStay: '+ Add stay',
  err_entryMissing: 'Entry date is missing',
  err_exitBeforeEntry: 'Exit is before entry',

  dnvLabel: 'DNV application submitted',
  optional: '(optional)',
  dnvHint: 'Days after this date are shown as “covered by pending application”. This also shows when the UGE has to respond.',
  refLabel: 'Calculate as of',
  refHint: 'Defaults to today. Change it to see a past or future date.',

  ugeTitle: 'UGE response deadline',
  ugeUnsupported: 'The deadline calculator covers applications submitted in 2026 or 2027 (it needs the Madrid holiday calendar for those years).',
  ugeMustRespond: 'UGE must respond by',
  ugePaused: 'Paused',
  ugePausedSub: 'waiting for your response to the documents request',
  ugeCalendarAfter: ({ n }) => `${n} calendar ${pl(n, 'day', 'days')} after submission`,
  ugeElapsed: 'business days elapsed',
  ugeMsgPaused: ({ n, date }) => `${b(n)} business ${pl(n, 'day', 'days')} left. The count stopped on ${esc(date)} and resumes the day after you respond — enter that date below to see the new deadline.`,
  ugeMsgPausedNow: ({ n, date, resume }) => `${b(n)} business ${pl(n, 'day', 'days')} left. The count is paused on ${esc(date)} (documents request) and resumes on ${esc(resume)}.`,
  ugeMsgPassed: ({ date }) => `The 20-business-day period ended on ${b(date)}. If no decision was notified by then, the application is generally considered approved by <em>silencio administrativo positivo</em>. Ask an immigration lawyer how to get a certificate confirming it.`,
  ugeMsgLeft: ({ n, date }) => `${b(n)} business ${pl(n, 'day', 'days')} left, counted from ${esc(date)}.`,
  ugeDay0: ({ date }) => `Day 0: ${b(date)} (the day you submitted, even if it was a weekend or holiday). Day 1 is the next business day after it.`,
  ugeWeekends: 'Saturdays, Sundays and national, Comunidad de Madrid and Madrid city holidays don’t count.',
  ugeSkipped: ({ list }) => ` Holidays skipped in your period: ${list}.`,
  holidayCity: 'Madrid city',
  holidayMoved: ({ date }) => `moved from ${date}`,
  ugePause: ({ i, from, to, n }) => `Documents request #${i}: paused from ${b(from)} to ${b(to)} (${n} UGE work ${pl(n, 'day', 'days')} not counted).`,
  ugePauseOpen: ({ i, from }) => `Documents request #${i}: paused from ${b(from)} until you respond.`,
  docsCheck: 'The UGE asked for additional documents <small>(requerimiento)</small>',
  docsHint: 'Every day from a request to your response (both included) is skipped, like weekends and holidays. Leave <em>responded</em> empty if you haven’t answered yet.',
  requested: 'Requested',
  responded: 'Responded',
  paused: 'Paused',
  waiting: 'waiting',
  reqDateAria: ({ i }) => `Request ${i} date`,
  reqRespAria: ({ i }) => `Request ${i} response date`,
  removeReqAria: ({ i }) => `Remove request ${i}`,
  addRequest: '+ Add requerimiento',
  err_requestBeforeSubmission: 'The request date must be after the submission date.',
  err_responseBeforeRequest: 'The response date can’t be before the request date.',
  ugeLegal: 'Estimated under Ley 14/2013 art. 76 and Ley 39/2015 arts. 22.1.a and 30. The time it takes to deliver the decision to you can shift the deadline.',

  usedLbl: 'days used in the 180-day window',
  remaining: ({ n }) => `<strong>${esc(n)} ${pl(n, 'day', 'days')} remaining</strong> in the current window.`,
  legalUntil: ({ date }) => `If you stay continuously, your last legal day is ${b(date)}.`,
  covered: ({ n, date }) => `<strong>${esc(n)} ${pl(n, 'day', 'days')} over the 90-day limit</strong> — covered by your pending DNV application (filed ${esc(date)}). You may remain in Spain while it is being processed.`,
  over: ({ n }) => `<strong>${esc(n)} ${pl(n, 'day', 'days')} over the 90-day limit.</strong>`,
  filedLate: ({ date }) => ` Your DNV application date is after the day you first exceeded 90 days (${date}) — applications normally must be filed while your stay is still legal.`,
  enterDnv: ' If you have a pending DNV application, enter its date above.',

  earliest: 'Earliest re-entry',
  upTo: ({ n }) => ` · up to ${b(n)} ${pl(n, 'day', 'days')}`,
  fullStayHint: 'You can stay the full 90 days from this date: old days drop out of the window as fast as you add new ones.',
  assumesLeave: ({ date }) => `Assumes you leave on ${date}.`,
  stay90: '90-day continuous stay',
  stay90Hint: 'Earliest date you can enter and stay 90 days in a row. Entering earlier gives you a shorter stay (see the table below).',
  clearWin: 'Window completely clear',
  clearWinHint: '180 days after your last recorded day — no past days count any more.',

  overTitle: 'Overstay summary',
  overFirst: ({ date, peak }) => `Limit first exceeded on ${b(date)} (peak ${esc(peak)} days in a window).`,
  overTotal: ({ n }) => `${b(n)} ${pl(n, 'day', 'days')} in total ${pl(n, 'was', 'were')} beyond the 90-day limit.`,
  overCovered: ({ c, before }) => `${b(c)} of them fall on/after your DNV application date${before > 0 ? `; <strong class="warn">${esc(before)}</strong> ${pl(before, 'is', 'are')} before it` : ''}.`,
  overHint: 'Re-entry dates above still apply the normal 90/180 rule to all days you were physically present — that’s what border systems (EES) count if you travel on your passport before your residence card is issued.',

  msTitle: 'When can I come back, and for how long?',
  msStay: 'To stay at least',
  msEntry: 'Earliest entry date',
  msDays: ({ n }) => `${n} days`,
  planLabel: 'Check a specific entry date',
  planOverlaps: 'That date is already part of a recorded stay.',
  planNo: ({ date }) => `❌ You can’t enter on ${b(date)} — the window would already be full.`,
  planYes: ({ date, n, last }) => `✅ Entering on ${b(date)} you can stay <strong>${esc(n)} ${pl(n, 'day', 'days')}</strong>, leaving by ${b(last)}.`,

  chartTitle: 'Rolling day count',
  chartAria: 'Days used in rolling 180-day window over time',
  chartTip: ({ date, n }) => `${esc(date)} · ${b(n)} days in window`,
  chartIn: 'In Schengen',
  chartOut: 'Outside',
  chartOver: 'Over 90',
  chartLimit: '90-day limit',
  chartSelected: 'Selected date',
  chartDnv: 'DNV filed',

  infoTitle: 'How this works',
  info1: '<strong>90/180 rule:</strong> in any rolling 180-day period you may spend at most 90 days in the Schengen Area. Entry and exit days both count.',
  info2: '<strong>Overstay tolerance:</strong> if you applied for Spain’s Digital Nomad Visa (residence authorisation for international teleworkers) from inside Spain while your stay was still legal, you may remain while the application is processed. This calculator therefore never rejects stays above 90 days — it shows them and still tells you when you could re-enter.',
  info3: '<strong>Re-entry:</strong> the earliest date on which entering would keep you at or under 90 days in the preceding 180, and how long you could then stay as old days roll out of the window.',
  info4: 'Your data stays in your browser (localStorage). Nothing is sent anywhere.',
  disclaimer: 'Not legal advice. Rules, processing practice and border-control interpretation can change — check with the Spanish authorities or an immigration lawyer before travelling.',
  footer: 'Schengen DNV Calculator · open source · runs entirely in your browser',

  today: 'today',
  inDays: ({ n }) => `in ${n} ${pl(n, 'day', 'days')}`,
  daysAgo: ({ n }) => `${n} ${pl(n, 'day', 'days')} ago`,
}

const es = {
  docTitle: 'Calculadora Schengen y días hábiles UGE',
  language: 'Idioma',
  title: 'Calculadora Schengen 90/180 y días hábiles UGE',
  sub: 'Para nómadas digitales con una <strong>solicitud de visado de nómada digital en trámite</strong> en España: los excesos de estancia se cuentan y se muestran, no se rechazan. Introduce la fecha de tu solicitud para calcular también los <strong>20 días hábiles</strong> que tiene la UGE para responder, sin contar fines de semana ni festivos de Madrid.',

  staysTitle: 'Tus estancias en Schengen',
  clearAll: 'Borrar todo',
  confirmClear: '¿Borrar todas las estancias, la fecha de la solicitud y los requerimientos?',
  staysHint: 'Los días de entrada y de salida cuentan como días en Schengen. Deja la <em>salida</em> vacía si sigues dentro.',
  entry: 'Entrada',
  exit: 'Salida',
  days: 'Días',
  daysUnit: ({ n }) => pl(n, ' día', ' días'),
  workDaysUnit: ({ n }) => pl(n, ' día hábil', ' días hábiles'),
  ongoing: 'en curso',
  remove: 'Eliminar',
  tripEntryAria: ({ i }) => `Fecha de entrada de la estancia ${i}`,
  tripExitAria: ({ i }) => `Fecha de salida de la estancia ${i}`,
  removeTripAria: ({ i }) => `Eliminar estancia ${i}`,
  addStay: '+ Añadir estancia',
  err_entryMissing: 'Falta la fecha de entrada',
  err_exitBeforeEntry: 'La salida es anterior a la entrada',

  dnvLabel: 'Fecha de presentación de la solicitud DNV',
  optional: '(opcional)',
  dnvHint: 'Los días posteriores a esta fecha se muestran como “cubiertos por la solicitud en trámite”. También sirve para calcular cuándo tiene que responder la UGE.',
  refLabel: 'Calcular a fecha de',
  refHint: 'Por defecto, hoy. Cámbiala para ver una fecha pasada o futura.',

  ugeTitle: 'Plazo de respuesta de la UGE',
  ugeUnsupported: 'El cálculo del plazo cubre solicitudes presentadas en 2026 o 2027 (necesita el calendario de festivos de Madrid de esos años).',
  ugeMustRespond: 'La UGE debe responder antes del',
  ugePaused: 'En pausa',
  ugePausedSub: 'a la espera de que respondas al requerimiento',
  ugeCalendarAfter: ({ n }) => `${n} ${pl(n, 'día natural', 'días naturales')} después de la presentación`,
  ugeElapsed: 'días hábiles transcurridos',
  ugeMsgPaused: ({ n, date }) => `${pl(n, 'Queda', 'Quedan')} ${b(n)} ${pl(n, 'día hábil', 'días hábiles')}. El cómputo se detuvo el ${esc(date)} y se reanuda el día siguiente a tu respuesta; introduce esa fecha abajo para ver el nuevo plazo.`,
  ugeMsgPausedNow: ({ n, date, resume }) => `${pl(n, 'Queda', 'Quedan')} ${b(n)} ${pl(n, 'día hábil', 'días hábiles')}. El ${esc(date)} el cómputo está suspendido (requerimiento) y se reanuda el ${esc(resume)}.`,
  ugeMsgPassed: ({ date }) => `El plazo de 20 días hábiles terminó el ${b(date)}. Si no se notificó ninguna resolución antes de esa fecha, la solicitud se considera en general aprobada por <em>silencio administrativo positivo</em>. Consulta a un abogado de extranjería cómo obtener un certificado que lo acredite.`,
  ugeMsgLeft: ({ n, date }) => `${pl(n, 'Queda', 'Quedan')} ${b(n)} ${pl(n, 'día hábil', 'días hábiles')}, contando desde el ${esc(date)}.`,
  ugeDay0: ({ date }) => `Día 0: ${b(date)} (el día en que presentaste la solicitud, aunque fuera fin de semana o festivo). El día 1 es el siguiente día hábil.`,
  ugeWeekends: 'No cuentan los sábados, domingos ni los festivos nacionales, de la Comunidad de Madrid y de la ciudad de Madrid.',
  ugeSkipped: ({ list }) => ` Festivos excluidos en tu plazo: ${list}.`,
  holidayCity: 'ciudad de Madrid',
  holidayMoved: ({ date }) => `trasladado del ${date}`,
  ugePause: ({ i, from, to, n }) => `Requerimiento n.º ${i}: suspendido del ${b(from)} al ${b(to)} (${n} ${pl(n, 'día hábil', 'días hábiles')} sin contar).`,
  ugePauseOpen: ({ i, from }) => `Requerimiento n.º ${i}: suspendido desde el ${b(from)} hasta que respondas.`,
  docsCheck: 'La UGE me pidió documentación adicional <small>(requerimiento)</small>',
  docsHint: 'Todos los días desde el requerimiento hasta tu respuesta (ambos incluidos) se excluyen, igual que los fines de semana y festivos. Deja <em>respondido</em> vacío si aún no has contestado.',
  requested: 'Requerido',
  responded: 'Respondido',
  paused: 'Suspendido',
  waiting: 'pendiente',
  reqDateAria: ({ i }) => `Fecha del requerimiento ${i}`,
  reqRespAria: ({ i }) => `Fecha de respuesta al requerimiento ${i}`,
  removeReqAria: ({ i }) => `Eliminar requerimiento ${i}`,
  addRequest: '+ Añadir requerimiento',
  err_requestBeforeSubmission: 'La fecha del requerimiento debe ser posterior a la de presentación.',
  err_responseBeforeRequest: 'La fecha de respuesta no puede ser anterior a la del requerimiento.',
  ugeLegal: 'Estimación según la Ley 14/2013 art. 76 y la Ley 39/2015 arts. 22.1.a y 30. El tiempo que tarde en notificarse la resolución puede desplazar el plazo.',

  usedLbl: 'días usados en la ventana de 180 días',
  remaining: ({ n }) => `<strong>${pl(n, 'Queda', 'Quedan')} ${esc(n)} ${pl(n, 'día', 'días')}</strong> en la ventana actual.`,
  legalUntil: ({ date }) => `Si te quedas sin salir, tu último día legal es el ${b(date)}.`,
  covered: ({ n, date }) => `<strong>${esc(n)} ${pl(n, 'día', 'días')} por encima del límite de 90</strong>, cubiertos por tu solicitud DNV en trámite (presentada el ${esc(date)}). Puedes permanecer en España mientras se tramita.`,
  over: ({ n }) => `<strong>${esc(n)} ${pl(n, 'día', 'días')} por encima del límite de 90.</strong>`,
  filedLate: ({ date }) => ` La fecha de tu solicitud DNV es posterior al primer día en que superaste los 90 días (${date}); normalmente la solicitud debe presentarse mientras la estancia sigue siendo legal.`,
  enterDnv: ' Si tienes una solicitud DNV en trámite, introduce su fecha arriba.',

  earliest: 'Primera reentrada posible',
  upTo: ({ n }) => ` · hasta ${b(n)} ${pl(n, 'día', 'días')}`,
  fullStayHint: 'Puedes quedarte los 90 días completos desde esta fecha: los días antiguos salen de la ventana al mismo ritmo que sumas días nuevos.',
  assumesLeave: ({ date }) => `Suponiendo que sales el ${date}.`,
  stay90: 'Estancia continua de 90 días',
  stay90Hint: 'Primera fecha en la que puedes entrar y quedarte 90 días seguidos. Si entras antes, la estancia será más corta (ver la tabla de abajo).',
  clearWin: 'Ventana completamente libre',
  clearWinHint: '180 días después de tu último día registrado: ya no cuenta ningún día pasado.',

  overTitle: 'Resumen del exceso de estancia',
  overFirst: ({ date, peak }) => `Límite superado por primera vez el ${b(date)} (máximo de ${esc(peak)} días en una ventana).`,
  overTotal: ({ n }) => `${b(n)} ${pl(n, 'día estuvo', 'días estuvieron')} en total por encima del límite de 90.`,
  overCovered: ({ c, before }) => `${b(c)} de ellos ${pl(c, 'cae', 'caen')} en la fecha de tu solicitud DNV o después${before > 0 ? `; <strong class="warn">${esc(before)}</strong> ${pl(before, 'es anterior', 'son anteriores')}` : ''}.`,
  overHint: 'Las fechas de reentrada de arriba siguen aplicando la regla 90/180 a todos los días de presencia física: es lo que cuentan los sistemas fronterizos (EES) si viajas con tu pasaporte antes de tener la tarjeta de residencia.',

  msTitle: '¿Cuándo puedo volver y por cuánto tiempo?',
  msStay: 'Para quedarte al menos',
  msEntry: 'Primera fecha de entrada',
  msDays: ({ n }) => `${n} días`,
  planLabel: 'Comprobar una fecha de entrada',
  planOverlaps: 'Esa fecha ya forma parte de una estancia registrada.',
  planNo: ({ date }) => `❌ No puedes entrar el ${b(date)}: la ventana ya estaría completa.`,
  planYes: ({ date, n, last }) => `✅ Si entras el ${b(date)} puedes quedarte <strong>${esc(n)} ${pl(n, 'día', 'días')}</strong> y salir como tarde el ${b(last)}.`,

  chartTitle: 'Recuento móvil de días',
  chartAria: 'Días usados en la ventana móvil de 180 días a lo largo del tiempo',
  chartTip: ({ date, n }) => `${esc(date)} · ${b(n)} días en la ventana`,
  chartIn: 'En Schengen',
  chartOut: 'Fuera',
  chartOver: 'Más de 90',
  chartLimit: 'Límite de 90 días',
  chartSelected: 'Fecha seleccionada',
  chartDnv: 'Solicitud DNV',

  infoTitle: 'Cómo funciona',
  info1: '<strong>Regla 90/180:</strong> en cualquier periodo móvil de 180 días puedes pasar como máximo 90 días en el espacio Schengen. Cuentan tanto el día de entrada como el de salida.',
  info2: '<strong>Tolerancia por exceso de estancia:</strong> si solicitaste el visado de nómada digital (autorización de residencia para teletrabajo de carácter internacional) desde España mientras tu estancia aún era legal, puedes permanecer mientras se tramita. Por eso esta calculadora nunca rechaza estancias de más de 90 días: las muestra y te sigue indicando cuándo podrías volver a entrar.',
  info3: '<strong>Reentrada:</strong> la primera fecha en la que entrar te mantendría en 90 días o menos dentro de los 180 anteriores, y cuánto tiempo podrías quedarte a medida que los días antiguos salen de la ventana.',
  info4: 'Tus datos se quedan en tu navegador (localStorage). No se envía nada a ningún sitio.',
  disclaimer: 'No es asesoramiento legal. Las normas, la práctica administrativa y la interpretación en frontera pueden cambiar: consulta con las autoridades españolas o con un abogado de extranjería antes de viajar.',
  footer: 'Calculadora Schengen DNV · código abierto · funciona íntegramente en tu navegador',

  today: 'hoy',
  inDays: ({ n }) => `dentro de ${n} ${pl(n, 'día', 'días')}`,
  daysAgo: ({ n }) => `hace ${n} ${pl(n, 'día', 'días')}`,
}

export const messages = { en, es }

export function t(key, params = {}) {
  const m = messages[lang.value][key] ?? en[key] ?? key
  return typeof m === 'function' ? m(params) : m
}

watch(lang, l => {
  try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ }
  if (typeof document === 'undefined') return
  document.documentElement.lang = l
  document.title = t('docTitle')
}, { immediate: true })
