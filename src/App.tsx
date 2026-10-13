import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { ErrorBoundary } from './components/ErrorBoundary'
import { GlossaryTip } from './components/GlossaryTip'
import { Grain } from './components/Grain'
import { PageTransitionProvider } from './components/PageTransition'
import { Preloader } from './components/Preloader'
import { SiteHeader } from './components/SiteHeader'
import { ScrollTrigger } from './lib/gsap'
import { scrollToTarget, startSmoothScroll } from './lib/lenis'
import { HeroPage } from './pages/HeroPage'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'

export function App() {
  const [stage, setStage] = useState<'loading' | 'revealing' | 'done'>('loading')
  const ready = stage !== 'loading'
  const onReveal = useCallback(() => setStage('revealing'), [])
  const onDone = useCallback(() => setStage('done'), [])
  const location = useLocation()

  useEffect(() => {
    startSmoothScroll()
  }, [])

  // Every route starts at the top, unless it targets an anchor.
  useLayoutEffect(() => {
    if (location.hash) return
    scrollToTarget(0, true)
    window.scrollTo(0, 0)
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [location.pathname, location.hash])

  return (
    <PageTransitionProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<Home ready={ready} />} />
            <Route path="/hero/:slug" element={<HeroPage ready={ready} />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      {stage !== 'done' && <Preloader onReveal={onReveal} onDone={onDone} />}
      <GlossaryTip />
      <Grain />
    </PageTransitionProvider>
  )
}
