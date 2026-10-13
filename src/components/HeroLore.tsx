import { useRef, useState } from 'react'
import type { Hero } from '../data/types'
import { gsap, prefersReducedMotion, SplitText, useGSAP } from '../lib/gsap'

/** Longer backstories get a smaller type size so they stay readable rather than wall-like. */
function sizeFor(paragraphs: string[]) {
  const chars = paragraphs.join(' ').length
  return chars > 1400 ? 'is-long' : chars > 750 ? 'is-medium' : ''
}

export function HeroLore({ hero }: { hero: Hero }) {
  const translation = hero.loreTranslation
  const [translated, setTranslated] = useState(!!translation)
  const paragraphs = translated && translation ? translation.paragraphs : hero.lore
  const lang = translated ? 'en' : hero.loreLang
  const rootRef = useRef<HTMLDivElement>(null)

  // Words light up as you read; re-split whenever the language switches.
  useGSAP(
    () => {
      if (prefersReducedMotion() || lang !== 'en') return
      const split = SplitText.create(rootRef.current!.querySelectorAll('.lore__p'), { type: 'words' })
      gsap.fromTo(split.words, { opacity: 0.16 }, {
        opacity: 1,
        stagger: 0.04,
        ease: 'none',
        scrollTrigger: { trigger: rootRef.current, start: 'top 80%', end: 'bottom 65%', scrub: 0.6 },
      })
      return () => split.revert()
    },
    { scope: rootRef, dependencies: [hero.slug, lang], revertOnUpdate: true },
  )

  return (
    <div className="lore">
      {translation && (
        <div className="lore__lang">
          <div className="lore__switch" role="group" aria-label="Backstory language">
            <button aria-pressed={translated} onClick={() => setTranslated(true)}>
              English
            </button>
            <button aria-pressed={!translated} onClick={() => setTranslated(false)} lang="ja">
              日本語
            </button>
          </div>
          <p className="lore__note">
            {translated ? (
              <>
                The game shows this backstory in Japanese. English translation from the{' '}
                <a href={translation.source} target="_blank" rel="noreferrer">
                  Deadlock Wiki
                </a>
                .
              </>
            ) : (
              'Original text, as it appears in the game.'
            )}
          </p>
        </div>
      )}
      <div ref={rootRef} className={`lore__text ${sizeFor(paragraphs)}`} lang={lang}>
        {paragraphs.map((p, i) => (
          <p key={`${lang}-${i}`} className="lore__p">
            {/* "\n" marks deliberate lines inside a paragraph (Rat King's plan, Baba's list): give each its own
                block so a wrapped line can't be mistaken for the next item. */}
            {p.includes('\n')
              ? p.split('\n').map((line, j) => (
                  <span key={j} className="lore__line">
                    {line}
                  </span>
                ))
              : p}
          </p>
        ))}
      </div>
    </div>
  )
}
