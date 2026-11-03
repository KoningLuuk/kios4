// Openbare KIOS 4-pagina: haalt de volgende wedstrijd en de gepubliceerde vakken uit de Jarvis-database.
// Deze sleutel is bedoeld om openbaar te zijn; de tabellen blijven dicht en public_next_match
// geeft alleen de wedstrijdgegevens en de gepubliceerde namen terug.
const SUPABASE_URL = 'https://kfqvzbhujqxwegrgvulu.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Agzy7_DmX6x42pnufB28Rw_mg-3HpWK'
const TEAM_SLUG = 'kios-4'

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

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d))
}

function formatStamp(iso) {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' }).format(date)
  const time = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(date)
  return `Gepubliceerd op ${day} om ${time}`
}

/** Namen komen uit de database: altijd via textContent op de pagina zetten. */
function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function playerChip(player, slotGender) {
  const chip = el('div', `chip g-${player.gender === 'H' ? 'H' : 'D'}`)
  chip.append(el('span', 'name', player.name))
  if (slotGender && slotGender !== player.gender) chip.append(el('span', 'tag', AS[slotGender]))
  return chip
}

function renderSlots(vak, slots, mirror) {
  return SLOT_XY.map(([x, y0], i) => {
    const y = mirror ? 400 - y0 : y0
    const slot = el('div', `slot slot-${SLOT_GENDER[i]}`)
    slot.style.left = `${((x - VIEW.x) / VIEW.w) * 100}%`
    slot.style.top = `${((y - VIEW.y) / VIEW.h) * 100}%`
    const player = slots?.[i]
    if (player) slot.append(playerChip(player, SLOT_GENDER[i]))
    else slot.append(el('span', 'open', `${ROLE[SLOT_GENDER[i]]} · open`))
    slot.setAttribute('aria-label', `${vak}, ${ROLE[SLOT_GENDER[i]]}`)
    return slot
  })
}

function showNotice(text) {
  $('notice').textContent = text
  $('notice').hidden = false
}

function render(data) {
  $('retry').hidden = true
  $('notice').hidden = true
  $('lineup').hidden = true

  const match = data?.match
  $('match').hidden = !match
  if (!match) return showNotice('Er staat nog geen volgende wedstrijd gepland.')

  const opponent = match.opponent?.trim()
  $('match-opponent').textContent = opponent ? `${match.home ? 'Thuis tegen' : 'Uit bij'} ${opponent}` : match.home ? 'Thuiswedstrijd' : 'Uitwedstrijd'
  $('match-when').textContent = [formatDate(match.date), match.time && `${match.time} uur`].filter(Boolean).join(' · ')

  const lineup = match.lineup
  if (!lineup) return showNotice('De vakken voor deze wedstrijd moeten nog gepubliceerd worden.')

  $('slots').replaceChildren(...renderSlots('Aanval', lineup.attack, false), ...renderSlots('Verdediging', lineup.defense, true))
  const bench = lineup.bench ?? []
  $('bench').replaceChildren(...(bench.length ? bench.map((p) => playerChip(p)) : [el('span', 'open', 'Geen wisselspelers')]))
  $('stamp').textContent = match.publishedAt ? formatStamp(match.publishedAt) : ''
  $('lineup').hidden = false
}

let lastLoad = 0

async function load(silent) {
  if (!silent) {
    $('retry').hidden = true
    showNotice('Gegevens ophalen…')
  }
  lastLoad = Date.now()
  try {
    render(await fetchNextMatch())
  } catch {
    // lukt het op de achtergrond even niet, dan blijft staan wat er al stond
    if (silent) return
    $('match').hidden = true
    $('lineup').hidden = true
    showNotice('De gegevens kunnen nu niet worden opgehaald. Controleer je verbinding en probeer het opnieuw.')
    $('retry').hidden = false
  }
}

$('retry').addEventListener('click', () => load(false))

// Pagina weer geopend (bijv. vanuit WhatsApp): de nieuwste stand ophalen
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - lastLoad > 60000) load(true)
})

load(false)
