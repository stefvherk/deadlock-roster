import { useHref, useLocation } from 'react-router-dom'
import { scrollToTarget } from '../lib/lenis'
import { Sigil } from './Ornaments'
import { TransitionLink, usePageTransition } from './PageTransition'

export function SiteHeader() {
  const { pathname } = useLocation()
  const { go } = usePageTransition()
  const rosterHref = useHref('/#roster')

  const toRoster = (e: React.MouseEvent) => {
    e.preventDefault()
    if (pathname === '/') scrollToTarget('#roster')
    else go('/#roster', { label: 'The Roster' })
  }

  return (
    <header className="site-header">
      <TransitionLink to="/" className="brand" label="Deadlock" aria-label="Deadlock roster — home">
        <Sigil />
        <span>Deadlock</span>
      </TransitionLink>
      <nav className="site-nav" aria-label="Primary">
        <a href={rosterHref} onClick={toRoster}>
          Roster
        </a>
        <a href="https://store.steampowered.com/app/1422450/Deadlock/" target="_blank" rel="noreferrer">
          Play
        </a>
      </nav>
    </header>
  )
}
