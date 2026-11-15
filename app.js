// Openbare KIOS 4-pagina: haalt de volgende wedstrijd en de gepubliceerde vakken uit de Jarvis-database.
// Deze sleutel is bedoeld om openbaar te zijn; de tabellen blijven dicht en public_next_match
// geeft alleen de wedstrijdgegevens en de gepubliceerde namen terug.
const SUPABASE_URL = 'https://kfqvzbhujqxwegrgvulu.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Agzy7_DmX6x42pnufB28Rw_mg-3HpWK'
const TEAM_SLUG = 'kios-4'
const TEAM_NAME = 'KIOS 4'
const CREST = 'kios-logo.png'

/** Versie van deze pagina: de ?v= achter app.js, die npm run site erbij zet. Leeg bij lokaal testen. */
const PAGE_VERSION = new URL(document.currentScript.src).searchParams.get('v') || ''

const $ = (id) => document.getElementById(id)

/** Plekken op het veld, in dezelfde eenheden als de tekening. Index 0-1 = dames, 2-3 = heren. */
const SLOT_GENDER = ['D', 'D', 'H', 'H']
const SLOT_XY = [
  [50, 26],
  [50, 150],
  [150, 26],
  [150, 150],
]
const VIEW = { x: -12, y: -12, w: 224, h: 424 }
const AS = { D: 'als dame', H: 'als heer' }
const ROLE = { D: 'Dame', H: 'Heer' }

async function fetchNextMatch() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_next_match`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_slug: TEAM_SLUG }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const format = (options, date) => new Intl.DateTimeFormat('nl-NL', options).format(date)

/** De datum uit de database (jjjj-mm-dd) als lokale datum, zonder tijdzoneverschuiving. */
function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatStamp(iso) {
  const date = new Date(iso)
  return `Gepubliceerd op ${format({ day: 'numeric', month: 'long' }, date)} om ${format({ hour: '2-digit', minute: '2-digit' }, date)}`
}

/** Hele kalenderdagen tot de wedstrijd (afronden vangt de overgang naar zomer- of wintertijd op). */
function daysUntil(date) {
  const now = new Date()
  return Math.round((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
}

function countdown(days) {
  if (days === 0) return { text: 'Vandaag', kind: 'today' }
  if (days === 1) return { text: 'Morgen', kind: 'soon' }
  if (days > 1) return { text: `Over ${days} dagen`, kind: days < 7 ? 'soon' : '' }
  return null
}

/** Namen komen uit de database: altijd via textContent op de pagina zetten. */
function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function teamBlock(name, us, initial) {
  const team = el('div', us ? 'team us' : 'team')
  if (us) {
    const crest = el('img', 'team-crest')
    crest.src = CREST
    crest.alt = ''
    crest.width = 60
    crest.height = 60
    team.append(crest)
  } else {
    team.append(el('span', 'team-crest letter', initial))
  }
  team.append(el('span', name.length > 16 ? 'team-name long' : 'team-name', name))
  return team
}

function playerChip(player, slotGender) {
  const chip = el('div', `chip g-${player.gender === 'H' ? 'H' : 'D'}`)
  chip.append(el('span', 'name', player.name))
  if (slotGender && slotGender !== player.gender) chip.append(el('span', 'tag', AS[slotGender]))
  return chip
}

function subRow(sub) {
  const out = el('span', 'sub-out')
  out.append(el('span', 'sub-name', sub.out.name))
  const into = el('span', 'sub-in')
  into.append(el('span', 'sub-name', sub.in.name))
  const row = el('div', 'sub')
  row.append(el('span', 'sub-min', `${sub.minute}'`), out, el('span', 'sub-arrow', '→'), into)
  return row
}

function renderSlots(vak, slots, mirror, offset) {
  return SLOT_XY.map(([x, y0], i) => {
    const y = mirror ? 400 - y0 : y0
    const slot = el('div', `slot slot-${SLOT_GENDER[i]}`)
    slot.style.left = `${((x - VIEW.x) / VIEW.w) * 100}%`
    slot.style.top = `${((y - VIEW.y) / VIEW.h) * 100}%`
    const player = slots?.[i]
    const content = player ? playerChip(player, SLOT_GENDER[i]) : el('span', 'open', `${ROLE[SLOT_GENDER[i]]} · open`)
    content.style.animationDelay = `${180 + (offset + i) * 45}ms`
    slot.append(content)
    slot.setAttribute('aria-label', `${vak}, ${ROLE[SLOT_GENDER[i]]}`)
    return slot
  })
}

function showNotice(text, kind) {
  $('notice').textContent = text
  $('notice').className = kind ? `card notice ${kind}` : 'card notice'
  $('notice').hidden = false
}

