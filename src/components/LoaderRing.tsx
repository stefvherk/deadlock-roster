import { gsap } from '../lib/gsap'

/** The art-deco ring shared by the first-load preloader and the page transition. */
export function LoaderRing() {
  return (
    <svg className="loader-ring" viewBox="0 0 200 200" aria-hidden="true">
      <circle className="draw" cx="100" cy="100" r="96" strokeWidth="1" opacity="0.35" />
      <circle cx="100" cy="100" r="84" strokeWidth="1" strokeDasharray="2 6" />
      <path className="draw" d="M100 8 192 100 100 192 8 100Z" strokeWidth="1" />
      <path className="draw" d="M100 30 170 100 100 170 30 100Z" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

/** Draws the ring's strokes in and sets it slowly spinning. Kill the returned timeline to stop it. */
export function animateRing(ring: Element, drawDuration = 2.2) {
  return gsap
    .timeline()
    .fromTo(
      ring.querySelectorAll('.draw'),
      { strokeDasharray: 1200, strokeDashoffset: 1200 },
      { strokeDashoffset: 0, duration: drawDuration, ease: 'power3.inOut', stagger: 0.12 },
      0,
    )
    .fromTo(ring, { rotate: 0 }, { rotate: 360, duration: 40, repeat: -1, ease: 'none' }, 0)
}
