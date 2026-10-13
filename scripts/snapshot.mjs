// Builds the site's data and artwork from the Deadlock Wiki (deadlock.wiki):
//   • Data:*.json        — game data the wiki extracts from the game files each patch
//   • Module:Lang        — how the wiki renders inline stat icons and key bindings
//   • Module:Icon/attr   — which icon the wiki shows for each stat type
//   • Status Effects etc — definitions used for the glossary tooltips
//   • File:*             — hero renders, cards, name logos, ability and stat icons
//
// Usage: npm run snapshot              (rebuild data, download missing art)
//        npm run snapshot -- --force   (also re-download all art)
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const WIKI = 'https://deadlock.wiki'
const UA = { 'User-Agent': 'deadlock-roster-fan-site/1.0 (static snapshot; polite, sequential)' }
const FORCE = process.argv.includes('--force')
const PUBLIC = new URL('../public/', import.meta.url)
const out = (rel) => fileURLToPath(new URL(rel, PUBLIC))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ fetching */

async function get(url, as = 'json') {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) return as === 'json' ? res.json() : as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer())
    if (attempt >= 3 || res.status === 404) throw new Error(`${url} → HTTP ${res.status}`)
    await sleep(800 * attempt)
  }
}
const pagePath = (title) => encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')
const rawCache = new Map()
const wikiRaw = (title) => {
  if (!rawCache.has(title)) rawCache.set(title, get(`${WIKI}/${pagePath(title)}?action=raw`, 'text'))
  return rawCache.get(title)
}
const wikiJson = (title) => get(`${WIKI}/${pagePath(title)}?action=raw`)
const fileUrl = (name) => `${WIKI}/Special:FilePath/${encodeURIComponent(name.replace(/ /g, '_'))}`

/** Which of these File: names exist on the wiki. */
async function existingFiles(names) {
  const found = new Set()
  for (let i = 0; i < names.length; i += 50) {
    const titles = names.slice(i, i + 50).map((n) => `File:${n}`)
    const j = await get(`${WIKI}/api.php?action=query&prop=imageinfo&iiprop=size&format=json&titles=${encodeURIComponent(titles.join('|'))}`)
    const back = Object.fromEntries((j.query.normalized ?? []).map((n) => [n.to, n.from]))
    for (const p of Object.values(j.query.pages)) if (p.imageinfo) found.add((back[p.title] ?? p.title).replace(/^File:/, ''))
    await sleep(250)
  }
  return found
}

/* ------------------------------------------------------------------ assets */

/** Downloads a wiki file to public/<rel>; raster images are converted to WebP. Returns the site path. */
async function saveFile(wikiName, rel, { width, quality = 82 } = {}) {
  const file = out(rel)
  if (!existsSync(file) || FORCE) {
    await mkdir(fileURLToPath(new URL('.', new URL(rel, PUBLIC))), { recursive: true })
    const buf = await get(fileUrl(wikiName), 'buffer')
    if (rel.endsWith('.svg')) await writeFile(file, buf)
    else {
      let img = sharp(buf)
      if (width) img = img.resize({ width, withoutEnlargement: true })
      await img.webp({ quality, alphaQuality: 90 }).toFile(file)
    }
    await sleep(150)
  }
  return '/' + rel
}

function rgbToHsl(r, g, b) {
  ;[r, g, b] = [r / 255, g / 255, b / 255]
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2, d = max - min
  if (!d) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The artwork's most prominent saturated hue, nudged into a range that reads well as
 * text and glow on the site's near-black background.
 */
async function accentFrom(rel) {
  const { data, info } = await sharp(out(rel)).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (const minSat of [0.35, 0.18]) {
    const bins = Array.from({ length: 24 }, () => ({ w: 0, h: 0, s: 0 }))
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i + 3] < 200) continue
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
      if (s < minSat || l < 0.2 || l > 0.8) continue
      const w = s * (1 - Math.abs(l - 0.5))
      const bin = bins[Math.floor(h / 15) % 24]
      bin.w += w; bin.h += h * w; bin.s += s * w
    }
    const top = bins.reduce((a, b) => (b.w > a.w ? b : a))
    if (top.w) {
      const sat = Math.min(0.82, Math.max(0.5, top.s / top.w))
      return hslToHex(top.h / top.w, sat, 0.6)
    }
  }
  return '#d9b36c'
}

/* ------------------------------------------------------------------ text helpers */

const humanize = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
const slugify = (name) => name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const stripTags = (s) => s.replace(/<[^>]+>/g, '')
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
const hasCJK = (s) => /[぀-ヿ一-鿿]/.test(s)

/** Plain text from wikitext: drops refs, templates and markup, keeps link text. */
function wikiToText(s) {
  return decode(
    stripTags(
      s
        .replace(/<ref[^>]*\/>/g, '')
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
        .replace(/\{\{(?:HeroIcon|AbilityIcon|ItemIcon|PageRef|plink|Plink)\|([^}|]+)[^}]*\}\}/g, '$1')
        // "{{Souls}} [[Souls]]" is an icon plus a link — the link already carries the word.
        .replace(/\{\{Souls[^}]*\}\}\s*/g, '')
        .replace(/\{\{[^{}]*\}\}/g, '')
        .replace(/\[\[(?:File|Image):[^\]]*\]\]/g, '')
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, ''),
    ),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/** Splits game text with <br><br> breaks into clean paragraphs. */
