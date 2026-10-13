import { useRef, type CSSProperties } from 'react'
import type { Hero } from '../data/types'
import { gsap, prefersReducedMotion } from '../lib/gsap'
import { heroPageImages } from '../lib/preload'
import { TransitionLink } from './PageTransition'

interface Props {
  hero: Hero
  index: number
}

export function HeroCard({ hero, index }: Props) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const tag = hero.tags[0]

  // Pointer-driven 3D tilt with a moving glare.
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || prefersReducedMotion()) return
    const el = cardRef.current!
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    gsap.to(el.querySelector('.hero-card__inner'), {
      rotateY: (px - 0.5) * 14,
      rotateX: (0.5 - py) * 14,
      duration: 0.6,
      ease: 'power3.out',
      overwrite: 'auto',
    })
    el.style.setProperty('--gx', `${px * 100}%`)
    el.style.setProperty('--gy', `${py * 100}%`)
  }

  const onLeave = () => {
    gsap.to(cardRef.current!.querySelector('.hero-card__inner'), {
      rotateY: 0,
      rotateX: 0,
      duration: 1.1,
      ease: 'elastic.out(1, 0.5)',
      overwrite: 'auto',
    })
  }

  const style = {
    '--accent': hero.accent,
    '--accent-rgb': hero.accentRgb.join(', '),
  } as CSSProperties

  return (
    <TransitionLink
      ref={cardRef}
      to={`/hero/${hero.slug}`}
      accent={hero.accent}
      label={hero.name}
      preload={heroPageImages(hero)}
      className={`hero-card${hero.images.gloat ? ' hero-card--swap' : ''}`}
      style={style}
      data-flip-id={hero.slug}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={hero.name}
    >
      <div className="hero-card__inner">
        <div className="hero-card__media">
          <img className="hero-card__img" src={hero.images.card ?? undefined} alt="" loading={index < 12 ? 'eager' : 'lazy'} decoding="async" />
          {hero.images.gloat && (
            <img className="hero-card__img hero-card__img--alt" src={hero.images.gloat} alt="" loading="lazy" decoding="async" />
          )}
        </div>
        <div className="hero-card__shade" />
        <div className="hero-card__glare" />
        <div className="hero-card__meta">
          {tag && <span className="hero-card__class">{tag}</span>}
          <h3 className="hero-card__name">{hero.name}</h3>
          <span className="hero-card__cta">
            View dossier
          </span>
        </div>
        <span className="hero-card__frame" aria-hidden="true" />
      </div>
    </TransitionLink>
  )
}
