import { useEffect, type RefObject } from 'react'
import { gsap, prefersReducedMotion } from './gsap'

/** Pulls an element toward the pointer while hovered, then springs back. */
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.35) {
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' })

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * strength)
      yTo((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: true })
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [ref, strength])
}