function paragraphs(html = '', joinLines = false) {
  return html
    .split(/<br\s*\/?>\s*<br\s*\/?>/i)
    .map((p) => {
      // Japanese text wraps mid-sentence with <br> to fit the in-game box: join those lines.
      if (joinLines) return decode(stripTags(p.replace(/<br\s*\/?>/gi, ''))).replace(/\s+/g, '').trim()
      // Elsewhere a single <br> is a deliberate line break (Rat King's plan, Baba's list): keep it as "\n".
      return p
        .split(/<br\s*\/?>/i)
        .map((line) => decode(stripTags(line)).replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
    })
    .filter(Boolean)
}

/** The prose that follows the render on a wiki "<Hero>/Lore" page (Yamato's official English backstory). */
function lorePageParagraphs(wikitext) {
  const lines = wikitext.split('\n')
  const start = lines.findIndex((l) => l.startsWith('[[File:'))
  if (start < 0) return []
  const body = []
  for (const line of lines.slice(start + 1)) {
    if (/^(==|\{\{|\[\[Category)/.test(line.trim())) break
    body.push(line)
  }
  return body
    .join('\n')
    .split(/<br\s*\/?>\s*<br\s*\/?>|\n\s*\n/i)
    .map(wikiToText)
    .filter(Boolean)
}

/** Lua table entries like  Name = {icon='…[[File:X.png|…', label_color='#abc', …}  → { Name: { file, color } } */
function parseLuaIconTable(lua, block) {
  const start = lua.indexOf(block)
  const body = lua.slice(start, lua.indexOf('\n}', start))
  const entries = {}
  for (const m of body.matchAll(/^\s*([A-Za-z_]+)\s*=\s*\{([^\n]*)\}/gm)) {
    const file = m[2].match(/(?:File:|img=')([^|'\]]+\.(?:png|svg))/)?.[1]
    const color = m[2].match(/label_color\s*=\s*'([^']+)'/)?.[1]
    if (file) entries[m[1]] = { file: file.replace(/ /g, '_'), color }
  }
  return entries
}

/* ================================================================== build */

console.log('Fetching wiki game data…')
const heroData = await wikiJson('Data:HeroData.json')
const abilityCards = await wikiJson('Data:AbilityCards.json')
const lang = await wikiJson('Data:Lang en.json')
const latest = await wikiJson('Data:LatestUpdate.json')
const statOrder = await wikiJson('Data:StatInfoboxOrder.json')
const attributeData = await wikiJson('Data:AttributeData.json')
const dictionary = await wikiJson('Data:Dictionary')
const releaseText = await wikiRaw('Heroes by release')
const langModule = await wikiRaw('Module:Lang')
const iconAttrModule = await wikiRaw('Module:Icon/attr')
const statusPage = await wikiRaw('Status Effects')
const { month, day, year } = latest.latest_update
const patch = `${month} ${day}, ${year}`

// ---- Text lookup, honouring the wiki's key overrides for odd localisation names.
const keyOverrides = Object.fromEntries(
  [...langModule.slice(0, langModule.indexOf('function')).matchAll(/^\s*([A-Za-z0-9_]+)\s*=\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]),
)
const t = (key) => (key ? lang[keyOverrides[key] ?? key] ?? lang[key] : undefined)

// ---- Released roster: the wiki's release table (rows with a release date).
const released = releaseText
  .split(/\n\|-\n/)
  .slice(1)
  .map((r) => r.split('\n').map((l) => l.replace(/^\|/, '').trim()))
  .filter((r) => /^\d{4}-\d\d-\d\d$/.test(r[2] ?? ''))
  .map((r) => ({ name: r[1].match(/HeroIcon\|([^}]+)/)?.[1], releaseDate: r[2] }))
const heroKeyByName = new Map(Object.entries(heroData).map(([k, h]) => [h.Name, k]))
for (const r of released) if (!heroKeyByName.has(r.name) || !abilityCards[heroKeyByName.get(r.name)]) throw new Error(`No game data for released hero "${r.name}"`)
console.log(`  ${released.length} released heroes, data for patch ${patch}`)

// ---- Icons, exactly as the wiki maps them.
const attrMap = parseLuaIconTable(langModule, 'local replacements')
const typeMap = parseLuaIconTable(iconAttrModule, 'ATTR_TYPE_ICON_MAP')
console.log(`  ${Object.keys(attrMap).length} inline attribute icons, ${Object.keys(typeMap).length} stat-type icons`)
const iconCache = new Map()
// Lower-case local names (Windows and macOS disks are case-insensitive, so "Bullet_damage" and
// "Bullet_Damage" — two different wiki files — would overwrite each other) and keep them distinct.
const usedIconNames = new Map()
function localIconName(file) {
  const base = file.replace(/\.(png|svg)$/i, '').replace(/[^A-Za-z0-9_-]/g, '_').toLowerCase()
  let name = base
  for (let n = 2; usedIconNames.has(name) && usedIconNames.get(name) !== file; n++) name = `${base}-${n}`
  usedIconNames.set(name, file)
  return name
}
async function icon(file, folder) {
  if (!iconCache.has(file)) {
    const rel = `icons/${folder}/${localIconName(file)}.webp`
    iconCache.set(file, await saveFile(file, rel, { width: 64 }).catch((e) => (console.warn(`  icon ${file}: ${e.message}`), null)))
  }
  return iconCache.get(file)
}
const attrIcons = {}
for (const [name, { file, color }] of Object.entries(attrMap)) attrIcons[name] = { src: await icon(file, 'attr'), color: color ?? null }
const typeIcons = {}
for (const [type, { file }] of Object.entries(typeMap)) typeIcons[type] = await icon(file, 'props')

// ---- Game-text rendering, mirroring Module:Lang.
const KEYBIND_FIXES = { MoveForward: 'forward', AltCast: 'alt_cast' }
function attrSpan(name) {
  const a = attrIcons[name]
  const label = t(`InlineAttribute_${name}`) ?? ''
  const img = a?.src ? `<img class="inline-attr__icon" src="${a.src}" alt="">` : ''
  const style = a?.color ? ` style="--attr:${a.color}"` : ''
  return `<span class="inline-attr" data-attr="${name}"${style}>${img}${label ? `<span class="inline-attr__label">${label}</span>` : ''}</span>`
}
/**
 * Game text that is unusable as shipped: Valve left an unfinished string ("IGNORED[]% Max Health
 * Damage" on Apollo's ultimate), or a value placeholder we couldn't fill. Callers fall back to text
 * built from the real stat data instead of showing it.
 */
const BROKEN_GAME_TEXT = /IGNORED|\[\s*\]|\{[a-z]:[^}]*\}/i
const fmtValue = (v) => `${v < 0 ? '−' : ''}${Math.round(Math.abs(v) * 100) / 100}`

