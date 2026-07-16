# AdFrame Demo

AdFrame is a one-page AIGC asset evaluation context workspace for a portfolio presentation. It combines human commercial/visual judgment with a simulated AI Skill evaluation, highlights agreement and conflict, and turns the result into reusable context for Codex.

## Core proof

1. Evaluation is grounded in the asset Brief and generation context.
2. Human and AI judgments remain independent and explainable.
3. The conclusion can continue downstream through Markdown, JSON, and a Codex handoff object.

## Primary flow

Select preset asset → review Brief/context → complete human evaluation → run mock AI evaluation → inspect agreement/attention/conflict → generate a consolidated conclusion → export Markdown/JSON → copy Codex handoff.

## Fixed evaluation dimensions

1. Commercial objective expression
2. Platform content fit
3. Product integration
4. Composition and visual hierarchy
5. Motion or temporal continuity
6. AI generation defects

## Scope decisions

- One video case is the primary demo story.
- One image case only proves shared structure and independent saved state.
- Codex handoff is a structured subset of the shared export context, not an execution system.
- Real API, Bridge submission, CLI generation, deployment, advanced annotation, and workflow authoring are outside the critical path.
- All UI summaries and exports must derive from one canonical evaluation summary object.
