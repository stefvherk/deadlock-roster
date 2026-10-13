import { useRoster } from '../data/RosterContext'

/**
 * A stat name that shows its definition on hover, focus or tap (see GlossaryTip).
 * Renders plain text when there is no definition for the stat.
 */
export function StatTerm({ statKey, label }: { statKey: string; label: string }) {
  const roster = useRoster()
  const defined = roster.status === 'ready' && !!roster.statDefinitions[statKey]
  if (!defined) return <>{label}</>
  return (
    <span className="term" data-term={`stat:${statKey}`} data-term-title={label} tabIndex={0}>
      {label}
    </span>
  )
}