/** Fills {s:Name} value placeholders from `values` ({s:sign} becomes the sign of the value that follows). */
function fillPlaceholders(html, values) {
  return html
    .replace(/\{s:sign\}\{s:([A-Za-z0-9_]+)\}/g, (m, k) => (k in values ? `${values[k] < 0 ? '−' : '+'}${fmtValue(Math.abs(values[k]))}` : m))
    .replace(/\{s:([A-Za-z0-9_]+)\}/g, (m, k) => (k !== 'sign' && k in values ? fmtValue(values[k]) : m))
}

/** Renders game text; returns null when the text is broken and shouldn't be shown (see BROKEN_GAME_TEXT). */
function renderGameTextOrNull(html, values = {}) {
  const filled = fillPlaceholders(html ?? '', values)
  if (BROKEN_GAME_TEXT.test(filled.replace(/\{g:[^}]*\}/g, ''))) return null
  return renderGameText(filled)
}

function renderGameText(html = '') {
  return html
    .replace(/"n/g, '<br>')
    .replace(/<\/spawn>/g, '</span>')
    .replace(/<Panel class="AbilityPropertyIcon StatDesc_TechPower">\s*<\/Panel>/g, attrSpan('Spirit'))
    .replace(/<Panel class="AbilityPropertyIcon prop_([A-Za-z_]+)">\s*<\/Panel>/g, (_, k) => attrSpan(k))
    .replace(/<\/?Panel[^>]*>/g, '')
    .replace(/\{g:citadel_inline_attribute:'([A-Za-z]+)'\}/g, (_, k) => attrSpan(k))
    .replace(/\{g:citadel_binding:'([A-Za-z0-9]+)'\}/g, (_, b) => {
      const label = t(`citadel_keybind_${KEYBIND_FIXES[b] ?? b.toLowerCase()}`) ?? humanize(b)
      return ` <kbd class="binding">${label}</kbd>`
    })
    .replace(/\{[a-z]:[^}]*\}/gi, '')
    .replace(/\s+([.,:;!?])/g, '$1')
    .trim()
}

// ---- Ability cards.
/** Game-text problems found while building cards; printed at the end so they get noticed. */
const gameTextIssues = []
const SCALE_STATS = { spirit: 'spirit', weapon_power: 'weapon', weapon_damage_increase: 'weapon', melee: 'melee', heavy_melee: 'melee' }
const num = (v) => (typeof v === 'number' ? v : v && typeof v === 'object' ? Number(v.Value) || 0 : Number(v) || 0)
const ABILITY_GROUPS = [
  ['Damage', 'Damage'], ['Debuff', 'Debuff'], ['Buff', 'Buff'], ['Health', 'Health'],
  ['Duration', 'Duration'], ['Range', 'Range'], ['Cooldown', 'Cooldown'], ['Cast', 'Cast'], ['Move', 'Movement'],
]

function toProp(p, key = p.Key) {
  const scaleStat = (p.Scale && SCALE_STATS[p.Scale.Type]) || null
  return {
    key,
    label: p.Name || t(`${key}_label`) || humanize(key),
    prefix: t(`${key}_prefix`) ?? '',
    postfix: t(`${key}_postfix`) ?? '',
    icon: typeIcons[p.Type] ?? null,
    base: num(p.Value),
    scale: scaleStat ? Number(p.Scale.Value) || 0 : 0,
    scaleStat,
  }
}

