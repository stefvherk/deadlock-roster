import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Hero } from '../data/types'
import { Flip, gsap, prefersReducedMotion, ScrollTrigger, SplitText, useGSAP } from '../lib/gsap'
import { HeroCard } from './HeroCard'

interface Props {
  heroes: Hero[]
  query: string
  onQuery: (q: string) => void
}

export function Roster({ heroes, query, onQuery }: Props) {
  const rootRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const flipState = useRef<Flip.FlipState | null>(null)
  const flipTween = useRef<gsap.core.Timeline | null>(null)
  const revealTriggers = useRef<ScrollTrigger[]>([])

  const indexBySlug = useMemo(() => new Map(heroes.map((h, i) => [h.slug, i])), [heroes])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return heroes
    return heroes.filter((h) => h.name.toLowerCase().includes(q) || h.tags.some((t) => t.toLowerCase().includes(q)))
  }, [heroes, query])

  /**
   * Once the visitor starts searching, the scroll-in reveal has done its job:
   * drop it and show every card, so nothing stays hidden behind a stale trigger.
   */
  const revealAll = () => {
    if (!revealTriggers.current.length) return
    revealTriggers.current.forEach((t) => t.kill())
    revealTriggers.current = []
    gsap.set(gridRef.current!.querySelectorAll('.hero-card'), { autoAlpha: 1, y: 0, overwrite: true })
  }

  // Capture card positions before React re-renders, then FLIP from them.
  const captureThen = (fn: () => void) => {
    if (gridRef.current) revealAll()
    if (!prefersReducedMotion() && gridRef.current) {
      flipState.current = Flip.getState(gridRef.current.querySelectorAll('.hero-card'))
      flipTween.current?.kill()
    }
    fn()
  }

  useLayoutEffect(() => {
    const state = flipState.current
    if (!state) return
    flipState.current = null
    flipTween.current = Flip.from(state, {
      targets: gridRef.current!.querySelectorAll('.hero-card'),
      duration: 0.8,
      ease: 'expo.inOut',
      stagger: 0.012,
      onEnter: (els) =>
        gsap.fromTo(els, { autoAlpha: 0, scale: 0.85, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, stagger: 0.03, delay: 0.2 }),
      onComplete: () => ScrollTrigger.refresh(),
    })
  }, [visible])

  // Heading + first reveal of the grid.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const title = SplitText.create('.roster__title', { type: 'chars', mask: 'chars' })
      gsap.from(title.chars, {
        yPercent: 110,
        stagger: 0.04,
        duration: 1.2,
        scrollTrigger: { trigger: '.roster__head', start: 'top 80%', toggleActions: 'play none none none' },
      })
      gsap.from('.roster__controls > *', {
        y: 30,
        autoAlpha: 0,
        stagger: 0.08,
        scrollTrigger: { trigger: '.roster__head', start: 'top 75%', toggleActions: 'play none none none' },
      })
      const cards = gsap.utils.toArray<HTMLElement>('.hero-card', gridRef.current)
      gsap.set(cards, { autoAlpha: 0, y: 90 })
      revealTriggers.current = ScrollTrigger.batch(cards, {
        start: 'top 92%',
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.07, ease: 'expo.out', overwrite: true }),
      })
      return () => title.revert()
    },
    { scope: rootRef, dependencies: [heroes.length] },
  )

  // "/" focuses the search field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.closest?.('input, textarea, [contenteditable]')
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section ref={rootRef} id="roster" className="roster" aria-labelledby="roster-title">
      <div className="roster__head">
        <div>
          <span className="eyebrow">Choose your hero</span>
          <h2 id="roster-title" className="roster__title display">
            The Roster
          </h2>
        </div>
        <div className="roster__controls">
          <label className="search">
            <span className="visually-hidden">Search heroes by name or tag</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search heroes or tags"
              value={query}
              onChange={(e) => captureThen(() => onQuery(e.target.value))}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd aria-hidden="true">/</kbd>
          </label>
        </div>
      </div>

      <p className="roster__status" aria-live="polite">
        Showing <strong>{visible.length}</strong> of {heroes.length}
      </p>

      <div ref={gridRef} className="roster-grid">
        {visible.map((h) => (
          <HeroCard key={h.slug} hero={h} index={indexBySlug.get(h.slug) ?? 0} />
        ))}
      </div>

      {visible.length === 0 && (
        <div className="roster__empty">
          <p className="display">No hero answers to &ldquo;{query}&rdquo;.</p>
          <button className="btn" onClick={() => captureThen(() => onQuery(''))}>
            Clear search
          </button>
        </div>
      )}
    </section>
  )
}
