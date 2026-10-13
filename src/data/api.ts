import { sanitizeGameHtml, type TermMatcher } from '../lib/sanitize'
import type { GlossaryEntry, Hero, Roster, StatDefinition } from './types'

/**
 * All game data is a static snapshot built from the Deadlock Wiki's game-data exports
 * (see scripts/snapshot.mjs). Nothing is fetched from third parties at runtime.
 */
const ROSTER_URL = `${import.meta.env.BASE_URL}data/roster.json`

type RawHero = Omit<Hero, 'accentRgb' | 'statGroups'> & {
  statGroups: { id: string; title: string; stats: { key: string; label: string; value: number; unit: string }[] }[]
}
interface RawRoster {
  patch: string
  glossary: Record<string, GlossaryEntry>
  attrTerms: Record<string, string>
  statDefinitions: Record<string, StatDefinition>
  heroes: RawHero[]
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [217, 179, 108]
}

/** Builds a matcher that finds glossary terms in ability text (inline attributes and highlighted words). */
function termMatcher(raw: RawRoster): TermMatcher {
  const byWord = new Map<string, string>()
  for (const [id, entry] of Object.entries(raw.glossary)) for (const w of entry.words) byWord.set(w.toLowerCase(), id)
  return {
    attr: (name) => (raw.glossary[raw.attrTerms[name]] ? raw.attrTerms[name] : null),
    word: (text) => byWord.get(text.trim().toLowerCase()) ?? null,
  }
}

export async function loadRoster(): Promise<Roster> {
  const res = await fetch(ROSTER_URL)
  if (!res.ok) throw new Error(`Couldn't load hero data (HTTP ${res.status}).`)
  const raw = (await res.json()) as RawRoster
  const terms = termMatcher(raw)
  // Asset paths in the data are site-root paths ("/heroes/…"); the site may live under a base path
  // (GitHub Pages serves it from /<repo>/), so resolve them against BASE_URL.
  const BASE = import.meta.env.BASE_URL
  const asset = <T extends string | null>(p: T): T => (p && p.startsWith('/') ? (BASE + p.slice(1)) as T : p)
  const rebase = (html: string) => html.replace(/src="\//g, `src="${BASE}`)
  const clean = (html: string) => sanitizeGameHtml(rebase(html), terms)

  // Each stat bar reads relative to the rest of the roster.
  const ranges = new Map<string, { min: number; max: number }>()
  for (const h of raw.heroes)
    for (const g of h.statGroups)
      for (const s of g.stats) {
        const r = ranges.get(s.key) ?? { min: Infinity, max: -Infinity }
        ranges.set(s.key, { min: Math.min(r.min, s.value), max: Math.max(r.max, s.value) })
      }

  const heroes: Hero[] = raw.heroes.map((h) => ({
    ...h,
    accentRgb: hexToRgb(h.accent),
    images: { render: asset(h.images.render), card: asset(h.images.card), gloat: asset(h.images.gloat), name: asset(h.images.name) },
    statGroups: h.statGroups.map((g) => ({
      ...g,
      stats: g.stats.map((s) => {
        const { min, max } = ranges.get(s.key)!
        return { ...s, ratio: max === min ? 1 : 0.12 + 0.88 * ((s.value - min) / (max - min)) }
      }),
    })),
    abilities: h.abilities.map((a) => ({
      ...a,
      icon: asset(a.icon),
      props: Object.fromEntries(Object.entries(a.props).map(([k, p]) => [k, { ...p, icon: asset(p.icon) }])),
      sections: a.sections.map((s) => ({ ...s, html: clean(s.html) })),
      // Upgrade text sits inside buttons, so no nested glossary terms there.
      upgrades: a.upgrades.map((u) => ({ ...u, html: sanitizeGameHtml(rebase(u.html)) })),
    })),
  }))

  return { patch: raw.patch, glossary: raw.glossary, attrTerms: raw.attrTerms, statDefinitions: raw.statDefinitions, heroes }
}