function toAbility(card, slot) {
  const props = {}
  const sections = []
  for (const ik of Object.keys(card).filter((k) => /^Info\d+$/.test(k)).sort()) {
    const info = card[ik]
    const descKey = info.DescKey ?? (ik === 'Info1' ? card.DescKey : undefined)
    const blocks = []
    for (const p of info.Main?.Props ?? []) {
      props[p.Key] ??= toProp(p)
      const title = p.Title ?? ''
      const last = blocks.at(-1)
      if (last && last.title === title) last.props.push(p.Key)
      else blocks.push({ title, props: [p.Key] })
    }
    const alt = (info.Alt ?? []).map((p) => ((props[p.Key] ??= toProp(p)), p.Key))
    if (alt.length) blocks.push({ title: '', props: alt })
    const baseValues = Object.fromEntries(Object.values(props).map((p) => [p.key, p.base]))
    let html = renderGameTextOrNull(t(descKey) ?? '', baseValues)
    if (html === null) {
      // Keep the description but drop the unfillable bits; the validator flags anything left over.
      gameTextIssues.push(`${card.Name}: description has unfillable placeholders`)
      html = renderGameText(fillPlaceholders(t(descKey) ?? '', baseValues))
    }
    sections.push({ html, blocks, requires: info.RequiresUpgradeIndex ?? null })
  }
  const header = Object.entries(card.Headers ?? {}).map(([k, p]) => ((props[k] ??= toProp(p, k)), k))

  // The wiki's "Show all" tab: every remaining named stat, grouped as the game groups them.
  const shown = new Set([...header, ...sections.flatMap((s) => s.blocks.flatMap((b) => b.props))])
  const extras = ABILITY_GROUPS.flatMap(([group, title]) => {
    const keys = Object.entries(card[group] ?? {})
      .filter(([k, p]) => p && p.Name && !shown.has(k))
      .map(([k, p]) => ((props[k] ??= toProp(p, k)), shown.add(k), k))
    return keys.length ? [{ title, props: keys }] : []
  })

  const upgrades = (card.Upgrades ?? []).slice(0, 3).map((u, i) => {
    const changes = Object.entries(u)
      .filter(([k]) => k !== 'DescKey')
      .map(([key, v]) => {
        props[key] ??= { ...toProp({ Key: key, Value: 0 }), hidden: true }
        return v && typeof v === 'object'
          ? { key, value: Number(v.Value) || 0, scale: Number(v.Scale?.Value) || 0 }
          : { key, value: Number(v) || 0, scale: 0 }
      })
    // Placeholders in an upgrade's text refer to that upgrade's own changes ("{s:AbilityCooldown}s Cooldown").
    let html = u.DescKey ? renderGameTextOrNull(t(u.DescKey), Object.fromEntries(changes.map((c) => [c.key, c.value]))) : ''
    if (html === null) {
      // Broken game text: show nothing rather than garbage; the site describes the stat changes instead.
      gameTextIssues.push(`${card.Name} tier ${i + 1}: unusable game text ${JSON.stringify(t(u.DescKey))} — showing its stat changes instead`)
      html = ''
    }
    return { cost: [1, 2, 5][i], html, changes }
  })

  return {
    slot,
    key: card.Key,
    name: card.Name,
    quip: decode(stripTags(t(`${card.Key}_quip`) ?? '')),
    icon: null,
    sections,
    header,
    extras,
    props,
    upgrades,
  }
}

// ---- Hero stats, labelled and ordered the way the wiki's infobox does it.
const attrMeta = Object.assign({}, ...Object.values(attributeData))
// The infobox lists "…Scale" names; the hero data stores those two stats as percentages.
const STAT_ALIASES = { CritDamageBonusScale: 'CritDamageBonusPercent', CritDamageReceivedScale: 'CritDamageReceivedPercent' }
// Movement stats the hero data carries but the infobox metadata doesn't label.
const EXTRA_STAT_META = {
  GroundDashDistanceInMeters: { label: 'Ground dash distance', unit: 'm' },
  AirDashDistanceInMeters: { label: 'Air dash distance', unit: 'm' },
  StaminaRegenPerSecond: { label: 'Stamina regen', unit: '/s' },
}
function statMeta(key, infoboxKey = key) {
  if (EXTRA_STAT_META[key]) return EXTRA_STAT_META[key]
  const meta = attrMeta[infoboxKey] ?? attrMeta[key] ?? {}
  return {
    label: t(meta.label) ?? t(`StatDesc_${key}`) ?? t(`${key}_label`) ?? dictionary[key]?.en ?? humanize(key),
    unit: (t(meta.postfix) ?? t(`StatDesc_${key}_postfix`) ?? t(`${key}_postfix`) ?? '').trim(),
  }
}
/** Effectiveness stats are stored as multipliers (1 = 100%); everything gets sensible precision. */
function statValue(key, value) {
  const v = /Effectiveness$/.test(key) ? value * 100 : value
  return Math.round(v * 1000) / 1000
}
function heroStatGroups(h) {
  const groups = statOrder.category_order.map((cat) => ({
    id: cat.toLowerCase(),
    title: cat,
    stats: statOrder[cat].attribute_order.flatMap((infoboxKey) => {
      const key = STAT_ALIASES[infoboxKey] ?? infoboxKey
      const value = h[key] ?? h.Weapon?.[key]
      return typeof value === 'number' && value !== 0 ? [{ key, value: statValue(key, value), ...statMeta(key, infoboxKey) }] : []
    }),
  }))
  const weapon = groups.find((g) => g.id === 'weapon')
  const w = h.Weapon ?? {}
  const wExtra = (k) => (typeof w[k] === 'number' && w[k] !== 0 ? [{ key: k, value: statValue(k, w[k]), ...statMeta(k) }] : [])
  weapon.stats.unshift(...wExtra('DPS'), ...wExtra('SustainedDPS'))
  weapon.stats.push(...wExtra('FalloffStartRange'), ...wExtra('FalloffEndRange'))
  if (w.BulletsPerShot > 1) weapon.stats.push(...wExtra('BulletsPerShot'))
  if (w.BulletsPerBurst > 1) weapon.stats.push(...wExtra('BulletsPerBurst'))
  const vitality = groups.find((g) => g.id === 'vitality')
  for (const k of ['GroundDashDistanceInMeters', 'AirDashDistanceInMeters', 'StaminaRegenPerSecond'])
    if (typeof h[k] === 'number' && h[k] !== 0 && !vitality.stats.some((s) => s.key === k)) vitality.stats.push({ key: k, value: statValue(k, h[k]), ...statMeta(k) })
  return groups.filter((g) => g.stats.length)
}
const perScale = (obj = {}) =>
  Object.entries(obj)
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .map(([key, value]) => ({ key, value, label: key === 'PowerIncreases' ? 'Power increases' : statMeta(key).label }))

