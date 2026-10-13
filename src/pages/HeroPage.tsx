import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { AbilityCard, TierPicker } from '../components/AbilityCard'
import { HeroLore } from '../components/HeroLore'
import { HeroStats } from '../components/HeroStats'
import { Arrow } from '../components/Ornaments'
import { TransitionLink, usePageTransition } from '../components/PageTransition'
import { SiteFooter } from '../components/SiteFooter'
import { useRoster } from '../data/RosterContext'
import type { Hero, Tier } from '../data/types'
import { gsap, prefersReducedMotion, ScrollTrigger, SplitText, useGSAP } from '../lib/gsap'
import { heroPageImages, preloadImage } from '../lib/preload'
import { NotFound } from './NotFound'

export function HeroPage({ ready }: { ready: boolean }) {
  const { slug } = useParams()
  const roster = useRoster()
  if (roster.status !== 'ready') return null

  const { heroes } = roster
  const idx = heroes.findIndex((h) => h.slug === slug)
  if (idx < 0) return <NotFound />

  const n = heroes.length
  return <HeroView key={heroes[idx].slug} hero={heroes[idx]} prev={heroes[(idx - 1 + n) % n]} next={heroes[(idx + 1) % n]} ready={ready} />
}

const released = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

function HeroView({ hero, prev, next, ready }: { hero: Hero; prev: Hero; next: Hero; ready: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { go, introDelay } = usePageTransition()
  const [tiers, setTiers] = useState<Tier[]>(() => hero.abilities.map(() => 0 as Tier))
  const allTier = tiers.every((t) => t === tiers[0]) ? tiers[0] : null

  // Page-level theme + title.
  useEffect(() => {
    document.title = `${hero.name} — Deadlock Roster`
    const root = document.documentElement.style
    root.setProperty('--accent', hero.accent)
    root.setProperty('--accent-rgb', hero.accentRgb.join(', '))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hero.accent)
  }, [hero])

  // ← / → between heroes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest?.('input, textarea')) return
      const target = e.key === 'ArrowRight' ? next : e.key === 'ArrowLeft' ? prev : null
      if (target) go(`/hero/${target.slug}`, { accent: target.accent, label: target.name, preload: heroPageImages(target) })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, next, prev])

  // Upgrading changes card heights; keep scroll-based reveals below them in the right place.
  useEffect(() => {
    const id = setTimeout(() => ScrollTrigger.refresh(), 50)
    return () => clearTimeout(id)
  }, [tiers])

  // Once this page has settled, warm the neighbours so ← / → feel instant.
  useEffect(() => {
    const id = setTimeout(() => [...heroPageImages(next), ...heroPageImages(prev)].forEach(preloadImage), 2500)
    return () => clearTimeout(id)
  }, [next, prev])

  useGSAP(
    () => {
      if (!ready) return
      const intro = rootRef.current!.querySelectorAll('[data-intro]')
      if (prefersReducedMotion()) {
        gsap.set(intro, { autoAlpha: 1 })
        return
      }

      // The one orchestrated moment: the hero steps out of the dark, then the name is stamped on.
      gsap
        .timeline({ delay: introDelay() + 0.05 })
        .set(intro, { autoAlpha: 1 })
        .fromTo(
          '.hero-intro__render img',
          { xPercent: 6, scale: 1.06, autoAlpha: 0, filter: 'brightness(0.2) blur(10px)' },
          { xPercent: 0, scale: 1, autoAlpha: 1, filter: 'brightness(1) blur(0px)', duration: 1.8, ease: 'expo.out' },
          0,
        )
        .fromTo('.hero-intro__name', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' }, 0.35)
        .fromTo('.hero-intro__meta > *', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.07 }, 0.9)

      gsap.to('.hero-intro__render', {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: { trigger: '.hero-intro', start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.to('.hero-intro__content', {
        yPercent: -25,
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.hero-intro', start: '35% top', end: 'bottom top', scrub: true },
      })

      gsap.utils.toArray<HTMLElement>('.section-title').forEach((el) => {
        const split = SplitText.create(el, { type: 'chars', mask: 'chars' })
        gsap.from(split.chars, { yPercent: 110, stagger: 0.03, duration: 1, scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' } })
      })
    },
    { scope: rootRef, dependencies: [ready, hero.slug] },
  )

  const style = { '--accent': hero.accent, '--accent-rgb': hero.accentRgb.join(', ') } as CSSProperties
  const nextStyle = { '--accent': next.accent, '--accent-rgb': next.accentRgb.join(', ') } as CSSProperties

  return (
    <div ref={rootRef} className="hero-page" style={style}>
      {/* ---------- Splash: the hero-select artwork is the page's backdrop ---------- */}
      <section className="hero-intro" aria-labelledby="hero-name">
        {hero.images.render && (
          <figure className="hero-intro__render" data-intro>
            <img src={hero.images.render} alt={`${hero.name}, hero artwork`} fetchPriority="high" />
          </figure>
        )}
        <div className="hero-intro__shade" aria-hidden="true" />

        <TransitionLink to="/#roster" label="The Roster" eyebrow="Back to" className="hero-intro__back" data-intro>
          <Arrow dir="left" /> All heroes
        </TransitionLink>

        <div className="hero-intro__content">
          <h1 id="hero-name" className="hero-intro__name" data-intro>
            {hero.images.name ? (
              <>
                <img src={hero.images.name} alt="" />
                <span className="visually-hidden">{hero.name}</span>
              </>
            ) : (
              <span className="display">{hero.name}</span>
            )}
          </h1>
          <div className="hero-intro__meta" data-intro>
            {hero.role && <p className="hero-intro__role display">{hero.role}</p>}
            <ul className="hero-intro__tags" aria-label="Hero tags">
              {hero.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="hero-intro__released">Released {released(hero.releaseDate)}</p>
          </div>
        </div>
      </section>

      {/* ---------- Dossier ---------- */}
      <section className="dossier" aria-labelledby="dossier-title">
        <div className="dossier__aside">
          {hero.images.card && (
            <figure className="dossier__portrait">
              <img src={hero.images.card} alt={`${hero.name} portrait`} loading="lazy" />
            </figure>
          )}
        </div>
        <div className="dossier__body">
          {hero.playstyle && (
            <div className="dossier__play">
              <h2 className="dossier__label">How they play</h2>
              <p className="dossier__playstyle">{hero.playstyle}</p>
            </div>
          )}
          <h2 id="dossier-title" className="dossier__label">
            Backstory
          </h2>
          <HeroLore hero={hero} />
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="hero-section" aria-labelledby="stats-title">
        <div className="hero-section__head">
          <h2 id="stats-title" className="section-title display">
            Stats
          </h2>
          <p className="hero-section__note">Base values at the start of a match. Bars compare {hero.name} with the rest of the roster.</p>
        </div>
        <HeroStats hero={hero} />
      </section>

      {/* ---------- Abilities ---------- */}
      <section className="hero-section" aria-labelledby="abilities-title">
        <div className="hero-section__head hero-section__head--split">
          <div>
            <h2 id="abilities-title" className="section-title display">
              Abilities
            </h2>
            <p className="hero-section__note">Pick an upgrade tier to see each ability the way it plays after spending ability points.</p>
          </div>
          <div className="abilities__all">
            <span className="abilities__all-label">Upgrade all abilities</span>
            <TierPicker value={allTier} onChange={(t) => setTiers(tiers.map(() => t))} label="Upgrade tier for all abilities" />
          </div>
        </div>
        <div className="abilities">
          {hero.abilities.map((a, i) => (
            <AbilityCard key={a.key} ability={a} tier={tiers[i]} onTier={(t) => setTiers((prev) => prev.map((old, j) => (j === i ? t : old)))} />
          ))}
        </div>
      </section>

      {/* ---------- Next / prev ---------- */}
      <nav className="hero-nav" aria-label="More heroes">
        <TransitionLink
          to={`/hero/${prev.slug}`}
          accent={prev.accent}
          label={prev.name}
          preload={heroPageImages(prev)}
          className="hero-nav__prev"
          style={{ '--accent': prev.accent } as CSSProperties}
        >
          <Arrow dir="left" />
          <span>
            <small>Previous</small>
            {prev.name}
          </span>
        </TransitionLink>

        <TransitionLink to={`/hero/${next.slug}`} accent={next.accent} label={next.name} preload={heroPageImages(next)} className="next-hero" style={nextStyle}>
          {next.images.render && (
            <div className="next-hero__art" aria-hidden="true">
              <img src={next.images.render} alt="" loading="lazy" />
            </div>
          )}
          <span className="next-hero__label">Next hero</span>
          <span className="next-hero__name display">{next.name}</span>
          <span className="next-hero__hint">
            Press <kbd>→</kbd> or click
          </span>
        </TransitionLink>
      </nav>

      <SiteFooter />
    </div>
  )
}
