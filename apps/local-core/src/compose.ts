import type { ProjectCatalog } from '@local-creative-os/contracts'
import { ActiveContextStore } from './active-context-store.js'
import { ContextManifestService } from './context-manifest-service.js'
import { ContextProposalStore } from './context-proposal-store.js'
import { ContextSnapshotService } from './context-snapshot-service.js'
import { ConversationImportService } from './conversation-import-service.js'
import { FileObservationService } from './file-observation-service.js'
import { FileRegistryService } from './file-registry-service.js'
import { ImportCopyService } from './import-copy-service.js'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import { PreviewCacheService } from './preview-cache-service.js'
import { PreviewWorkerService } from './preview-worker-service.js'
import { ExplicitProjectCatalog } from './project-catalog.js'
import { ResourceConnectorRegistry } from './connectors/connector-port.js'
import { ObsidianConnectorSessionStore, ObsidianReadOnlyConnector } from './connectors/obsidian-connector.js'
import { ResourceMatcher } from './resources/resource-matcher.js'
import { ResourcePackageService } from './resources/resource-package-service.js'
import { ResourceReader } from './resources/resource-reader.js'
import { ResourceUploadSessionService } from './resources/resource-upload-session-service.js'
import { UniversalResourceImportService } from './resources/universal-resource-import-service.js'
import type { RuntimeApplicationService } from './runtime-application-service.js'
import { RuntimeReviewService } from './runtime-review-service.js'
import { WorkbenchService } from './workbench-service.js'
import { PresentationApplicationService } from './presentation-application-service.js'
import type { LocalCoreServerOptions } from './server.js'

export interface LocalCoreServices {
  readonly catalog: ProjectCatalog
  readonly metadata: SqliteMetadataRepository | undefined
  readonly fileRegistry: FileRegistryService | undefined
  readonly fileObservation: FileObservationService | undefined
  readonly importCopy: ImportCopyService | undefined
  readonly resources: UniversalResourceImportService | undefined
  readonly packages: ResourcePackageService | undefined
  readonly uploads: ResourceUploadSessionService | undefined
  readonly resourceReader: ResourceReader | undefined
  readonly matcher: ResourceMatcher
  readonly contextManifest: ContextManifestService | undefined
  readonly runtimeReview: RuntimeReviewService | undefined
  readonly runtimeApplication: RuntimeApplicationService | undefined
  readonly activeContext: ActiveContextStore
  readonly contextProposals: ContextProposalStore
  readonly runEventListeners: Map<string, Set<() => void>>
  readonly obsidian: ObsidianReadOnlyConnector
  readonly obsidianSessions: ObsidianConnectorSessionStore
  readonly connectorRegistry: ResourceConnectorRegistry
  readonly ownsConversationService: boolean
  readonly conversations: ConversationImportService | undefined
  readonly previewWorker: PreviewWorkerService | undefined
  readonly workbench: WorkbenchService | undefined
  readonly contextSnapshots: ContextSnapshotService | undefined
  readonly presentation: PresentationApplicationService | undefined
}

/** 服务装配：把 options 解析成 createLocalCoreServer 需要的一组服务。 */
export function composeLocalCoreServices(options: LocalCoreServerOptions = {}): LocalCoreServices {
  const metadata = options.metadataRepository
  const importCopy = options.importCopyService ?? (metadata === undefined ? undefined : new ImportCopyService(metadata))
  const packages = options.resourcePackageService ?? (metadata === undefined ? undefined : new ResourcePackageService(metadata))
  const obsidian = options.obsidianConnector ?? new ObsidianReadOnlyConnector()
  return {
    catalog: options.catalog ?? new ExplicitProjectCatalog([]),
    metadata,
    fileRegistry: options.fileRegistryService,
    fileObservation: options.fileObservationService ?? (metadata === undefined ? undefined : new FileObservationService(metadata)),
    importCopy,
    resources: options.resourceImportService ?? (metadata === undefined || importCopy === undefined ? undefined : new UniversalResourceImportService(metadata, importCopy)),
    packages,
    uploads: metadata === undefined || packages === undefined ? undefined : new ResourceUploadSessionService(metadata, packages),
    resourceReader: options.resourceReader ?? (metadata === undefined ? undefined : new ResourceReader(metadata)),
    matcher: options.resourceMatcher ?? new ResourceMatcher(),
    contextManifest: options.contextManifestService ?? (metadata === undefined ? undefined : new ContextManifestService(metadata)),
    runtimeReview: options.runtimeReviewService ?? (metadata === undefined ? undefined : new RuntimeReviewService(metadata)),
    runtimeApplication: options.runtimeApplicationService,
    activeContext: options.activeContextStore ?? new ActiveContextStore(metadata),
    contextProposals: options.contextProposalStore ?? new ContextProposalStore(metadata),
    runEventListeners: new Map<string, Set<() => void>>(),
    obsidian,
    obsidianSessions: options.obsidianSessions ?? new ObsidianConnectorSessionStore(),
    connectorRegistry: options.connectorRegistry ?? new ResourceConnectorRegistry([obsidian]),
    ownsConversationService: options.conversationImportService === undefined && metadata !== undefined,
    conversations: options.conversationImportService ?? (metadata === undefined ? undefined : new ConversationImportService(metadata)),
    previewWorker: options.previewWorkerService
      ?? (metadata === undefined ? undefined : new PreviewWorkerService(metadata, {
        cacheService: new PreviewCacheService(metadata, {
          cacheRoot: options.previewCacheRoot ?? `${metadata.databasePath}.preview-cache`,
        }),
      })),
    workbench: options.workbenchService ?? (metadata === undefined ? undefined : new WorkbenchService(metadata)),
    contextSnapshots: options.contextSnapshotService ?? (metadata === undefined ? undefined : new ContextSnapshotService(metadata)),
    presentation: metadata === undefined ? undefined : new PresentationApplicationService(metadata, metadata),
  }
}
