import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Landing } from '../components/Landing'
import { Manifesto } from '../components/Manifesto'
import { Marquee } from '../components/Marquee'
import { Roster } from '../components/Roster'
import { SiteFooter } from '../components/SiteFooter'
import { useRoster } from '../data/RosterContext'
import { ScrollTrigger } from '../lib/gsap'
import { scrollToTarget } from '../lib/lenis'

export function Home({ ready }: { ready: boolean }) {
  const roster = useRoster()
  const location = useLocation()
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.title = 'Deadlock — The Roster'
    document.documentElement.style.removeProperty('--accent')
    document.documentElement.style.removeProperty('--accent-rgb')
  }, [])

  // Arriving via /#roster (e.g. from a hero page).
  useEffect(() => {
    if (!ready || location.hash !== '#roster') return
    const id = requestAnimationFrame(() => {
      ScrollTrigger.refresh()
      scrollToTarget('#roster', true)
    })
    return () => cancelAnimationFrame(id)
  }, [ready, location.hash])

  if (roster.status !== 'ready') return null
  const { heroes } = roster

  return (
    <>
      <Landing heroes={heroes} ready={ready} />
      <Marquee heroes={heroes} />
      <Manifesto heroes={heroes} />
      <Roster heroes={heroes} query={query} onQuery={setQuery} />
      <SiteFooter />
    </>
  )
}
