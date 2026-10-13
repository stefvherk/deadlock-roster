import type { Ability, AbilityProp, Tier } from '../data/types'

export interface PropValue {
  value: number
  scale: number
}

/** Every stat's base value and scaling with the first `tier` upgrades applied (upgrades add to both). */
export function valuesAtTier(ability: Ability, tier: Tier): Record<string, PropValue> {
  const out: Record<string, PropValue> = {}
  for (const p of Object.values(ability.props)) out[p.key] = { value: p.base, scale: p.scale }
  for (const upgrade of ability.upgrades.slice(0, tier)) {
    for (const { key, value, scale } of upgrade.changes) {
      const v = (out[key] ??= { value: 0, scale: 0 })
      v.value += value
      v.scale += scale
    }
  }
  return out
}

/** The first tier at which a stat has a value, or null if it never does. */
export function unlockTier(ability: Ability, key: string): Tier | null {
  for (let t = 0 as Tier; t <= 3; t = (t + 1) as Tier) {
    const v = valuesAtTier(ability, t)[key]
    if (v && (v.value || v.scale)) return t
  }
  return null
}

export const round = (n: number) => String(Math.round(n * 100) / 100)

/**
 * The game uses 9999s to mean "no time limit" (e.g. the channel on Apollo's ultimate, Grey Talon's
 * Charged Shot and Celeste's Shining Wonder, which you hold until you release). Never show it as a number.
 */
export const NO_LIMIT_SECONDS = 9999
export const isNoLimit = (prop: Pick<AbilityProp, 'postfix'>, value: number) => prop.postfix.trim() === 's' && Math.abs(value) >= NO_LIMIT_SECONDS

/** Formats a value the way the game does: "+15%", "−28%", "20m", "6s". */
export function formatProp(prop: AbilityProp, value: number) {
  if (isNoLimit(prop, value)) return 'No limit'
  let sign = ''
  if (prop.prefix.includes('{s:sign}')) sign = value > 0 ? '+' : value < 0 ? '−' : ''
  else if (prop.prefix.trim() === '-') sign = value > 0 ? '−' : ''
  else if (value < 0) sign = '−'
  return `${sign}${round(Math.abs(value))}${prop.postfix}`
}

/** Plain-language lines for an upgrade's stat changes (used only when the game provides no wording). */
export function describeChanges(ability: Ability, tierIndex: number): string[] {
  const lines = ability.upgrades[tierIndex].changes.flatMap(({ key, value, scale }) => {
    const prop = ability.props[key]
    const label = prop?.label ?? key
    const out: string[] = []
    if (value) out.push(`${value > 0 ? '+' : '−'}${round(Math.abs(value))}${prop?.postfix ?? ''} ${label}`)
    if (scale) out.push(`${scale > 0 ? '+' : '−'}${round(Math.abs(scale))} ${prop?.scaleStat ?? 'spirit'} scaling on ${label}`)
    return out
  })
  return [...new Set(lines)]
}
