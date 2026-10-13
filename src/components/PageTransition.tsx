import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { useHref, useLocation, useNavigate } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '../lib/gsap'
import { scrollToTarget } from '../lib/lenis'
import { preloadImage } from '../lib/preload'
import { animateRing, LoaderRing } from './LoaderRing'

interface GoOptions {
  accent?: string
  label?: string
  eyebrow?: string
  /** Images the next page needs; the loader waits for them (up to MAX_WAIT_MS) before revealing. */
  preload?: string[]
}

interface PageTransitionApi {
  go: (to: string, opts?: GoOptions) => void
  /** Seconds a freshly mounted page should wait before its intro plays. */
  introDelay: () => number
}

const MAX_WAIT_MS = 8000
const STALL_RESET_MS = 12000
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const Ctx = createContext<PageTransitionApi>({ go: () => {}, introDelay: () => 0 })

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const accentRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const eyebrowRef = useRef<HTMLElement>(null)
  const labelRef = useRef<HTMLElement>(null)
  const busy = useRef(false)
  const busySince = useRef(0)
  const revealAt = useRef(0)

  const go = useCallback(
    (to: string, opts: GoOptions = {}) => {
      // Ignore clicks mid-transition, but never let a stalled one lock navigation for good.
      if (busy.current && performance.now() - busySince.current < STALL_RESET_MS) return
      if (to === location.pathname + location.hash) return
      if (prefersReducedMotion() || !rootRef.current) {
        navigate(to)
        return
      }
      busy.current = true
      busySince.current = performance.now()
      const root = rootRef.current
      root.style.setProperty('--pt-accent', opts.accent ?? 'var(--gold)')
      eyebrowRef.current!.textContent = opts.eyebrow ?? 'Now entering'
      labelRef.current!.textContent = opts.label ?? ''
      const parts = [coreRef.current, eyebrowRef.current, labelRef.current]

      // Counter: creeps on its own, jumps forward as each image lands.
      const progress = { value: 0 }
      const render = () => (countRef.current!.textContent = String(Math.round(progress.value * 100)).padStart(2, '0'))
      const tweenTo = (value: number, duration = 0.6) =>
        gsap.to(progress, { value, duration, ease: 'power2.out', overwrite: true, onUpdate: render })
      render()
      tweenTo(0.3, 1)

      const images = (opts.preload ?? []).filter(Boolean)
      let loaded = 0
      const assets = Promise.race([
        Promise.all(
          images.map((src) =>
            preloadImage(src).then(() => {
              loaded++
              tweenTo(0.3 + 0.7 * (loaded / images.length) * 0.95)
            }),
          ),
        ),
        wait(MAX_WAIT_MS),
      ])

      const ring = animateRing(root.querySelector('.loader-ring')!, 1.1)

      const cover = gsap
        .timeline({ defaults: { ease: 'expo.inOut' } })
        .add(() => root.classList.add('is-active'))
        .fromTo(accentRef.current, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.7 })
        .fromTo(inkRef.current, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.7 }, '-=0.52')
        .fromTo(parts, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.07, duration: 0.6, ease: 'expo.out' }, '-=0.3')

      Promise.all([cover.then(), assets])
        .then(() => tweenTo(1, 0.35).then())
        .then(() => {
          // Reset scroll while the screen is covered, *before* the next page mounts,
          // so its ScrollTriggers are created at the top of the page.
          scrollToTarget(0, true)
          window.scrollTo(0, 0)
          revealAt.current = performance.now() + 450
          navigate(to)

          gsap
            .timeline({ defaults: { ease: 'expo.inOut' } })
            .to(parts, { y: -24, autoAlpha: 0, duration: 0.4, stagger: 0.04, ease: 'power2.in' }, '+=0.2')
            .to(inkRef.current, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.8 }, '-=0.1')
            .to(accentRef.current, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.8 }, '-=0.62')
            .add(() => {
              ring.kill()
              root.classList.remove('is-active')
              busy.current = false
            })
        })
    },
    [location.pathname, location.hash, navigate],
  )

  const introDelay = useCallback(() => Math.max(0, (revealAt.current - performance.now()) / 1000), [])

  const api = useMemo(() => ({ go, introDelay }), [go, introDelay])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div ref={rootRef} className="page-transition" aria-hidden="true">
        <div ref={accentRef} className="page-transition__layer page-transition__layer--accent" />
        <div ref={inkRef} className="page-transition__layer page-transition__layer--ink">
          <div className="page-transition__label">
            <div ref={coreRef} className="page-transition__core">
              <LoaderRing />
              <span ref={countRef} className="page-transition__count">
                00
              </span>
            </div>
            <small ref={eyebrowRef} />
            <strong ref={labelRef} />
          </div>
        </div>
      </div>
    </Ctx.Provider>
  )
}

export const usePageTransition = () => useContext(Ctx)

type TransitionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: Ref<HTMLAnchorElement>
  to: string
  accent?: string
  label?: string
  eyebrow?: string
  preload?: string[]
  [data: `data-${string}`]: string | undefined
}

export function TransitionLink({ to, accent, label, eyebrow, preload, onClick, children, ...rest }: TransitionLinkProps) {
  const { go } = usePageTransition()
  // Real href (with the site's base path) so middle-click, "open in new tab" and copying links work.
  const href = useHref(to)
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    go(to, { accent, label, eyebrow, preload })
  }
  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
