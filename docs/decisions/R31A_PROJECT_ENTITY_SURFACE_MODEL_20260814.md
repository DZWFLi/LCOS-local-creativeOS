# R3.1-A Project Entity / Surface Model — Frozen Decision

Date: 2026-08-14
Status: APPROVED PRODUCT MODEL / implementation closeout pending browser gate

## 1. First principle

LCOS has one Project Truth. Main Canvas, Context Graph, Workflow Graph, concrete Workflow Canvas, and Workspace/Current Scene are Presentations over that truth.

A Surface never owns a Project object and never decides whether another Surface may use it.

Scope is navigation / compatibility location only. It is not semantic ownership.

## 2. Project Entity / Canvas Node

Every meaningful Project object must have a stable Entity identity and may be projected as a Canvas Node.

Current aggregate entities:

- Collection
- Context
- Workflow
- Workspace / Current Scene

Existing Project Views remain first-class members too.

The same object may appear in multiple Surfaces without cloning or moving its underlying truth.

## 3. Collection

Collection has no independent child canvas in the new product model.

It is the persistent / normalized form of a temporary spatial Region/Fence: a named, reusable group that may later render as an in-place expandable folder.

Creating a Collection adds organization membership only. It must not clone selected Project Views.

## 4. Workspace / Current Scene

Workspace is the durable saved working scene. Current Scene means the currently active Workspace.

A Workspace stores:

- ordinary Project View membership
- aggregate Entity membership
- camera / viewport
- spatial presentation state

Workspace itself can also be projected as a node in Context / Workflow and other allowed Surfaces.

## 5. Context

Context is strictly two-level.

### Level 1 — Context Graph

Obsidian-like project Context constellation:

- Context
- Project Brief
- Stage Outline
- Current Stage
- Decision / key judgment
- important Context package / Project entity

The graph is associative, spatial, and non-linear. Context points may vary in size.

### Level 2 — one Context

Exactly two primary renderers:

- Signal Track
- Mind Map

Both consume the same exact Context membership.

Signal Track expresses how the Context evolved. Mind Map expresses its current structure.

Context-specific Surfaces are constrained editing environments. They may create/expand Collection and combine/decompose Context, but do not freely create new Workspace scenes inside the Context editor.

## 6. Workflow

Workflow is also two-level.

### Level 1 — Workflow Graph

A project-level action network. Unlike Context Graph, it is directional and state/action oriented.

It shows Workflow entities and the Project entities that feed, support, or connect them.

### Level 2 — one Workflow Canvas

A flexible action canvas over the same Project entities and semantic edges.

Workflow does not require a Workflow Page Workspace shell to exist.

## 7. Drop language

Semantic Drop means only:

> use this Project object here.

It does not mean clone, move ownership, or create a second object.

Canvas / project Surface semantic Drop uses right-button drag. Rail keeps separate left-button reorder and right-button semantic Drop.

## 8. Relation language

Scope / Workspace aggregate entities may be Core Relation endpoints directly.

Position is a soft hint. Explicit Edge is semantic fact. Region/Fence is explicit local spatial scope.

## 9. Compatibility boundaries

Legacy structures may remain readable during migration but must not continue growing through new product writes:

- Collection child canvas member clones
- delivery Scope creation
- temporary-workbench as Current Scene
- Workflow Page Workspace as Workflow truth owner

`Scope.containerViewId` still uses an ArtifactView compatibility carrier in the current schema. This remains an explicit migration debt, not the target product model.

## 10. Destructive operations

Non-destructive reference/add/remove operations are allowed now.

Destructive Scope delete / Context destructive merge / split / member migration require one Core atomic transaction contract including:

- Presentation cleanup
- Relation cleanup
- dangling aggregate ref cleanup
- proxy orphan cleanup
- rollback semantics

Do not fake this with frontend-only state deletion and call it Core-complete.
