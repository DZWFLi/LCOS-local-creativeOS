import type { ArtifactBirthProvenanceV1 } from '@local-creative-os/contracts'

export function canonicalBirthConversationView(birth: ArtifactBirthProvenanceV1 | null | undefined): string | null {
  if (!birth || birth.origin !== 'run-return') return null
  if (!birth.birthRunId || !birth.conversationSession || !birth.conversationViewId) return null
  return String(birth.conversationViewId)
}
