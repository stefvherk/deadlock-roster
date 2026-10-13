import { useRoster } from '../data/RosterContext'
import { scrollToTarget } from '../lib/lenis'
import { Arrow, DecoRule } from './Ornaments'

export function SiteFooter() {
  const roster = useRoster()
  const patch = roster.status === 'ready' ? roster.patch : null

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <DecoRule />
        <p className="site-footer__big">See you in New York.</p>
        <div className="site-footer__meta">
          <p>
            Unofficial fan project, not affiliated with or endorsed by Valve. Deadlock, its heroes and artwork belong to Valve
            Corporation. Game data, artwork and status definitions come from the{' '}
            <a href="https://deadlock.wiki" target="_blank" rel="noreferrer">
              Deadlock Wiki
            </a>{' '}
            (CC BY-NC-SA 4.0).
          </p>
          {patch && <span className="source-pill">Game data: {patch} patch</span>}
          <button className="btn" onClick={() => scrollToTarget(0)}>
            Back to top <Arrow dir="up" />
          </button>
        </div>
      </div>
    </footer>
  )
}
