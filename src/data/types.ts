/** 0 = base ability, 1–3 = upgrade tiers unlocked. */
export type Tier = 0 | 1 | 2 | 3

export type ScaleStat = 'spirit' | 'weapon' | 'melee' | null

export interface AbilityProp {
  key: string
  label: string
  prefix: string
  postfix: string
  icon: string | null
  base: number
  scale: number
  scaleStat: ScaleStat
  /** Only exists through an upgrade; not shown in stat lists. */
  hidden?: boolean
}

export interface AbilityUpgrade {
  cost: number
  /** The game's own wording; empty when the upgrade is a plain stat change. */
  html: string
  changes: { key: string; value: number; scale: number }[]
}

export interface AbilityBlock {
  title: string
  props: string[]
}

export interface AbilitySection {
  html: string
  blocks: AbilityBlock[]
  /** Upgrade index (0-based) that must be unlocked before this part of the ability exists. */
  requires: number | null
}

export interface Ability {
  slot: number
  key: string
  name: string
  icon: string | null
  quip: string
  /** The in-game tooltip: text paragraphs with their stat blocks. */
  sections: AbilitySection[]
  /** Cooldown, range, charges… */
  header: string[]
  /** Every other named stat (the wiki's "Show all"). */
  extras: AbilityBlock[]
  props: Record<string, AbilityProp>
  upgrades: AbilityUpgrade[]
}

export interface HeroStat {
  key: string
  label: string
  value: number
  unit: string
  /** 0..1 relative to the rest of the roster */
  ratio: number
}

export interface StatGroup {
  id: string
  title: string
  stats: HeroStat[]
}

export interface ScalingStat {
  key: string
  label: string
  value: number
}

export interface Hero {
  key: string
  slug: string
  name: string
  releaseDate: string
  accent: string
  accentRgb: [number, number, number]
  tags: string[]
  role: string
  playstyle: string
  lore: string[]
  loreLang: string
  loreTranslation: { paragraphs: string[]; source: string } | null
  weapon: { name: string; types: string[]; canCrit: boolean }
  statGroups: StatGroup[]
  levelScaling: ScalingStat[]
  spiritScaling: ScalingStat[]
  images: { render: string | null; card: string | null; gloat: string | null; name: string | null }
  abilities: Ability[]
}

export interface GlossaryEntry {
  title: string
  definition: string
  source: string
  words: string[]
}

export interface StatDefinition {
  text: string
  /** A wiki URL, or "Deadlock game text" when the game itself describes the stat. */
  source: string
}

export interface Roster {
  patch: string
  heroes: Hero[]
  glossary: Record<string, GlossaryEntry>
  attrTerms: Record<string, string>
  statDefinitions: Record<string, StatDefinition>
}
