import { useId, useMemo, useState } from 'react'
import type { Ability, AbilityBlock, AbilityProp, Tier } from '../data/types'
import { describeChanges, formatProp, round, unlockTier, valuesAtTier, type PropValue } from '../lib/abilityMath'
import { StatTerm } from './StatTerm'

const TIER_NAMES = ['Base', 'I', 'II', 'III'] as const
const TIER_COSTS = [1, 2, 5] as const

/* ---------- Tier picker (also used for the "all abilities" control) ---------- */

export function TierPicker({ value, onChange, label }: { value: Tier | null; onChange: (t: Tier) => void; label: string }) {
  return (
    <div className="tier-picker" role="radiogroup" aria-label={label}>
      {TIER_NAMES.map((name, i) => (
        <button key={name} role="radio" aria-checked={value === i} className="tier-picker__opt" onClick={() => onChange(i as Tier)}>
          <span>{name}</span>
          {i > 0 && <small>{TIER_COSTS[i - 1]} AP</small>}
        </button>
      ))}
      <span className="tier-picker__thumb" style={{ '--i': value ?? -1 } as React.CSSProperties} aria-hidden="true" />
    </div>
  )
}

/* ---------- One stat row ---------- */

function PropRow({ prop, now, base, lockedUntil }: { prop: AbilityProp; now: PropValue; base: PropValue; lockedUntil: Tier | null }) {
  const changed = now.value !== base.value || now.scale !== base.scale
  const text = formatProp(prop, now.value)
  return (
    <li className={`prop${changed ? ' is-changed' : ''}${lockedUntil ? ' is-locked' : ''}`}>
      {prop.icon ? <img className="prop__icon" src={prop.icon} alt="" loading="lazy" /> : <i className="prop__icon prop__icon--dot" />}
      <span className="prop__label">
        <StatTerm statKey={prop.key} label={prop.label} />
      </span>
      {lockedUntil ? (
        <span className="prop__lock">Unlocks at {TIER_NAMES[lockedUntil]}</span>
      ) : (
        <span className="prop__value">
          {now.scale > 0 && (
            <span
              className={`prop__scale prop__scale--${prop.scaleStat}`}
              title={`Increases by ${round(now.scale)} for every point of ${prop.scaleStat === 'spirit' ? 'Spirit Power' : prop.scaleStat === 'melee' ? 'melee damage' : 'Weapon Damage'}`}
            >
              ×{round(now.scale)}
            </span>
          )}
          {(now.value !== 0 || !now.scale) && <b key={text}>{text}</b>}
        </span>
      )}
    </li>
  )
}

/* ---------- Card ---------- */

export function AbilityCard({ ability, tier, onTier }: { ability: Ability; tier: Tier; onTier: (t: Tier) => void }) {
  const [showAll, setShowAll] = useState(false)
  const allId = useId()
  const base = useMemo(() => valuesAtTier(ability, 0), [ability])
  const vals = useMemo(() => valuesAtTier(ability, tier), [ability, tier])
  const unlocks = useMemo(() => Object.fromEntries(Object.keys(ability.props).map((k) => [k, unlockTier(ability, k)])), [ability])
  const zero = { value: 0, scale: 0 }

  const header = ability.header.filter((k) => {
    const v = vals[k]?.value ?? 0
    if (k === 'AbilityCharges') return v > 1
    if (k === 'AbilityCooldownBetweenCharge') return (vals.AbilityCharges?.value ?? 0) > 1 && v > 0
    return v > 0
  })

  const rows = (block: AbilityBlock) =>
    block.props.flatMap((key) => {
      const prop = ability.props[key]
      if (!prop || prop.hidden) return []
      const unlock = unlocks[key]
      if (unlock === null) return []
      return [<PropRow key={key} prop={prop} now={vals[key] ?? zero} base={base[key] ?? zero} lockedUntil={unlock > tier ? unlock : null} />]
    })

  const extraCount = ability.extras.reduce((n, b) => n + rows(b).length, 0)

  return (
    <article className="ability">
      <header className="ability__head">
        <span className="ability__slot" title={`Ability ${ability.slot}`}>
          {ability.slot}
        </span>
        <div className="ability__icon">{ability.icon && <img src={ability.icon} alt="" loading="lazy" />}</div>
        <div className="ability__titles">
          <h3 className="ability__name">{ability.name}</h3>
          {ability.quip && <p className="ability__quip">{ability.quip}</p>}
        </div>
      </header>

      <TierPicker value={tier} onChange={onTier} label={`${ability.name} upgrade tier`} />

      {header.length > 0 && (
        <ul className="ability__header-stats">
          {header.map((k) => {
            const prop = ability.props[k]
            const v = vals[k].value
            const text = formatProp(prop, v)
            return (
              <li key={k} className={v !== base[k]?.value ? 'is-changed' : ''}>
                {prop.icon && <img src={prop.icon} alt="" loading="lazy" />}
                <b key={text}>{text}</b>
                <span>
                  <StatTerm statKey={k} label={prop.label} />
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {ability.sections.map((section, i) => {
        const locked = section.requires !== null && tier <= section.requires
        const blocks = section.blocks.map((b) => ({ b, r: rows(b) })).filter(({ r }) => r.length)
        if (!section.html && !blocks.length) return null
        return (
          <div key={i} className={`ability__section${locked ? ' is-locked' : ''}`}>
            {locked && <p className="ability__unlock">Unlocks at {TIER_NAMES[section.requires! + 1]}</p>}
            {section.html && <div className="rich" dangerouslySetInnerHTML={{ __html: section.html }} />}
            {blocks.map(({ b, r }, j) => (
              <div key={j} className="ability__block">
                {b.title && <h4>{b.title}</h4>}
                <ul className="props">{r}</ul>
              </div>
            ))}
          </div>
        )
      })}

      {extraCount > 0 && (
        <div className="ability__all">
          <button className="ability__toggle" aria-expanded={showAll} aria-controls={allId} onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Hide' : 'Show'} all stats <span>({extraCount})</span>
            <i aria-hidden="true" />
          </button>
          {showAll && (
            <div id={allId} className="ability__all-panel">
              {ability.extras.map((b) => {
                const r = rows(b)
                return r.length ? (
                  <div key={b.title} className="ability__block">
                    <h4>{b.title}</h4>
                    <ul className="props">{r}</ul>
                  </div>
                ) : null
              })}
            </div>
          )}
        </div>
      )}

      {ability.upgrades.length > 0 && (
        <ol className="upgrades" aria-label="Upgrades">
          {ability.upgrades.map((u, i) => {
            const unlocked = tier > i
            return (
              <li key={i}>
                <button
                  className={`upgrade${unlocked ? ' is-unlocked' : ''}`}
                  onClick={() => onTier((tier === i + 1 ? i : i + 1) as Tier)}
                  aria-pressed={unlocked}
                >
                  <span className="upgrade__cost">
                    <b>{TIER_NAMES[i + 1]}</b>
                    <small>{u.cost} AP</small>
                  </span>
                  {u.html ? (
                    <span className="upgrade__text rich" dangerouslySetInnerHTML={{ __html: u.html }} />
                  ) : (
                    <span className="upgrade__text">
                      {describeChanges(ability, i).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </article>
  )
}
