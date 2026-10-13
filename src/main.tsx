import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@fontsource/bodoni-moda/400.css'
import '@fontsource/bodoni-moda/500.css'
import '@fontsource/bodoni-moda/400-italic.css'
import '@fontsource/bodoni-moda/700.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'

import './styles/global.css'
import './styles/home.css'
import './styles/hero.css'

import { App } from './App'
import { RosterProvider } from './data/RosterContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RosterProvider>
        <App />
      </RosterProvider>
    </BrowserRouter>
  </StrictMode>,
)
