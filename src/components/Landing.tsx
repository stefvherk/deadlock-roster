import { useMemo, useRef } from 'react'
import type { Hero } from '../data/types'
import { gsap, prefersReducedMotion, SplitText, useGSAP } from '../lib/gsap'
import { scrollToTarget } from '../lib/lenis'
import { useMagnetic } from '../lib/useMagnetic'
import { Arrow } from './Ornaments'
import { usePageTransition } from './PageTransition'
import { ShaderBackdrop } from './ShaderBackdrop'

const FEATURED = ['Lady Geist', 'Infernus', 'Haze', 'Seven', 'Paradox']
const FAN = [
  { rot: -16, x: -132, y: 34, z: 1 },
  { rot: -8, x: -66, y: 8, z: 2 },
  { rot: 0, x: 0, y: 0, z: 3 },
  { rot: 8, x: 66, y: 8, z: 2 },
  { rot: 16, x: 132, y: 34, z: 1 },
]

export function Landing({ heroes, ready }: { heroes: Hero[]; ready: boolean }) {
  const rootRef = useRef<HTMLElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const { introDelay } = usePageTransition()
  useMagnetic(ctaRef, 0.3)

  const featured = useMemo(() => {
    const picks = FEATURED.map((n) => heroes.find((h) => h.name === n)).filter((h): h is Hero => !!h)
    for (const h of heroes) if (picks.length < 5 && !picks.includes(h)) picks.push(h)
    return picks.slice(0, 5)
  }, [heroes])

  const abilityCount = heroes.reduce((n, h) => n + h.abilities.length, 0)

  useGSAP(
    () => {
      if (!ready) return
      const root = rootRef.current!
      const intro = root.querySelectorAll<HTMLElement>('[data-intro]')
      const cards = gsap.utils.toArray<HTMLElement>('.landing__card', root)

      if (prefersReducedMotion()) {
        gsap.set(intro, { autoAlpha: 1 })
        cards.forEach((c, i) => gsap.set(c, { autoAlpha: 1, rotate: FAN[i].rot, x: FAN[i].x, y: FAN[i].y }))
        return
      }

      const split = SplitText.create('.landing__title-word', { type: 'chars', charsClass: 'landing__char' })

      const tl = gsap.timeline({ delay: introDelay() + 0.1 })
      tl.set(intro, { autoAlpha: 1 })
        .fromTo('.landing__frame span', { scale: 0 }, { scale: 1, duration: 1.6, ease: 'expo.inOut', stagger: 0.05 }, 0)
        .fromTo(
          split.chars,
          { yPercent: 115, rotateX: -90, autoAlpha: 0 },
          { yPercent: 0, rotateX: 0, autoAlpha: 1, duration: 1.4, stagger: 0.055, ease: 'expo.out' },
          0.15,
        )
        .fromTo('.landing__eyebrow', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1 }, 0.35)
        .fromTo('.landing__lede', { y: 40, autoAlpha: 0, clipPath: 'inset(0% 0% 100% 0%)' }, { y: 0, autoAlpha: 1, clipPath: 'inset(0% 0% -10% 0%)', duration: 1.3 }, 0.6)
        .fromTo('.landing__actions > *', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.1 }, 0.8)
        .fromTo('.landing__scroll', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.2)

      cards.forEach((card, i) => {
        tl.fromTo(
          card,
          { autoAlpha: 0, y: 260, rotate: 0, x: 0 },
          { autoAlpha: 1, y: FAN[i].y, x: FAN[i].x, rotate: FAN[i].rot, duration: 1.6, ease: 'expo.out' },
          0.45 + Math.abs(i - 2) * 0.09,
        )
      })

      // Scroll-out: copy drifts up, the fan opens wider.
      gsap
        .timeline({ scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 0.6 } })
        .to('.landing__copy', { yPercent: -18, autoAlpha: 0.15, ease: 'none' }, 0)
        .to('.landing__fan', { yPercent: 14, ease: 'none' }, 0)
        .to(cards, { x: (i) => FAN[i].x * 1.9, rotate: (i) => FAN[i].rot * 1.6, ease: 'none' }, 0)

      // Pointer parallax on the fan.
      const fan = root.querySelector<HTMLElement>('.landing__fan')!
      const onMove = (e: PointerEvent) => {
        gsap.to(fan, {
          rotateY: (e.clientX / innerWidth - 0.5) * 16,
          rotateX: (0.5 - e.clientY / innerHeight) * 10,
          duration: 1.2,
          ease: 'power3',
          overwrite: 'auto',
        })
      }
      window.addEventListener('pointermove', onMove, { passive: true })
      return () => {
        window.removeEventListener('pointermove', onMove)
        split.revert()
      }
    },
    { scope: rootRef, dependencies: [ready, featured] },
  )

  return (
    <section ref={rootRef} className="landing" aria-labelledby="landing-title">
      <ShaderBackdrop />
      <div className="landing__frame" aria-hidden="true">
        <span /> <span /> <span /> <span />
      </div>

      <div className="landing__inner">
        <div className="landing__copy">
          <span className="eyebrow landing__eyebrow" data-intro>
            A fan-made field guide to Valve&rsquo;s Deadlock
          </span>
          <h1 id="landing-title" className="landing__title display" data-intro>
            <span className="landing__title-word">Dead</span>
            <span className="landing__title-word landing__title-word--italic">lock</span>
          </h1>
          <p className="landing__lede" data-intro>
            Every hero in Valve&rsquo;s Deadlock: their stories, their weapons and all four abilities with every upgrade, read straight from the game files.
          </p>
          <div className="landing__actions" data-intro>
            <button ref={ctaRef} className="btn" onClick={() => scrollToTarget('#roster')}>
              Enter the roster <Arrow />
            </button>
            <span className="landing__count">
              <strong>{heroes.length}</strong> heroes <i /> <strong>{abilityCount}</strong> abilities
            </span>
          </div>
        </div>

        <div className="landing__fan" aria-hidden="true">
          {featured.map((h, i) => (
            <figure
              key={h.slug}
              className="landing__card"
              style={{ zIndex: FAN[i].z, '--accent': h.accent } as React.CSSProperties}
            >
              <img src={h.images.card ?? undefined} alt="" />
              <figcaption>{h.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="landing__scroll" data-intro aria-hidden="true">
        <span>Scroll</span>
        <i />
      </div>
    </section>
  )
}
