import type { ProjectCatalog } from '@local-creative-os/contracts'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
import { CurationQueryService } from './curation-query-service.js'
import { ProjectSearchService } from './project-search-service.js'
import { CurationCommandService } from './curation-command-service.js'
import { SemanticIndexService } from './semantic-index-service.js'
import { RuntimeRegistryService } from './runtime-registry-service.js'
import { IntelligenceProviderService } from './intelligence-provider-service.js'
import { CaptureStagingService } from './capture-staging-service.js'
import { CaptureApplicationService } from './capture-application-service.js'
import { CapturePlacementService } from './capture-placement-service.js'
import { CaptureWatchService } from './capture-watch-service.js'
import { CaptureSpaceService } from './capture-space-service.js'
import { resolveProjectAffinity } from './project-affinity-service.js'
import { ReorganizeService } from './reorganize-service.js'
import { MutationSafetyService } from './mutation-safety-service.js'
import { FeedbackRevisionService } from './feedback-revision-service.js'
import { ContinuityRuntimeService } from './continuity-runtime-service.js'
import { ReceiverRuntimeService } from './receiver-runtime-service.js'
import { SessionReadSet } from './session-read-set.js'
import { SpaceSandboxService } from './space-sandbox-service.js'
import { SpatialRetrievalService } from './spatial-retrieval-service.js'
import { AttentionRuntimeService } from './attention-runtime-service.js'
import { BoundaryEvaluatorService } from './boundary-evaluator-service.js'
import { ProjectEventHub } from './project-events/project-event-hub.js'
import { ProjectMutationCoordinator } from './project-events/project-mutation-coordinator.js'
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
  readonly curation: CurationQueryService | undefined
  readonly search: ProjectSearchService | undefined
  readonly curationCommand: CurationCommandService | undefined
  readonly semantic: SemanticIndexService | undefined
  readonly runtimeRegistry: RuntimeRegistryService
  readonly intelligence: IntelligenceProviderService
  readonly captureStaging: CaptureStagingService | undefined
  readonly resolveProjectAffinity: typeof resolveProjectAffinity
  readonly captureApplication: CaptureApplicationService | undefined
  readonly captureWatch: CaptureWatchService | undefined
  readonly captureSpace: CaptureSpaceService | undefined
  readonly reorganize: ReorganizeService | undefined
  readonly sessionReadSet: SessionReadSet
  readonly spaceSandbox: SpaceSandboxService | undefined
  readonly spatialRetrieval: SpatialRetrievalService | undefined
  readonly attentionRuntime: AttentionRuntimeService | undefined
  readonly boundaryEvaluator: BoundaryEvaluatorService
  readonly projectEvents: ProjectEventHub
  readonly projectMutations: ProjectMutationCoordinator
  readonly mutationSafety: MutationSafetyService | undefined
  readonly feedbackRevision: FeedbackRevisionService | undefined
  readonly continuityRuntime: ContinuityRuntimeService | undefined
  readonly receiverRuntime: ReceiverRuntimeService | undefined
}

