import { useRef } from 'react'
import type { Hero } from '../data/types'
import { gsap, prefersReducedMotion, SplitText, useGSAP } from '../lib/gsap'

export function Manifesto({ heroes }: { heroes: Hero[] }) {
  const rootRef = useRef<HTMLElement>(null)
  const abilities = heroes.flatMap((h) => h.abilities)
  const facts = [
    { label: 'Heroes', value: heroes.length, blurb: 'Released and playable' },
    { label: 'Abilities', value: abilities.length, blurb: 'Four signatures apiece' },
    { label: 'Upgrades', value: abilities.reduce((n, a) => n + a.upgrades.length, 0), blurb: 'Three tiers per ability' },
  ]

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const split = SplitText.create('.manifesto__text', { type: 'words' })
      gsap.fromTo(
        split.words,
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.08,
          ease: 'none',
          scrollTrigger: { trigger: '.manifesto__text', start: 'top 78%', end: 'bottom 55%', scrub: 0.8 },
        },
      )

      gsap.utils.toArray<HTMLElement>('.fact-tile', rootRef.current).forEach((tile, i) => {
        const num = tile.querySelector<HTMLElement>('.fact-tile__count')!
        const target = Number(num.dataset.value)
        const counter = { v: 0 }
        gsap
          .timeline({ scrollTrigger: { trigger: '.fact-tiles', start: 'top 82%', toggleActions: 'play none none none' } })
          .fromTo(tile, { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, delay: i * 0.1 })
          .to(counter, {
            v: target,
            duration: 1.4,
            ease: 'power2.out',
            onUpdate: () => (num.textContent = String(Math.round(counter.v)).padStart(2, '0')),
          }, '<0.2')
      })
      return () => split.revert()
    },
    { scope: rootRef, dependencies: [heroes.length] },
  )

  return (
    <section ref={rootRef} className="manifesto" aria-labelledby="manifesto-title">
      <div className="manifesto__inner">
        <span className="eyebrow" id="manifesto-title">
          The roster
        </span>
        <p className="manifesto__text display">
          New York has gone strange, and these are the people walking its streets. Each carries one weapon, four abilities and a reason to fight. Learn their names before they learn yours.
        </p>

        <ul className="fact-tiles">
          {facts.map((f) => (
            <li key={f.label} className="fact-tile">
              <span className="fact-tile__count" data-value={f.value}>
                {String(f.value).padStart(2, '0')}
              </span>
              <span className="fact-tile__label">{f.label}</span>
              <span className="fact-tile__blurb">{f.blurb}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