function renderMatch(match, teamName) {
  const date = localDate(match.date)
  const opponent = match.opponent?.trim()
  const us = teamBlock(teamName, true)
  const them = opponent ? teamBlock(opponent, false, opponent.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? '?') : teamBlock('Tegenstander volgt', false, '?')
  // de thuisploeg staat links, zoals in elk wedstrijdoverzicht
  $('team-home').replaceChildren(match.home ? us : them)
  $('team-away').replaceChildren(match.home ? them : us)

  $('match-day').textContent = format({ weekday: 'long' }, date)
  $('match-date').textContent = format({ day: 'numeric', month: 'long' }, date)
  $('match-time').textContent = match.time || ''
  $('match-time').hidden = !match.time

  const days = daysUntil(date)
  const soon = countdown(days)
  $('match-countdown').hidden = !soon
  if (soon) {
    $('match-countdown').textContent = soon.text
    $('match-countdown').className = soon.kind ? `countdown ${soon.kind}` : 'countdown'
  }

  $('match-venue').textContent = match.home ? 'Thuiswedstrijd' : 'Uitwedstrijd'
  $('match-venue').className = `venue ${match.home ? 'home' : 'away'}`
  const departure = !match.home && match.departure
  $('match-departure').textContent = departure ? `Vertrek om ${departure} uur` : ''
  $('match-departure').hidden = !departure

  // voor schermlezers: de wedstrijd in één zin
  const when = [format({ weekday: 'long', day: 'numeric', month: 'long' }, date), match.time && `om ${match.time} uur`].filter(Boolean).join(' ')
  const against = opponent ? `${match.home ? 'Thuis tegen' : 'Uit bij'} ${opponent}` : match.home ? 'Thuiswedstrijd' : 'Uitwedstrijd'
  $('match-summary').textContent = `${against}, ${when}${soon ? ` (${soon.text.toLowerCase()})` : ''}.`
}

let introEnding = false

function render(data) {
  $('retry').hidden = true
  $('notice').hidden = true
  $('lineup').hidden = true

  const match = data?.match
  $('match').hidden = !match
  if (match) renderMatch(match, data.team?.trim() || TEAM_NAME)

  // de binnenkomst-animatie alleen bij de eerste keer, niet bij het stil verversen
  if (!introEnding) {
    introEnding = true
    setTimeout(() => document.body.classList.remove('intro'), 1600)
  }

  if (!match) return showNotice('Er staat nog geen volgende wedstrijd gepland.')

  const lineup = match.lineup
  if (!lineup) return showNotice('De vakken voor deze wedstrijd moeten nog gepubliceerd worden.')

  $('slots').replaceChildren(...renderSlots('Aanval', lineup.attack, false, 0), ...renderSlots('Verdediging', lineup.defense, true, 4))
  const bench = lineup.bench ?? []
  $('bench').replaceChildren(...(bench.length ? bench.map((p) => playerChip(p)) : [el('span', 'open', 'Geen wisselspelers')]))
  $('bench-count').textContent = `${bench.length} ${bench.length === 1 ? 'speler' : 'spelers'}`
  $('bench-count').hidden = !bench.length
  // alleen aanwezig als de trainer de wissels voor deze wedstrijd aan heeft gezet
  const subs = lineup.subs
  $('subs-panel').hidden = !subs
  if (subs) $('subs').replaceChildren(...(subs.length ? subs.map(subRow) : [el('span', 'open', 'Geen wissels gepland')]))
  $('stamp').textContent = match.publishedAt ? formatStamp(match.publishedAt) : ''
  $('lineup').hidden = false
}

let lastLoad = 0

async function load(silent) {
  if (!silent) {
    $('retry').hidden = true
    showNotice('Gegevens ophalen…', 'loading')
  }
  lastLoad = Date.now()
  try {
    render(await fetchNextMatch())
  } catch {
    // lukt het op de achtergrond even niet, dan blijft staan wat er al stond
    if (silent) return
    $('match').hidden = true
    $('lineup').hidden = true
    showNotice('De gegevens kunnen nu niet worden opgehaald. Controleer je verbinding en probeer het opnieuw.', 'error')
    $('retry').hidden = false
  }
}

/**
 * Staat er online een nieuwere versie van de pagina, dan herladen. Een telefoon houdt een open
 * tabblad soms dagen vast; zo krijgt ook die na een update de nieuwe opmaak.
 * De unieke ?versie= en no-store halen index.html altijd vers op, buiten elke cache om.
 */
async function reloadIfOutdated() {
  if (!PAGE_VERSION) return
  try {
    const res = await fetch(`./?versie=${Date.now()}`, { cache: 'no-store' })
    const online = (await res.text()).match(/app\.js\?v=([0-9a-f]+)/)?.[1]
    if (online && online !== PAGE_VERSION) location.reload()
  } catch {
    // geen verbinding: de huidige pagina gewoon laten staan
  }
}

$('retry').addEventListener('click', () => load(false))

// Pagina weer geopend (bijv. vanuit WhatsApp): de nieuwste stand ophalen
document.addEventListener('visibilitychange', () => {
  if (document.hidden || Date.now() - lastLoad <= 60000) return
  load(true)
  reloadIfOutdated()
})

load(false)
