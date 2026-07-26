import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CanvasNode } from './model';

const labels = {
  source: 'Source',
  generated: 'Generated Draft',
  note: 'Note',
} as const;

export function ArtifactNode({ data, selected }: NodeProps<CanvasNode>) {
  return (
    <article
      className={`artifact-node artifact-node--${data.kind}${selected ? ' is-selected' : ''}`}
      data-testid={`node-card-${data.entityId}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="artifact-node__topline" />
      <header>
        <span className="artifact-node__kind">{labels[data.kind]}</span>
        <span className="artifact-node__status">{data.status}</span>
      </header>
      <strong>{data.title}</strong>
      <small>View → {data.entityId}</small>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
