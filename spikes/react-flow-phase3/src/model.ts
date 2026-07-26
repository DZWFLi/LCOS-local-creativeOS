import type { Edge, Node, Viewport } from '@xyflow/react';

export type ArtifactKind = 'source' | 'generated' | 'note';

export type Artifact = {
  id: string;
  title: string;
  kind: ArtifactKind;
  status: 'current' | 'draft';
};

export type CanvasNodeData = {
  entityId: string;
  title: string;
  kind: ArtifactKind;
  status: string;
  [key: string]: unknown;
};

export type CanvasNode = Node<CanvasNodeData, 'artifact'>;

export const initialViewport: Viewport = { x: 42, y: 26, zoom: 0.88 };

export const initialArtifacts: Artifact[] = [
  { id: 'artifact-source-brief', title: 'Campaign Brief', kind: 'source', status: 'current' },
  { id: 'artifact-source-logo', title: 'Brand Marks', kind: 'source', status: 'current' },
  { id: 'artifact-source-copy', title: 'Approved Copy', kind: 'source', status: 'current' },
  { id: 'artifact-gen-keyvisual', title: 'Key Visual Draft', kind: 'generated', status: 'draft' },
  { id: 'artifact-gen-storyboard', title: 'Storyboard Draft', kind: 'generated', status: 'draft' },
  { id: 'artifact-gen-layout', title: 'Layout Exploration', kind: 'generated', status: 'draft' },
  { id: 'artifact-note-tone', title: 'Tone Decision', kind: 'note', status: 'current' },
  { id: 'artifact-note-legal', title: 'Legal Follow-up', kind: 'note', status: 'current' },
];

const view = (
  id: string,
  entityId: string,
  title: string,
  kind: ArtifactKind,
  x: number,
  y: number,
  status = kind === 'generated' ? 'Draft' : 'Current',
): CanvasNode => ({
  id,
  type: 'artifact',
  position: { x, y },
  data: { entityId, title, kind, status },
});

export const initialNodes: CanvasNode[] = [
  view('view-brief-main', 'artifact-source-brief', 'Campaign Brief', 'source', 40, 60),
  view('view-logo-main', 'artifact-source-logo', 'Brand Marks', 'source', 40, 250),
  view('view-copy-main', 'artifact-source-copy', 'Approved Copy', 'source', 40, 440),
  view('view-keyvisual-main', 'artifact-gen-keyvisual', 'Key Visual Draft', 'generated', 380, 40),
  view('view-storyboard-main', 'artifact-gen-storyboard', 'Storyboard Draft', 'generated', 380, 250),
  view('view-layout-main', 'artifact-gen-layout', 'Layout Exploration', 'generated', 380, 460),
  view('view-tone-main', 'artifact-note-tone', 'Tone Decision', 'note', 720, 100),
  view('view-legal-main', 'artifact-note-legal', 'Legal Follow-up', 'note', 720, 330),
  view('view-brief-reference', 'artifact-source-brief', 'Campaign Brief · Reference', 'source', 720, 520),
  view('view-keyvisual-review', 'artifact-gen-keyvisual', 'Key Visual · Review', 'generated', 1040, 230),
];

export const initialEdges: Edge[] = [
  { id: 'relation-brief-keyvisual', source: 'view-brief-main', target: 'view-keyvisual-main', label: 'guides' },
  { id: 'relation-logo-keyvisual', source: 'view-logo-main', target: 'view-keyvisual-main', label: 'brand source' },
  { id: 'relation-copy-storyboard', source: 'view-copy-main', target: 'view-storyboard-main', label: 'script source' },
  { id: 'relation-keyvisual-layout', source: 'view-keyvisual-main', target: 'view-layout-main', label: 'derives' },
  { id: 'relation-tone-keyvisual', source: 'view-tone-main', target: 'view-keyvisual-main', label: 'decision' },
  { id: 'relation-legal-storyboard', source: 'view-legal-main', target: 'view-storyboard-main', label: 'review' },
  { id: 'relation-brief-reference', source: 'view-brief-reference', target: 'view-keyvisual-review', label: 'context' },
  { id: 'relation-layout-review', source: 'view-layout-main', target: 'view-keyvisual-review', label: 'compare' },
];

export function makeScaleNodes(count: number): CanvasNode[] {
  const columns = Math.ceil(Math.sqrt(count));
  return Array.from({ length: count }, (_, index) => {
    const kind: ArtifactKind = index % 7 === 0 ? 'note' : index % 3 === 0 ? 'generated' : 'source';
    return view(
      `scale-view-${count}-${index}`,
      `scale-artifact-${count}-${index}`,
      `${kind === 'note' ? 'Note' : kind === 'generated' ? 'Generated' : 'Source'} ${index + 1}`,
      kind,
      (index % columns) * 250,
      Math.floor(index / columns) * 150,
    );
  });
}
