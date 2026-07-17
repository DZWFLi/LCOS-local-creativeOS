export type ScriptVersionStatus = 'draft' | 'current' | 'client_review' | 'approved' | 'rejected' | 'archived'
export type SegmentStatus = 'draft' | 'reviewing' | 'accepted' | 'revised'
export type ReviewStatus = 'open' | 'accepted' | 'resolved' | 'rejected'
export type DecisionAction = 'keep' | 'modify' | 'remove'
export type AuthorType = 'human' | 'ai'
export type AiDisposition = 'pending' | 'accepted' | 'revised' | 'rejected'

export interface BriefSnapshot {
  objective: string
  audience: string
  platform: string
  format: string
  duration: string
  productBenefits: string[]
  mandatoryMessages: string[]
  forbiddenElements: string[]
  deliverables: string[]
  lockedElements: string[]
}

export interface CreativeDirection {
  directionTitle: string
  coreInsight: string
  creativeMechanism: string
  productRole: string
  storyArc: string
  visualTone: string
  adoptedReason?: string
  rejectedReason?: string
}

export interface ScriptSegment {
  id: string
  versionId: string
  order: number
  timeStart: number
  timeEnd: number
  beatName: string
  purpose: string
  visual: string
  action: string
  dialogue?: string
  voiceover?: string
  super?: string
  productRole?: string
  lockedElements: string[]
  status: SegmentStatus
}

export interface ScriptVersion {
  id: string
  projectId: string
  versionLabel: string
  title: string
  summary: string
  sourceVersionId?: string
  changeReason: string
  feedbackIds: string[]
  decisionId?: string
  segments: ScriptSegment[]
  status: ScriptVersionStatus
  createdAt: string
}

export interface ScriptProject {
  id: string
  title: string
  recipe: 'brand-film' | 'kol-koc' | 'social-short'
  brief: BriefSnapshot
  creativeDirection: CreativeDirection
  versions: ScriptVersion[]
}

export interface ScriptReviewItem {
  id: string
  versionId: string
  segmentId?: string
  shotId?: string
  category: string
  issue: string
  businessImpact: string
  evidenceText: string
  suggestion: string
  authorType: AuthorType
  status: ReviewStatus
  decisionAction: DecisionAction
}

export interface AiSkillFinding { skill: string; finding: string }

export interface AiReviewDraft {
  versionId: string
  segmentId: string
  findings: AiSkillFinding[]
  originalText: string
  humanRevision: string
  disposition: AiDisposition
  confidence: 'low' | 'medium' | 'high'
  updatedAt: string | null
}

export interface DecisionRecord {
  id: string
  versionId: string
  acceptedIssues: string[]
  rejectedIssues: string[]
  keep: string[]
  modify: string[]
  remove: string[]
  nextVersionGoal: string
  unresolvedQuestions: string[]
  decisionSource: 'human' | 'ai-assisted' | 'client'
  createdAt: string
}

export interface DemoUiState {
  selectedVersionId: string
  selectedSegmentId: string
  activeTab: 'human' | 'ai' | 'summary'
}

export interface ProjectState {
  versions: ScriptVersion[]
  reviews: ScriptReviewItem[]
  aiDrafts: AiReviewDraft[]
  decisions: DecisionRecord[]
  ui: DemoUiState
}

export interface StoredDemoState {
  schemaVersion: number
  projectId: string
  updatedAt: string
  data: ProjectState
}
