import { useEffect, useRef, useState } from 'react'
import { useRoster } from '../data/RosterContext'
import { gsap, prefersReducedMotion, useGSAP } from '../lib/gsap'
import { setScrollLocked } from '../lib/lenis'
import { heroPageImages, preloadImage } from '../lib/preload'
import { animateRing, LoaderRing } from './LoaderRing'

const IMAGES_TO_WARM = 14

export function Preloader({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const roster = useRoster()
  const rootRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const progress = useRef({ value: 0 })
  const [assetsReady, setAssetsReady] = useState(false)

  useEffect(() => {
    setScrollLocked(true)
    return () => setScrollLocked(false)
  }, [])

  // Once data arrives, warm the first screenful of card art and the fonts.
  useEffect(() => {
    if (roster.status !== 'ready') return
    // Landing straight on a hero page? Warm that page's artwork too.
    // The site may live under a base path (GitHub Pages: /<repo>/hero/haze).
    const slug = location.pathname.match(/\/hero\/([^/]+)\/?$/)?.[1]
    const deepHero = roster.heroes.find((h) => h.slug === slug)
    const srcs = [
      ...(deepHero ? heroPageImages(deepHero) : []),
      ...roster.heroes.slice(0, IMAGES_TO_WARM).flatMap((h) => (h.images.card ? [h.images.card] : [])),
    ]
    let loaded = 0
    const tasks = srcs.map((s) =>
      preloadImage(s).then(() => {
        loaded++
        tweenTo(0.55 + 0.4 * (loaded / srcs.length))
      }),
    )
    Promise.all([...tasks, document.fonts.ready]).then(() => setAssetsReady(true))
  }, [roster])

  const tweenTo = (target: number) => {
    gsap.to(progress.current, {
      value: Math.max(progress.current.value, target),
      duration: 0.8,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => {
        if (countRef.current) countRef.current.textContent = String(Math.round(progress.current.value * 100)).padStart(2, '0')
      },
    })
  }

  // Ring draw + idle creep while the API answers.
  useGSAP(
    () => {
      animateRing(rootRef.current!.querySelector('.loader-ring')!)
      tweenTo(0.35)
    },
    { scope: rootRef },
  )

  useEffect(() => {
    if (roster.status === 'ready') tweenTo(0.55)
  }, [roster.status])

  // Exit.
  useEffect(() => {
    if (!assetsReady) return
    const root = rootRef.current!
    const fast = prefersReducedMotion()
    const tl = gsap.timeline({ onComplete: onDone })
    tl.to(progress.current, {
      value: 1,
      duration: fast ? 0.1 : 0.6,
      ease: 'power2.inOut',
      overwrite: true,
      onUpdate: () => {
        if (countRef.current) countRef.current.textContent = String(Math.round(progress.current.value * 100))
      },
    })
      .to(root.querySelectorAll('.preloader__core, .preloader__caption'), {
        autoAlpha: 0,
        scale: 0.94,
        duration: fast ? 0.1 : 0.6,
        ease: 'power3.in',
      }, '+=0.15')
      .add(onReveal)
      .to(root, {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: fast ? 0.2 : 1.1,
        ease: 'expo.inOut',
      }, '-=0.1')
    return () => {
      tl.kill()
    }
  }, [assetsReady, onReveal, onDone])

  if (roster.status === 'error') {
    return (
      <div className="preloader" role="alert">
        <div className="preloader__error">
          <p className="display">Hero data didn&rsquo;t load.</p>
          <p>Check your connection, then reload the page.</p>
          <button className="btn" onClick={() => location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="preloader" style={{ clipPath: 'inset(0% 0% 0% 0%)' }} role="status" aria-live="polite">
      <div className="preloader__curtain" />
      <div className="preloader__core">
        <LoaderRing />
        <span className="preloader__count" ref={countRef}>
          00
        </span>
        <span className="visually-hidden">Loading the roster</span>
      </div>
      <p className="preloader__caption">Summoning the roster</p>
    </div>
  )
}
