/**
 * @deprecated Import from `semanticDrop` instead.
 * Kept as a thin compatibility bridge for older tests/fixtures.
 */
export {
  ARRANGE_SURFACE_DROP_TARGET_ID,
  CONTEXT_GRAPH_SURFACE_DROP_TARGET_ID,
  CONTEXT_SURFACE_DROP_TARGET_ID,
  NEW_SCENE_DROP_TARGET_ID,
  WORKFLOW_GRAPH_SURFACE_DROP_TARGET_ID,
  WORKFLOW_SURFACE_DROP_TARGET_ID,
  beginSemanticDrop as beginSemanticRightDrop,
  isSemanticDropPointer,
  semanticDropTriggerFromPointer,
} from './semanticDrop'
export type { SemanticDropTrigger } from './semanticDrop'
