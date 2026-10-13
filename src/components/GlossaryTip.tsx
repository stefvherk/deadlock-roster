import { useEffect, useRef, useState } from 'react'
import { useRoster } from '../data/RosterContext'

interface TipEntry {
  title: string
  definition: string
  /** A wiki URL, or a plain note when the definition is the game's own text. */
  source: string
}

const TIP_ID = 'glossary-tip'

/**
 * One shared tooltip for every term ([data-term]) on the page: status effects and damage types
 * ("Sleep", "spirit damage") as well as hero stats ("stat:MaxHealth").
 * Opens on hover, keyboard focus or tap; stays open while the pointer is over it.
 */
export function GlossaryTip() {
  const roster = useRoster()
  const glossary = roster.status === 'ready' ? roster.glossary : null
  const stats = roster.status === 'ready' ? roster.statDefinitions : null
  const tipRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const hideTimer = useRef(0)
  const [entry, setEntry] = useState<TipEntry | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0, below: false })

  useEffect(() => {
    if (!glossary || !stats) return

    const lookup = (el: HTMLElement): TipEntry | null => {
      const id = el.dataset.term ?? ''
      if (id.startsWith('stat:')) {
        const def = stats[id.slice(5)]
        return def ? { title: el.dataset.termTitle ?? id.slice(5), definition: def.text, source: def.source } : null
      }
      const g = glossary[id]
      return g ? { title: g.title, definition: g.definition, source: g.source } : null
    }
    const place = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      const below = r.top < 190
      setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 10 : r.top - 10, below })
    }
    const open = (el: HTMLElement) => {
      const found = lookup(el)
      if (!found) return
      window.clearTimeout(hideTimer.current)
      anchorRef.current?.removeAttribute('aria-describedby')
      anchorRef.current = el
      el.setAttribute('aria-describedby', TIP_ID)
      setEntry(found)
      place(el)
    }
    const close = (delay = 120) => {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => {
        anchorRef.current?.removeAttribute('aria-describedby')
        anchorRef.current = null
        setEntry(null)
      }, delay)
    }
    const termOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-term]') : null)

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const term = termOf(e.target)
      if (term) open(term)
      else if (tipRef.current?.contains(e.target as Node)) window.clearTimeout(hideTimer.current)
      else if (anchorRef.current) close()
    }
    const onFocus = (e: FocusEvent) => {
      const term = termOf(e.target)
      if (term) open(term)
    }
    const onBlur = (e: FocusEvent) => {
      if (termOf(e.target)) close(0)
    }
    const onClick = (e: MouseEvent) => {
      const term = termOf(e.target)
      if (term) {
        e.preventDefault()
        if (anchorRef.current === term) close(0)
        else open(term)
      } else if (!tipRef.current?.contains(e.target as Node)) close(0)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(0)
    }
    const onScroll = () => anchorRef.current && place(anchorRef.current)

    document.addEventListener('pointerover', onOver)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onBlur)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [glossary, stats])

  // Keep the card inside the viewport horizontally.
  const half = 160
  const left = Math.min(Math.max(pos.x, half + 12), window.innerWidth - half - 12)

  return (
    <div
      ref={tipRef}
      id={TIP_ID}
      role="tooltip"
      className={`glossary-tip${entry ? ' is-open' : ''}${pos.below ? ' is-below' : ''}`}
      style={{ left, top: pos.y }}
      aria-hidden={!entry}
    >
      {entry && (
        <>
          <strong>{entry.title}</strong>
          <p>{entry.definition}</p>
          {entry.source.startsWith('http') ? (
            <a href={entry.source} target="_blank" rel="noreferrer" tabIndex={-1}>
              Deadlock Wiki
            </a>
          ) : entry.source ? (
            <span className="glossary-tip__source">From the game&rsquo;s own text</span>
          ) : null}
        </>
      )}
    </div>
  )
}
