/** Small art-deco glyphs shared across the site. */

export function Sigil({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 1.5 30.5 16 16 30.5 1.5 16Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 8 24 16 16 24 8 16Z" fill="currentColor" />
      <path d="M16 1.5V8M16 24v6.5M1.5 16H8M24 16h6.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

export function Arrow({ className, dir = 'right' }: { className?: string; dir?: 'right' | 'left' | 'down' | 'up' }) {
  const rotate = { right: 0, down: 90, left: 180, up: -90 }[dir]
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ rotate: `${rotate}deg` }}>
      <path d="M3 12h17M14 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function DecoRule() {
  return (
    <div className="deco-rule" aria-hidden="true">
      <span />
    </div>
  )
}
