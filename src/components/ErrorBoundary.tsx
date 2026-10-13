import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Keeps a render/animation failure from blanking the whole site. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[page]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="not-found" role="alert">
        <h1 className="display">This page didn&rsquo;t load correctly.</h1>
        <p>Reload to try again. If it keeps happening, go back to the roster and pick the hero from there.</p>
        <button className="btn" onClick={() => location.reload()}>
          Reload page
        </button>
      </section>
    )
  }
}