/** 服务装配：把 options 解析成 createLocalCoreServer 需要的一组服务。 */
export function composeLocalCoreServices(options: LocalCoreServerOptions = {}): LocalCoreServices {
  const metadata = options.metadataRepository
  const projectEvents = new ProjectEventHub()
  const projectMutations = new ProjectMutationCoordinator(projectEvents)
  const conversations = options.conversationImportService ?? (metadata === undefined ? undefined : new ConversationImportService(metadata))
  const presentation = metadata === undefined ? undefined : new PresentationApplicationService(metadata, metadata, undefined, projectEvents)
  const semantic = metadata === undefined ? undefined : new SemanticIndexService(metadata)
  const runtimeRegistry = options.runtimeRegistryService ?? new RuntimeRegistryService()
  const intelligence = options.intelligenceService ?? options.localIntelligenceService ?? new IntelligenceProviderService()
  const captureStaging = metadata === undefined ? undefined : options.captureStagingService ?? new CaptureStagingService(metadata)
  const importCopy = options.importCopyService ?? (metadata === undefined ? undefined : new ImportCopyService(metadata))
  const packages = options.resourcePackageService ?? (metadata === undefined ? undefined : new ResourcePackageService(metadata))
  const resources = options.resourceImportService ?? (metadata === undefined || importCopy === undefined ? undefined : new UniversalResourceImportService(metadata, importCopy))
  const obsidian = options.obsidianConnector ?? new ObsidianReadOnlyConnector()
  const captureApplication = metadata === undefined || resources === undefined || captureStaging === undefined
    ? undefined
    : options.captureApplicationService ?? new CaptureApplicationService(metadata, resources, captureStaging, runtimeRegistry, {
        blobRoot: process.env.LCOS_CAPTURE_STAGING_ROOT ?? join(homedir(), '.lcos', 'capture-staging', 'blobs'),
        placement: new CapturePlacementService(metadata),
      })
  const captureWatch = metadata === undefined || captureApplication === undefined
    ? undefined
    : options.captureWatchService ?? new CaptureWatchService(metadata, (request) => captureApplication.capture(request))
  const captureSpace = metadata === undefined || resources === undefined || captureStaging === undefined
    ? undefined
    : new CaptureSpaceService(
        metadata,
        captureStaging,
        resources,
        new CapturePlacementService(metadata),
        intelligence,
        process.env.LCOS_CAPTURE_STAGING_ROOT ?? join(homedir(), '.lcos', 'capture-staging', 'blobs'),
      )
  const mutationSafety = metadata === undefined || presentation === undefined
    ? undefined
    : new MutationSafetyService(metadata, presentation, projectEvents)
  const reorganize = metadata === undefined || presentation === undefined || mutationSafety === undefined
    ? undefined
    : options.reorganizeService ?? new ReorganizeService(metadata, presentation, mutationSafety)
  const feedbackRevision = metadata === undefined ? undefined : new FeedbackRevisionService(metadata, projectEvents)
  const sessionReadSet = options.sessionReadSet ?? new SessionReadSet()
  // /space/ 虚拟命名空间沙箱（任务四 P1）：与 curation 共用同一 SessionReadSet 实例
  const spaceSandbox = metadata === undefined ? undefined : new SpaceSandboxService({ repository: metadata, sessionReadSet })
  const spatialRetrieval = metadata === undefined ? undefined : new SpatialRetrievalService(metadata)
  const activeContext = options.activeContextStore ?? new ActiveContextStore(metadata, projectEvents)
  const search = metadata === undefined ? undefined : new ProjectSearchService(metadata, conversations, semantic)
  const attentionRuntime = metadata === undefined
    ? undefined
    : new AttentionRuntimeService(metadata, activeContext, search, spatialRetrieval, intelligence)
  const boundaryEvaluator = new BoundaryEvaluatorService(intelligence)
  const continuityRuntime = metadata === undefined || attentionRuntime === undefined
    ? undefined
    : new ContinuityRuntimeService(metadata, runtimeRegistry, attentionRuntime, projectEvents)
  // RECEIVER-0 只依赖 metadata + 事件总线（不依赖 attention runtime），承接关系层独立可用。
  const receiverRuntime = metadata === undefined ? undefined : new ReceiverRuntimeService(metadata, projectEvents)
  if (options.runtimeApplicationService !== undefined && continuityRuntime !== undefined) {
    options.runtimeApplicationService.attachContinuity(continuityRuntime)
  }
  return {
    catalog: options.catalog ?? new ExplicitProjectCatalog([]),
    metadata,
    fileRegistry: options.fileRegistryService,
    fileObservation: options.fileObservationService ?? (metadata === undefined ? undefined : new FileObservationService(metadata)),
    importCopy,
    resources,
    packages,
    uploads: metadata === undefined || packages === undefined ? undefined : new ResourceUploadSessionService(metadata, packages),
    resourceReader: options.resourceReader ?? (metadata === undefined ? undefined : new ResourceReader(metadata)),
    matcher: options.resourceMatcher ?? new ResourceMatcher(),
    contextManifest: options.contextManifestService ?? (metadata === undefined ? undefined : new ContextManifestService(metadata)),
    runtimeReview: options.runtimeReviewService ?? (metadata === undefined ? undefined : new RuntimeReviewService(metadata)),
    runtimeApplication: options.runtimeApplicationService,
    activeContext,
    contextProposals: options.contextProposalStore ?? new ContextProposalStore(metadata, projectEvents),
    runEventListeners: new Map<string, Set<() => void>>(),
    obsidian,
    obsidianSessions: options.obsidianSessions ?? new ObsidianConnectorSessionStore(),
    connectorRegistry: options.connectorRegistry ?? new ResourceConnectorRegistry([obsidian]),
    ownsConversationService: options.conversationImportService === undefined && metadata !== undefined,
    conversations,
    previewWorker: options.previewWorkerService
      ?? (metadata === undefined ? undefined : new PreviewWorkerService(metadata, {
        cacheService: new PreviewCacheService(metadata, {
          cacheRoot: options.previewCacheRoot ?? `${metadata.databasePath}.preview-cache`,
        }),
      })),
    workbench: options.workbenchService ?? (metadata === undefined ? undefined : new WorkbenchService(metadata)),
    contextSnapshots: options.contextSnapshotService ?? (metadata === undefined ? undefined : new ContextSnapshotService(metadata)),
    presentation,
    curation: metadata === undefined ? undefined : new CurationQueryService({
      repository: metadata,
      ...(conversations === undefined ? {} : { conversations }),
    }),
    search,
    semantic,
    curationCommand: metadata === undefined ? undefined : new CurationCommandService({
      repository: metadata,
      presentations: presentation!,
      // HU-2b（任务三第二刀）：mutation 层 CAS guard 接 sessionReadSet（与 routes /curation/read 同一实例）
      sessionReadSet,
    }),
    runtimeRegistry,
    intelligence,
    captureStaging,
    resolveProjectAffinity,
    captureApplication,
    captureWatch,
    captureSpace,
    reorganize,
    sessionReadSet,
    spaceSandbox,
    spatialRetrieval,
    attentionRuntime,
    boundaryEvaluator,
    projectEvents,
    projectMutations,
    mutationSafety,
    feedbackRevision,
    continuityRuntime,
    receiverRuntime,
  }
}