// ---- Hero tags (game text). Three heroes use their old internal codenames.
const TAG_ALIASES = { hero_ghost: 'Geist', hero_forge: 'Engineer', hero_krill: 'Digger' }
const tagPrefixes = [...new Set(Object.keys(lang).filter((k) => /^Citadel_.+_HeroTag_\d$/.test(k)).map((k) => k.replace(/^Citadel_|_HeroTag_\d$/g, '')))]
function heroTags(key, name) {
  const code = key.replace(/^hero_/, '')
  const want = [TAG_ALIASES[key], name.replace(/[^A-Za-z]/g, ''), code].filter(Boolean).map((s) => s.toLowerCase())
  const prefix = tagPrefixes.find((p) => want.includes(p.toLowerCase()))
  return prefix ? [1, 2, 3].map((i) => t(`Citadel_${prefix}_HeroTag_${i}`)).filter(Boolean) : []
}

// ---- Glossary: definitions from the wiki's Status Effects page and damage-type pages.
const GLOSSARY = [
  // id, wiki section/page, words that refer to it in ability text
  ['Sleep', 'Sleep', ['sleep', 'sleeps', 'asleep', 'sleeping']],
  ['Stun', 'Stun', ['stun', 'stuns', 'stunned', 'stunning']],
  ['Silence', 'Silence', ['silence', 'silences', 'silenced', 'silencing']],
  ['Immobilize', 'Immobilized', ['immobilize', 'immobilizes', 'immobilized', 'immobilizing', 'root', 'rooted']],
  ['Disarm', 'Disarm', ['disarm', 'disarms', 'disarmed', 'disarming']],
  ['Displace', 'Displace', ['knockup', 'knock up', 'knocks up', 'knocked up', 'knockback', 'knocks back', 'knocked back', 'pull', 'pulls', 'pulling', 'pulled', 'displace', 'displaced', 'displacement']],
  ['Slow', 'Movement Slow', ['slow', 'slows', 'slowed', 'slowing', 'movement slow']],
  ['MovementSilence', 'Movement Silence', ['movement silence', 'movement silenced']],
  ['Unstoppable', 'Unstoppable', ['unstoppable']],
  ['Stealth', 'Stealth', ['invisible', 'invisibility', 'stealth', 'stealthed']],
  ['Barrier', 'Barrier', ['barrier', 'combat barrier']],
  ['Bleed', 'Bleed', ['bleed', 'bleeds', 'bleeding']],
  ['Burn', 'Burn', ['burn', 'burns', 'burning']],
  ['Curse', 'Curse', ['curse', 'curses', 'cursed']],
  ['Tether', 'Tether', ['tether', 'tethers', 'tethered']],
  ['Petrified', 'Petrified', ['petrify', 'petrifies', 'petrified']],
  ['TimeStop', 'Time Stop', ['time stop', 'time slow', 'slow motion']],
  ['HealingReduction', 'Healing Reduction', ['healing reduction', 'reduced healing']],
  ['Invincibility', 'Invincibility', ['invincible', 'invincibility']],
  ['Lifesteal', 'Lifesteal', ['lifesteal']],
  ['SpiritDamage', 'page:Spirit Damage', ['spirit damage']],
  ['WeaponDamage', 'page:Weapon Damage', ['weapon damage', 'bullet damage']],
  ['PureDamage', 'page:Pure Damage', ['pure damage']],
  ['MeleeDamage', 'page:Melee', ['melee damage']],
  ['SpiritPower', 'page:Spirit Power', ['spirit power']],
]
// Inline attributes that share a glossary entry.
const ATTR_TERMS = {
  Sleep: 'Sleep', Stun: 'Stun', Silence: 'Silence', Immobilize: 'Immobilize', KnockUp: 'Displace', KnockBack: 'Displace',
  Pull: 'Displace', Pulls: 'Displace', Pulling: 'Displace', Slow: 'Slow', CombatBarrier: 'Barrier', SpiritDamage: 'SpiritDamage',
  SpiritDPS: 'SpiritDamage', BonusSpiritDamage: 'SpiritDamage', WeaponDamage: 'WeaponDamage', BonusWeaponDamage: 'WeaponDamage',
  BulletDamage: 'WeaponDamage', PureDamage: 'PureDamage', MeleeDamage: 'MeleeDamage', Spirit: 'SpiritPower',
}
function sectionText(page, heading) {
  const m = page.match(
    new RegExp(String.raw`\n==+[ \t]*` + heading.replace(/_/g, ' ') + String.raw`[ \t]*==+[ \t]*\r?\n([\s\S]*?)(?=\r?\n==|$)`),
  )
  if (!m) return ''
  return firstParagraph(m[1])
}
/**
 * First prose paragraph of some wikitext (prose often wraps across lines). Skips templates, images,
 * lists, tables and bare labels like '''Sources:''' — but keeps '''Term''' is … sentences.
 */
