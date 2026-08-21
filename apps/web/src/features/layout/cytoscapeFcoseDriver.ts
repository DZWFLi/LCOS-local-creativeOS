import type { FcoseDriver, FcoseDriverRequest, FcoseDriverResult } from './fcoseLayoutAdapter'

/**
 * Phase C: real Cytoscape + fCoSE driver (lazy-loaded, headless).
 * randomize:false + initial node positions give incremental stability;
 * fixedNodeConstraint keeps pinned anchors untouched.
 */
let driverPromise: Promise<FcoseDriver> | null = null

export function cytoscapeFcoseDriver(): Promise<FcoseDriver> {
  if (driverPromise === null) {
    driverPromise = Promise.all([import('cytoscape'), import('cytoscape-fcose')]).then(([cytoscapeModule, fcoseModule]) => {
      const cytoscape = (cytoscapeModule as { default?: typeof import('cytoscape') }).default ?? cytoscapeModule
      const fcose = (fcoseModule as { default?: unknown }).default ?? fcoseModule
      ;(cytoscape as unknown as { use: (plugin: unknown) => void }).use(fcose)
      return {
        async run(request: FcoseDriverRequest): Promise<FcoseDriverResult> {
          const cy = (cytoscape as unknown as (options: unknown) => {
            layout(options: unknown): { run(): void }
            nodes(): Array<{ id(): string; position(): { x: number; y: number } }>
            destroy(): void
          })({
            headless: true,
            styleEnabled: false,
            elements: {
              nodes: request.nodes.map((node) => ({
                data: { id: node.id, width: node.width, height: node.height },
                position: { x: node.position.x, y: node.position.y },
              })),
              edges: request.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target } })),
            },
          })
          try {
            cy.layout({ name: 'fcose', ...request.options } as never).run()
            const positions: FcoseDriverResult = {}
            cy.nodes().forEach((node) => {
              const position = node.position()
              positions[node.id()] = { x: position.x, y: position.y }
            })
            return positions
          } finally {
            cy.destroy()
          }
        },
      }
    })
  }
  return driverPromise
}
