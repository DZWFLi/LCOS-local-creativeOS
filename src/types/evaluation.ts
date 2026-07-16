export const evaluationDimensionIds = [
  'commercialObjective',
  'platformFit',
  'productIntegration',
  'visualHierarchy',
  'temporalContinuity',
  'generationDefects',
] as const

export type EvaluationDimensionId = (typeof evaluationDimensionIds)[number]

export type AssetKind = 'image' | 'video'

export interface DemoAsset {
  id: string
  projectId: string
  title: string
  version: string
  kind: AssetKind
  brief: string
  generationContext: string
  source: string
}

export type DimensionScores = Record<EvaluationDimensionId, number>

export interface HumanEvaluation {
  scores: DimensionScores
  tags: string[]
  severity: 'low' | 'medium' | 'high'
  notes: string
  timecodeSeconds?: number
}

export interface AiEvaluation {
  scores: DimensionScores
  rationale: Partial<Record<EvaluationDimensionId, string>>
  confidence: number
  badcases: string[]
}

export type ConflictLevel = 'agreement' | 'attention' | 'conflict'

export interface DimensionComparison {
  dimension: EvaluationDimensionId
  humanScore: number
  aiScore: number
  difference: number
  level: ConflictLevel
}
