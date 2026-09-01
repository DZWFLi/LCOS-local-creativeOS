import { colorPinRecordsForTarget, useProjectColorPinRuntime } from './ProjectColorPinContext'

interface Props {
  readonly targetId: string
  readonly className?: string
}

/** Persistent object-local Color Pin identity. Position/material are presentation-only. */
export function ColorPinLocalDots({ targetId, className }: Props) {
  const runtime = useProjectColorPinRuntime()
  if (!runtime) return null
  const records = colorPinRecordsForTarget(runtime.records, { kind: 'view', id: targetId })
  const definitions = [...new Map(records.map((record) => [record.definition.id, record.definition])).values()]
  if (definitions.length === 0) return null
  return <span
    className={`lcos-color-pin-local-dots${className ? ` ${className}` : ''}`}
    data-testid={`color-pin-local-dots-${targetId}`}
    aria-label={`${definitions.length} 个 Color Pin`}
    title={definitions.map((definition) => definition.label?.trim() || definition.color).join(' · ')}
  >
    {definitions.map((definition) => <i
      key={definition.id}
      className="lcos-color-pin-local-dot"
      style={{ '--lcos-color-pin-tone': definition.color } as React.CSSProperties}
      aria-hidden="true"
    />)}
  </span>
}
