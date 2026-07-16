export type ScriptVersionStatus = 'draft' | 'revised' | 'current'
export type SegmentStatus = 'open' | 'reviewed' | 'approved'
export type ReviewStatus = 'open' | 'accepted' | 'resolved'
export type DecisionAction = 'keep' | 'modify' | 'remove'
export type AuthorType = 'human' | 'ai'
export type AiDisposition = 'pending' | 'accepted' | 'revised' | 'rejected'

export interface BriefSnapshot {
  objective: string
  audience: string
  platform: string
  format: string
  duration: string
  lockedElements: string[]
}

export interface ScriptSegment {
  id: string
  order: number
  timeRange: string
  title: string
  visual: string
  action: string
  dialogue: string
  prompt: string
  status: SegmentStatus
}

export interface ScriptVersion {
  id: string
  label: string
  note: string
  status: ScriptVersionStatus
  segments: ScriptSegment[]
}

export interface ScriptProject {
  id: string
  title: string
  recipe: 'brand-film' | 'kol-koc' | 'social-short'
  brief: BriefSnapshot
  versions: ScriptVersion[]
}

export interface ScriptReviewItem {
  id: string
  versionId: string
  segmentId: string
  category: string
  issue: string
  impact: string
  suggestion: string
  authorType: AuthorType
  status: ReviewStatus
  decisionAction: DecisionAction
}

export interface AiSkillFinding {
  skill: string
  finding: string
}

export interface AiReviewDraft {
  segmentId: string
  findings: AiSkillFinding[]
  originalText: string
  humanRevision: string
  disposition: AiDisposition
  confidence: 'low' | 'medium' | 'high'
  updatedAt: string | null
}
