import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadRoster } from './api'
import type { Roster } from './types'

type RosterState = { status: 'loading' } | { status: 'error'; error: string } | ({ status: 'ready' } & Roster)

const RosterContext = createContext<RosterState>({ status: 'loading' })

export function RosterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RosterState>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    loadRoster()
      .then((data) => alive && setState({ status: 'ready', ...data }))
      .catch((err) => alive && setState({ status: 'error', error: String(err?.message ?? err) }))
    return () => {
      alive = false
    }
  }, [])

  return <RosterContext.Provider value={state}>{children}</RosterContext.Provider>
}

export const useRoster = () => useContext(RosterContext)
