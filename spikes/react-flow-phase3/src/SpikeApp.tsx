import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  applyNodeChanges,
  getConnectedEdges,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeChange,
  type NodeMouseHandler,
  type Viewport,
} from '@xyflow/react';
import { ArtifactNode } from './ArtifactNode';
import {
  initialArtifacts,
  initialEdges,
  initialNodes,
  initialViewport,
  makeScaleNodes,
  type CanvasNode,
} from './model';

type PerfResult = {
  nodeCount: number;
  commitMs: number;
  measuredAt: string;
};

export function SpikeApp() {
  const [artifacts] = useState(initialArtifacts);
  const [nodes, setNodes] = useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [inspectedViewId, setInspectedViewId] = useState<string | null>(null);
  const [workspaceViewport, setWorkspaceViewport] = useState<Viewport>(initialViewport);
  const [currentViewport, setCurrentViewport] = useState<Viewport>(initialViewport);
  const [perfResult, setPerfResult] = useState<PerfResult | null>(null);
  const perfStartRef = useRef<number | null>(null);
  const { fitView, getViewport, setViewport } = useReactFlow<CanvasNode>();

  const nodeTypes = useMemo(() => ({ artifact: ArtifactNode }), []);
  const inspected = nodes.find((node) => node.id === inspectedViewId) ?? null;

  const handleNodeDoubleClick: NodeMouseHandler<CanvasNode> = useCallback((_event, node) => {
    setInspectedViewId(node.id);
  }, []);

  const handleNodesDelete = useCallback(
    (deleted: CanvasNode[]) => {
      setEdges((current) => {
        const connected = getConnectedEdges(deleted, current);
        const connectedIds = new Set(connected.map((edge) => edge.id));
        return current.filter((edge) => !connectedIds.has(edge.id));
      });
      if (deleted.some((node) => node.id === inspectedViewId)) {
        setInspectedViewId(null);
      }
    },
    [inspectedViewId, setEdges],
  );

  const deleteSelectedViews = useCallback(() => {
    const selected = nodes.filter((node) => node.selected);
    if (selected.length === 0) {
      return;
    }
    setNodes((current) => current.filter((node) => !node.selected));
    handleNodesDelete(selected);
  }, [handleNodesDelete, nodes, setNodes]);

  const saveViewport = useCallback(() => {
    setWorkspaceViewport(getViewport());
  }, [getViewport]);

  const restoreViewport = useCallback(() => {
    void setViewport(workspaceViewport, { duration: 180 });
  }, [setViewport, workspaceViewport]);

  const moveFar = useCallback(() => {
    void setViewport({ x: -620, y: -420, zoom: 0.52 }, { duration: 120 });
  }, [setViewport]);

  const loadScale = useCallback(
    (count: number) => {
      perfStartRef.current = performance.now();
      setPerfResult(null);
      setEdges([]);
      setNodes(makeScaleNodes(count));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const startedAt = perfStartRef.current;
          if (startedAt !== null) {
            setPerfResult({
              nodeCount: count,
              commitMs: Number((performance.now() - startedAt).toFixed(2)),
              measuredAt: new Date().toISOString(),
            });
          }
        });
      });
    },
    [setEdges, setNodes],
  );

  const restoreSemanticFixture = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setInspectedViewId(null);
    setPerfResult(null);
    void setViewport(initialViewport);
  }, [setEdges, setNodes, setViewport]);

  const classifyChanges = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      // Spike evidence only: controlled engine changes remain View operations.
      // No React Flow snapshot or InternalNode enters Project persistence.
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [setNodes],
  );

  return (
    <main className="spike-shell">
      <header className="spike-header">
        <div>
          <p>Phase 3 · Real Engine Spike</p>
          <h1>LCOS Canvas Engine Candidate</h1>
        </div>
        <div className="spike-metrics" aria-label="model metrics">
          <span data-testid="artifact-count">Artifacts {artifacts.length}</span>
          <span data-testid="view-count">Views {nodes.length}</span>
          <span data-testid="relation-count">Relations {edges.length}</span>
        </div>
      </header>

      <section className="canvas-frame">
        <ReactFlow<CanvasNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={classifyChanges}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodesDelete={handleNodesDelete}
          defaultViewport={initialViewport}
          minZoom={0.25}
          maxZoom={1.8}
          selectionOnDrag
          panOnDrag={[1, 2]}
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
          deleteKeyCode={['Backspace', 'Delete']}
          onMoveEnd={(_event, viewport) => setCurrentViewport(viewport)}
          fitViewOptions={{ padding: 0.18 }}
          aria-label="LCOS candidate canvas"
        >
          <Background color="#c5c7c3" gap={24} size={1} />
          <MiniMap
            nodeColor={(node) =>
              node.data.kind === 'source' ? '#65a6bd' : node.data.kind === 'generated' ? '#8d68da' : '#cf9d4e'
            }
            pannable
            zoomable
          />
          <Controls />
          <Panel position="top-left" className="spike-toolbar">
            <button type="button" onClick={() => void fitView({ padding: 0.18, duration: 180 })}>
              Fit views
            </button>
            <button type="button" onClick={saveViewport}>Save viewport</button>
            <button type="button" onClick={moveFar}>Set far viewport</button>
            <button type="button" onClick={restoreViewport}>Restore viewport</button>
            <button type="button" onClick={deleteSelectedViews}>Delete selected views</button>
          </Panel>
          <Panel position="bottom-left" className="spike-toolbar">
            <button type="button" onClick={() => loadScale(100)}>Load 100 views</button>
            <button type="button" onClick={() => loadScale(300)}>Load 300 views</button>
            <button type="button" onClick={restoreSemanticFixture}>Restore fixture</button>
          </Panel>
          <Panel position="bottom-center" className="viewport-readout">
            <span data-testid="viewport-readout">
              x {currentViewport.x.toFixed(1)} · y {currentViewport.y.toFixed(1)} · zoom {currentViewport.zoom.toFixed(2)}
            </span>
            <span data-testid="saved-viewport">
              saved {workspaceViewport.x.toFixed(1)}/{workspaceViewport.y.toFixed(1)}/{workspaceViewport.zoom.toFixed(2)}
            </span>
          </Panel>
        </ReactFlow>

        <aside className={`inspector${inspected ? ' is-open' : ''}`} data-testid="inspector">
          {inspected ? (
            <>
              <button type="button" className="inspector__close" onClick={() => setInspectedViewId(null)}>×</button>
              <p>Artifact Inspector</p>
              <h2>{inspected.data.title}</h2>
              <dl>
                <dt>ArtifactViewId</dt>
                <dd>{inspected.id}</dd>
                <dt>ArtifactId</dt>
                <dd>{inspected.data.entityId}</dd>
                <dt>Family</dt>
                <dd>{inspected.data.kind}</dd>
              </dl>
            </>
          ) : (
            <>
              <p>Artifact Inspector</p>
              <h2>Double-click a view</h2>
              <span>Single click selects immediately. Double click opens this view without changing Domain identity.</span>
            </>
          )}
        </aside>
      </section>

      <footer className="evidence-bar">
        <span>No Domain import · no toObject persistence · working state only</span>
        <output data-testid="performance-result">
          {perfResult ? JSON.stringify(perfResult) : 'Performance sample not run'}
        </output>
      </footer>
    </main>
  );
}
