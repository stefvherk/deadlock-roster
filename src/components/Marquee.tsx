import { useRef } from 'react'
import type { Hero } from '../data/types'
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '../lib/gsap'

/** Two counter-scrolling rows of hero names whose speed follows scroll velocity. */
export function Marquee({ heroes }: { heroes: Hero[] }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const half = Math.ceil(heroes.length / 2)
  const rows = [heroes.slice(0, half), heroes.slice(half)]

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const tracks = gsap.utils.toArray<HTMLElement>('.marquee__track', rootRef.current)
      const loops = tracks.map((track, i) =>
        gsap.fromTo(
          track,
          { xPercent: i % 2 ? -50 : 0 },
          { xPercent: i % 2 ? 0 : -50, duration: 60, ease: 'none', repeat: -1 },
        ),
      )
      let boost = gsap.to({}, {})
      ScrollTrigger.create({
        trigger: rootRef.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const v = gsap.utils.clamp(-8, 8, self.getVelocity() / 250)
          boost.kill()
          boost = gsap.fromTo(loops, { timeScale: 1 + Math.abs(v) }, { timeScale: 1, duration: 1.2, ease: 'power3.out' })
        },
      })
    },
    { scope: rootRef, dependencies: [heroes.length] },
  )

  return (
    <div ref={rootRef} className="marquee" aria-hidden="true">
      {rows.map((row, r) => (
        <div key={r} className={`marquee__row marquee__row--${r}`}>
          <div className="marquee__track">
            {[0, 1].map((dup) => (
              <div key={dup} className="marquee__group">
                {row.map((h) => (
                  <span key={h.slug} className="marquee__item" style={{ '--accent': h.accent } as React.CSSProperties}>
                    {h.name}
                    <i />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
