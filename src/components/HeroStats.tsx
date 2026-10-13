import { useRef } from 'react'
import type { Hero } from '../data/types'
import { gsap, prefersReducedMotion, useGSAP } from '../lib/gsap'

const fmt = (v: number) => {
  const n = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100
  return String(n)
}
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`

/** A stat name that shows its definition on hover, focus or tap (see GlossaryTip). */
function StatTerm({ statKey, label }: { statKey: string; label: string }) {
  return (
    <span className="term" data-term={`stat:${statKey}`} data-term-title={label} tabIndex={0}>
      {label}
    </span>
  )
}

/**
 * Every stat the game gives this hero, grouped like the in-game hero sheet.
 * Bars show where the hero sits between the lowest and highest value on the roster.
 */
export function HeroStats({ hero }: { hero: Hero }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const fills = gsap.utils.toArray<HTMLElement>('.stat__fill', rootRef.current)
      if (prefersReducedMotion()) return
      gsap.fromTo(
        fills,
        { scaleX: 0 },
        {
          scaleX: (_, el: HTMLElement) => Number(el.dataset.ratio),
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.02,
          scrollTrigger: { trigger: rootRef.current, start: 'top 80%', toggleActions: 'play none none none' },
        },
      )
    },
    { scope: rootRef, dependencies: [hero.slug] },
  )

  return (
    <div ref={rootRef} className="hero-stats">
      {hero.statGroups.map((group) => (
        <section key={group.id} className={`stat-group stat-group--${group.id}`} aria-labelledby={`stats-${group.id}`}>
          <header className="stat-group__head">
            <h3 id={`stats-${group.id}`}>{group.title}</h3>
            {group.id === 'weapon' && hero.weapon.name && (
              <p className="stat-group__weapon">
                <span>{hero.weapon.name}</span>
                {hero.weapon.types.length > 0 && <small>{hero.weapon.types.join(', ')}</small>}
              </p>
            )}
          </header>
          <ul className="stats">
            {group.stats.map((s) => (
              <li key={s.key} className="stat">
                <span className="stat__label">
                  <StatTerm statKey={s.key} label={s.label} />
                </span>
                <span className="stat__value">
                  {fmt(s.value)}
                  {s.unit && <small>{s.unit}</small>}
                </span>
                <span className="stat__track" aria-hidden="true">
                  <span className="stat__fill" data-ratio={s.ratio} style={{ transform: `scaleX(${s.ratio})` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {(hero.levelScaling.length > 0 || hero.spiritScaling.length > 0) && (
        <section className="stat-group stat-group--scaling" aria-labelledby="stats-scaling">
          <header className="stat-group__head">
            <h3 id="stats-scaling">Growth</h3>
          </header>
          {hero.levelScaling.length > 0 && (
            <dl className="scaling">
              <dt>Every boon (level-up)</dt>
              {hero.levelScaling.map((s) => (
                <dd key={s.key}>
                  <b>{signed(s.value)}</b> <StatTerm statKey={s.key} label={s.label} />
                </dd>
              ))}
            </dl>
          )}
          {hero.spiritScaling.length > 0 && (
            <dl className="scaling">
              <dt>Every point of Spirit Power</dt>
              {hero.spiritScaling.map((s) => (
                <dd key={s.key}>
                  <b>{signed(s.value)}</b> <StatTerm statKey={s.key} label={s.label} />
                </dd>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  )
}
