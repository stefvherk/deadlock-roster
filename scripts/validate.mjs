// Checks public/data/roster.json for completeness: every hero, ability, stat, icon and text.
// Usage: npm run validate     (exits non-zero on errors; warnings are informational)
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC = new URL('../public/', import.meta.url)
const roster = JSON.parse(readFileSync(new URL('data/roster.json', PUBLIC), 'utf8'))
const errors = []
const warnings = []
const err = (where, msg) => errors.push(`${where}: ${msg}`)
const warn = (where, msg) => warnings.push(`${where}: ${msg}`)
// Exact-case check: Windows finds "A.webp" for "a.webp"; a Linux web host will not.
const onDisk = (p) => {
  if (!p) return false
  const file = fileURLToPath(new URL(p.replace(/^\//, ''), PUBLIC))
  return existsSync(file) && readdirSync(dirname(file)).includes(basename(file))
}

// Leftovers that mean game text wasn't fully rendered — or was broken as shipped by the game
// (e.g. "IGNORED[]% Max Health Damage", an unfinished string on Apollo's ultimate).
const RAW = /\{g:|\{s:|\{[a-z]:|#ability_|\[\[|\{\{|<\/?Panel|undefined|NaN|\[object|IGNORED|\[\s*\]/
const textOf = (html) => html.replace(/<[^>]+>/g, '').trim()

if (roster.heroes.length < 40) err('roster', `only ${roster.heroes.length} heroes`)
if (!roster.patch) err('roster', 'no patch date')

for (const [id, g] of Object.entries(roster.glossary)) {
  if (!g.definition || /^#REDIRECT/i.test(g.definition) || g.definition.length < 25) err(`glossary ${id}`, `bad definition "${g.definition}"`)
}
// Every term that game text links to must have an entry, or its hover tip silently disappears.
for (const id of new Set(Object.values(roster.attrTerms ?? {}))) if (!roster.glossary[id]) err(`glossary ${id}`, 'missing entry')

for (const h of roster.heroes) {
  const at = h.name
  for (const k of ['render', 'card', 'name']) if (!onDisk(h.images[k])) err(at, `missing ${k} image`)
  if (h.images.gloat && !onDisk(h.images.gloat)) err(at, 'gloat image path broken')
  // Every released hero has gloat art on the wiki, even when the file name is irregular.
  if (!h.images.gloat) warn(at, 'no gloat (hover) art found — the roster card will only zoom on hover')
  if (!/^#[0-9a-f]{6}$/i.test(h.accent)) err(at, `bad accent ${h.accent}`)
  if (h.tags.length !== 3) err(at, `expected 3 tags, got ${h.tags.length}`)
  if (!h.role) warn(at, 'no role text in game data')
  if (!h.playstyle) warn(at, 'no playstyle text in game data')
  if (!h.lore.length) err(at, 'no lore')
  // A dropped line break leaves text glued together: "…death squads)Step 1" or "show.Ice Skate".
  const glued = /[a-z)][.!?)][A-Z]/
  for (const [field, text] of [
    ...h.lore.map((p, i) => [`lore paragraph ${i + 1}`, p]),
    ...(h.loreTranslation?.paragraphs ?? []).map((p, i) => [`translation paragraph ${i + 1}`, p]),
    ['role', h.role],
    ['playstyle', h.playstyle],
    ...h.abilities.map((a) => [`${a.name} quip`, a.quip]),
  ])
    if (glued.test(text)) err(at, `${field} has words glued together: "…${text.slice(Math.max(0, text.search(glued) - 20), text.search(glued) + 20)}…"`)
  if (h.loreLang !== 'en' && !h.loreTranslation?.paragraphs.length) err(at, `lore is ${h.loreLang} with no translation`)
  if (!h.weapon.name) err(at, 'no weapon name')
  if (!h.weapon.types.length) warn(at, 'no weapon types')
  for (const id of ['weapon', 'vitality']) {
    const g = h.statGroups.find((s) => s.id === id)
    if (!g || g.stats.length < 5) err(at, `stat group ${id} has ${g?.stats.length ?? 0} stats`)
  }
  for (const g of h.statGroups)
    for (const s of g.stats) {
      if (!Number.isFinite(s.value)) err(at, `stat ${s.key} not a number`)
      if (!s.label || /In Meters|[a-z][A-Z]/.test(s.label)) warn(at, `stat label looks raw: "${s.label}" (${s.key})`)
    }
  for (const s of [...h.statGroups.flatMap((g) => g.stats), ...h.levelScaling, ...h.spiritScaling]) {
    const def = roster.statDefinitions?.[s.key]
    if (!def?.text || def.text.length < 20 || RAW.test(def.text) || /\s\.|:\.?$|\b(\w+) \1\b/.test(def.text))
      err(at, `stat ${s.key} has no usable definition: "${def?.text}"`)
  }
  if (h.abilities.length !== 4) err(at, `${h.abilities.length} abilities`)

  for (const a of h.abilities) {
    const aw = `${at} / ${a.name}`
    if (!onDisk(a.icon)) err(aw, 'missing icon')
    if (!a.quip) warn(aw, 'no quip')
    if (!a.sections.some((s) => textOf(s.html))) err(aw, 'no description text')
    for (const s of a.sections) {
      if (RAW.test(s.html)) err(aw, `unrendered text: ${s.html.match(RAW)[0]} in "${textOf(s.html).slice(0, 60)}"`)
      for (const src of s.html.matchAll(/src="([^"]+)"/g)) if (!onDisk(src[1])) err(aw, `inline icon missing on disk: ${src[1]}`)
      for (const b of s.blocks) for (const k of b.props) if (!a.props[k]) err(aw, `block references unknown prop ${k}`)
    }
    for (const k of [...a.header, ...a.extras.flatMap((e) => e.props)]) if (!a.props[k]) err(aw, `unknown prop ${k}`)
    for (const p of Object.values(a.props)) {
      // 9999s is the game's "no limit" marker and the site shows it as such; flag other huge values
      // so a new sentinel never slips onto the page as a fake number.
      if (Math.abs(p.base) >= 9999 && p.postfix.trim() !== 's') warn(aw, `${p.key} = ${p.base}${p.postfix} looks like a sentinel value`)
      if (!p.label) err(aw, `prop ${p.key} has no label`)
      if (!Number.isFinite(p.base)) err(aw, `prop ${p.key} base not a number`)
      if (!p.hidden && p.icon && !onDisk(p.icon)) err(aw, `prop icon missing: ${p.icon}`)
    }
    if (a.upgrades.length !== 3) err(aw, `${a.upgrades.length} upgrades`)
    a.upgrades.forEach((u, i) => {
      if (!textOf(u.html) && !u.changes.length) err(aw, `tier ${i + 1} has no text or changes`)
      if (RAW.test(u.html)) err(aw, `tier ${i + 1} unrendered text: ${u.html.match(RAW)[0]}`)
    })
  }
}

const abilities = roster.heroes.reduce((n, h) => n + h.abilities.length, 0)
console.log(`Checked ${roster.heroes.length} heroes, ${abilities} abilities, ${Object.keys(roster.glossary).length} glossary terms (patch ${roster.patch}).`)
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ` + warnings.join('\n  '))
if (errors.length) {
  console.log(`\n${errors.length} ERROR(S):\n  ` + errors.join('\n  '))
  process.exit(1)
}
console.log('\nNo errors.')