function firstParagraph(wikitext) {
  const skipLine = /^(\{\{(?!plink)|\[\[File|__|=|\*|#|:|\||!|<|\{\||''See|'''[^']*:'''\s*$)/i
  // A prose paragraph can start right under an infobox/template line; drop such leading lines.
  const paras = wikitext.split(/\r?\n\s*\r?\n/).map((p) => {
    const lines = p.trim().split(/\r?\n/)
    while (lines.length && skipLine.test(lines[0].trim())) lines.shift()
    return lines.join('\n').trim()
  })
  const para = paras.find(
    (p) => p && !/^(\{\{(?!plink)|\[\[File|__|=|\*|#|:|\||!|<|\{\||''See|'''[^']*:'''\s*$)/i.test(p) && /[a-z]{3}/.test(p),
  )
  if (!para) return ''
  // Stop at the first list, table, label or template line inside the paragraph.
  const lines = []
  for (const line of para.split(/\r?\n/)) {
    if (lines.length && /^(\*|#|:|\||!|\{\||'''[^']*:'''|\{\{(?!plink)|\[\[File)/i.test(line.trim())) break
    lines.push(line)
  }
  return wikiToText(lines.join(' '))
}
async function pageLead(title, hops = 0) {
  const text = await wikiRaw(title).catch(() => '')
  // Follow "#REDIRECT [[Page#Section]]" to the section it points at.
  const redirect = text.match(/^#REDIRECT\s*\[\[([^\]#|]+)(?:#([^\]|]+))?/i)
  if (redirect && hops < 2) {
    if (redirect[2]) {
      const target = await wikiRaw(redirect[1]).catch(() => '')
      const section = sectionText(target, redirect[2])
      if (section) return section
    }
    return pageLead(redirect[1], hops + 1)
  }
  const para = text.split('\n').find((l) => l.trim() && !/^(\{\{|\[\[File|''See|__|=|\||!|<|#)/.test(l.trim()) && /[a-z]{3}/.test(l))
  return para ? wikiToText(para) : ''
}
const glossary = {}
for (const [id, source, words] of GLOSSARY) {
  const isPage = source.startsWith('page:')
  const title = isPage ? source.slice(5) : source
  const definition = isPage ? await pageLead(title) : sectionText(statusPage, title)
  if (!definition) {
    console.warn(`  glossary: no definition found for ${id}`)
    continue
  }
  glossary[id] = {
    title: title.replace(/^Movement Slow$/, 'Slow'),
    definition,
    source: `${WIKI}/${isPage ? pagePath(title) : `Status_Effects#${pagePath(title)}`}`,
    words,
  }
  if (isPage) await sleep(200)
}

// ---- Stat definitions for the Stats section. In order of preference: the game's own stat
// description, then the wiki page/section for that stat, then (for numbers the wiki derives
// rather than defines) a plain description checked against the data, with its source.
const STAT_DEFINITIONS = {
  DPS: { text: 'Damage per second while firing continuously, before any reload: bullet damage × bullets per second.', page: 'Damage per second' },
  SustainedDPS: { text: 'Damage per second over full cycles of emptying the magazine and reloading, so reload time is counted.', page: 'Damage per second' },
  BulletDamage: { page: 'Weapon Damage', section: 'Base Bullet Damage' },
  BulletDamageAltFire: { text: "Bullet damage of the weapon's alternate fire, used with the Zoom / alt-fire key.", page: 'Ammo', section: 'Alternate fire' },
  RoundsPerSecond: { page: 'Fire Rate', sentences: 1 },
  FireRate: { lang: 'StatDesc_FireRateDesc' },
  ClipSize: { lang: 'StatDesc_AmmoDesc' },
  ReloadTime: { page: 'Reload Time' },
  BulletSpeed: { page: 'Bullet Velocity' },
  LightMeleeDamage: { text: 'Damage of a Light Melee: a quick strike made by pressing the melee key.', page: 'Heavy Melee' },
  HeavyMeleeDamage: { text: 'Damage of a Heavy Melee: hold the melee key to wind up a slower, stronger punch.', page: 'Heavy Melee' },
  FalloffStartRange: { text: 'Bullets deal full damage up to this distance. Beyond it, damage drops linearly until the falloff end range.', page: 'Falloff Range' },
  FalloffEndRange: { text: 'At this distance and beyond, bullets deal their minimum damage — for most heroes 90% less than full damage.', page: 'Falloff Range' },
  BulletsPerShot: { page: 'Weapon Damage', section: 'Spreadshots' },
  BulletsPerBurst: { page: 'Ammo', section: 'Burst fire' },
  BonusAttackRange: { text: "Bebop's weapon has a separate Max Range stat that increases with Boons, and deals no damage beyond its max range.", page: 'Falloff Range' },
  MaxHealth: { page: 'Health', sentences: 1 },
  BaseHealthRegen: { lang: 'StatDesc_RegenDesc' },
  HeroSpiritLifestealEffectiveness: { page: 'Lifesteal', section: 'Lifesteal Effectiveness' },
  BulletLifesteal: { lang: 'StatDesc_WeaponLifestealDesc' },
  MaxMoveSpeed: { page: 'Move Speed' },
  SprintSpeed: { page: 'Move Speed', section: 'Sprint Speed' },
  Stamina: { text: 'Stamina dictates the amount of dashes a hero can use. It regenerates over time, one bar at a time.', page: 'Stamina' },
  StaminaCooldown: { page: 'Stamina', section: 'Cooldown' },
  StaminaRegenPerSecond: { text: 'How many stamina bars recover per second — the inverse of Stamina Cooldown.', page: 'Stamina' },
  GroundDashDistanceInMeters: { text: 'How far one dash carries the hero along the ground.', page: 'Dashing' },
  AirDashDistanceInMeters: { text: 'How far one dash carries the hero while airborne.', page: 'Dashing' },
  // Crit multiplier = 1 + (0.65 + Crit Bonus Scale) × crit resist (wiki formula), so −20% → 1.45×.
  CritDamageBonusPercent: { text: 'Headshots normally deal 1.65× bullet damage. This stat changes the bonus part: for example, −20% means headshots deal 1.45×.', page: 'Weapon Damage', section: 'Crit Multiplier' },
  CritDamageReceivedPercent: { page: 'Damage Resistance', section: 'Crit Reduction' },
  BulletResist: { lang: 'StatDesc_WeaponResistDesc' },
  TechResist: { lang: 'StatDesc_SpiritResistDesc' },
  MeleeResist: { page: 'Damage Resistance', section: 'Melee Resist' },
  DebuffResist: { page: 'Debuff Resist' },
  TechPower: { lang: 'CitadelHeroStats_SpiritPower_Desc' },
  PowerIncreases: { page: 'Boon', sentences: 2 },

  // Ability header stats (shown on every ability card).
  AbilityCooldown: { page: 'Ability Cooldown', sentences: 1 },
  AbilityCharges: { page: 'Charges', sentences: 2 },
  AbilityCooldownBetweenCharge: { text: 'For abilities with charges: the wait between using one charge and the next. Restoring a used charge takes the regular cooldown.', page: 'Abilities' },
  AbilityChannelTime: { text: 'How long the ability is channeled — held while a bar drains on your HUD. You can stop the channel early; the ability goes on cooldown from the first press.', page: 'Abilities' },
  // No wiki page explains cast delay, so this is a plain description and shows no source link.
  AbilityCastDelay: { text: 'The short wind-up between pressing the ability and it taking effect.', noSource: true },
  AbilityCastRange: { text: 'How far away the ability can be aimed or placed. Ability Range items increase it.', page: 'Ability Range' },
  AbilityDuration: { page: 'Ability Duration', sentences: 1 },
  Radius: { text: 'The size of the area the ability affects. Ability Range items increase it.', page: 'Ability Range' },
}
/** Capitalised and ending in a full stop. */
const sentenceCase = (s) => s.trim().replace(/^./, (c) => c.toUpperCase()).replace(/([^.!?])$/, '$1.')
const firstSentences =(text, n = 2) => (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).slice(0, n).join('').trim()
async function statDefinition(key) {
  const d = STAT_DEFINITIONS[key]
  if (!d) return null
  const source = d.noSource ? '' : d.page ? `${WIKI}/${pagePath(d.page)}${d.section ? '#' + pagePath(d.section) : ''}` : `${WIKI}/Data:Lang_en.json`
  if (d.text) return { text: sentenceCase(d.text), source }
  if (d.lang) {
    // Game strings look like "<b>Ammo</b> - The number of shots…": keep the explanation.
    const raw = decode(stripTags(t(d.lang) ?? '')).replace(/^[^-–]{1,40}\s[-–]\s/, '').trim()
    return raw ? { text: sentenceCase(raw), source: 'Deadlock game text' } : null
  }
  const page = await wikiRaw(d.page).catch(() => '')
  let text = d.section ? sectionText(page, d.section) : ''
  if (!text && (!d.section || d.fallbackLead)) text = firstParagraph(page)
  return text ? { text: sentenceCase(firstSentences(text, d.sentences ?? 2)), source } : null
}

// ---- Heroes
/**
 * The gloat portrait the hero's own wiki page shows. Its file name is irregular — "Ivy_Gloat_.png",
 * "Doorman_Gloat.png", "Rem_Gloat_(Familiar).png", "Silver_Gloat_Portrait.png", "Baba_gloat.png" —
 * so ask the page instead of guessing. Prefer files named after the hero (Silver's page also shows
 * her werewolf form's "Werewolf_Silver_Gloat.png").
 */
async function pageGloatFile(name) {
  const j = await get(`${WIKI}/api.php?action=parse&page=${encodeURIComponent(name)}&prop=images&format=json&formatversion=2`).catch(() => null)
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '')
  const hero = norm(name.replace(/^The /, ''))
  const gloats = (j?.parse?.images ?? []).filter((f) => /gloat/i.test(f))
  return gloats.find((f) => norm(f).startsWith(hero)) ?? null
}

const fileNames = released.flatMap(({ name }) => {
  const n = name.replace(/ /g, '_')
  return [`${n}_Render.png`, `${n}_card.png`, `${n}_Gloat.png`, `${n}_name.svg`]
})
const available = await existingFiles(fileNames)

const heroes = []
for (const { name, releaseDate } of released) {
  const key = heroKeyByName.get(name)
  const h = heroData[key]
  const slug = slugify(name)
  const n = name.replace(/ /g, '_')
  process.stdout.write(`  ${name.padEnd(16)}`)

  const art = async (file, rel, opts) => (available.has(file) ? saveFile(file, rel, opts).catch((e) => (console.warn(`\n    ${file}: ${e.message}`), null)) : null)
  const images = {
    render: await art(`${n}_Render.png`, `heroes/${slug}/render.webp`, { width: 1600, quality: 80 }),
    card: await art(`${n}_card.png`, `heroes/${slug}/card.webp`, { width: 560 }),
    gloat: await (async () => {
      const file = (await pageGloatFile(name)) ?? (available.has(`${n}_Gloat.png`) ? `${n}_Gloat.png` : null)
      if (!file) return null
      return saveFile(file, `heroes/${slug}/gloat.webp`, { width: 560 }).catch((e) => (console.warn(`\n    ${file}: ${e.message}`), null))
    })(),
    name: await art(`${n}_name.svg`, `heroes/${slug}/name.svg`),
  }

  const loreHtml = t(h.Lore) ?? ''
  const japanese = hasCJK(loreHtml)
  let loreTranslation = null
  if (japanese) {
    const tr = lorePageParagraphs(await wikiRaw(`${name}/Lore`).catch(() => ''))
    if (tr.length) loreTranslation = { paragraphs: tr, source: `${WIKI}/${pagePath(`${name}/Lore`)}` }
  }

  const abilities = ['1', '2', '3', '4'].map((s) => abilityCards[key][s]).filter(Boolean).map((c, i) => toAbility(c, i + 1))
  for (const a of abilities) a.icon = await saveFile(`${a.name.replace(/ /g, '_')}.png`, `abilities/${a.key}.webp`, { width: 128 }).catch(() => null)

  heroes.push({
    key,
    slug,
    name,
    releaseDate,
    accent: images.render ? await accentFrom(images.render.slice(1)) : '#d9b36c',
    tags: heroTags(key, name),
    role: decode(stripTags(t(h.Role) ?? '')),
    playstyle: decode(stripTags(t(h.Playstyle) ?? '')),
    lore: paragraphs(loreHtml, japanese),
    loreLang: japanese ? 'ja' : 'en',
    loreTranslation,
    weapon: {
      name: t(h.Weapon?.NameKey) ?? '',
      types: (h.Weapon?.WeaponTypes ?? []).map((w) => t(w) ?? humanize(w.replace(/^Attribute_EWeaponAttribute_/, ''))),
      canCrit: h.Weapon?.CanCrit !== false,
    },
    statGroups: heroStatGroups(h),
    levelScaling: perScale(h.LevelScaling),
    spiritScaling: perScale(h.SpiritScaling),
    images,
    abilities,
  })
  console.log('✓')
}

heroes.sort((a, b) => a.name.localeCompare(b.name))

// Every stat the Stats section shows gets a definition.
const statKeys = new Set(heroes.flatMap((h) => [...h.statGroups.flatMap((g) => g.stats), ...h.levelScaling, ...h.spiritScaling].map((s) => s.key)))
// Plus the shared ability stats (cooldown, cast delay, channel duration, …) that appear on ability cards.
for (const h of heroes) for (const a of h.abilities) for (const k of Object.keys(a.props)) if (STAT_DEFINITIONS[k]?.page || STAT_DEFINITIONS[k]?.text) statKeys.add(k)
const statDefinitions = {}
for (const key of statKeys) {
  const def = await statDefinition(key)
  if (def) statDefinitions[key] = def
  else console.warn(`  no definition for stat ${key}`)
}
await mkdir(out('data'), { recursive: true })
await writeFile(
  out('data/roster.json'),
  JSON.stringify({ patch, generatedAt: new Date().toISOString(), glossary, attrTerms: ATTR_TERMS, statDefinitions, heroes }),
)
for (const old of ['data/heroes.json', 'data/abilities.json', 'renders']) await rm(out(old), { recursive: true, force: true })

if (gameTextIssues.length) console.warn(`\n${gameTextIssues.length} game-text issue(s) handled:\n  ${gameTextIssues.join('\n  ')}`)
console.log(`\nSaved ${heroes.length} heroes (${heroes.reduce((n, h) => n + h.abilities.length, 0)} abilities), ${Object.keys(glossary).length} glossary terms, patch ${patch}.`)
