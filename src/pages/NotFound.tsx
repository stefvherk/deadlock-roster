import { useEffect } from 'react'
import { Arrow } from '../components/Ornaments'
import { TransitionLink } from '../components/PageTransition'

export function NotFound() {
  useEffect(() => {
    document.title = 'Lost in the Cursed Apple — Deadlock Roster'
  }, [])

  return (
    <section className="not-found">
      <span className="eyebrow">Error 404</span>
      <h1 className="display">This alley leads nowhere.</h1>
      <p>The hero you are looking for doesn&rsquo;t exist, or hasn&rsquo;t been released yet.</p>
      <TransitionLink to="/#roster" label="The Roster" eyebrow="Back to" className="btn">
        Back to the roster <Arrow />
      </TransitionLink>
    </section>
  )
}
