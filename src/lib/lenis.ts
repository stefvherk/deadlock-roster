import Lenis from 'lenis'
import { gsap, prefersReducedMotion, ScrollTrigger } from './gsap'

let lenis: Lenis | null = null

/** One Lenis instance for the whole app, driven by GSAP's ticker so ScrollTrigger stays in sync. */
export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return lenis
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis?.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}

export function scrollToTarget(target: string | number | HTMLElement, immediate = false) {
  if (lenis) lenis.scrollTo(target, { immediate, duration: 1.6, offset: 0 })
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' })
  else {
    const el = typeof target === 'string' ? document.querySelector(target) : target
    el?.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' })
  }
}

export function setScrollLocked(locked: boolean) {
  if (lenis) locked ? lenis.stop() : lenis.start()
  document.documentElement.classList.toggle('is-locked', locked)
}
