# AdFrame Demo

## Project Goal

Build a polished one-page portfolio demo for reviewing commercial-video scripts through human creative judgment and mock AI/Skill analysis.

This is a portfolio demo, not a production SaaS.

## Hard Scope

- One page, frontend only.
- React, TypeScript, Vite, plain CSS, React state, localStorage, local mock data.
- One approved PortaSplit case with Script V1/V2/V3 and reusable script segments.
- Brief, Creative Direction, script versions, Review Cards, Decision and derived-output placeholders.
- Human review, mock AI drafts, Accept/Revise/Reject, source/current comparison, Markdown/JSON export, and Codex handoff.
- No backend, database, authentication, real model API, real CLI execution, workflow editor, or multi-user features.
- The second case proves data switching only; it must not become a second product flow.

## Dependency Rules

- Use npm.
- Do not add a production dependency without explicit approval.
- `lucide-react` is the only approved UI dependency.
- Do not add a component framework, Tailwind, or a state-management library.
- Never delete `package-lock.json`.

## Development Rules

- Work on one independently verifiable task at a time.
- Do not refactor unrelated files or create speculative abstractions.
- Preserve working functionality and visible copy.
- After code changes, run `npm run lint` and `npm run build`.
- Fix TypeScript and browser-console errors before continuing.
- Update `docs/PROGRESS.md` after every accepted task.
- Stop if one change touches more than 15 files or suggests a framework replacement.

## Git Safety

- Never use `git reset --hard`, force push, or history rewriting.
- Never commit secrets, API keys, or large raw source videos.
- Keep `main` demonstrable and use focused milestone commits.

## UI Rules

- Desktop-first at 1366×768; usable at 1024px without horizontal overflow.
- Dark editorial review-workbench style; the script canvas is the primary visual focus.
- Avoid fake statistics, excessive cards, gradients, pills, and nested panels.
- Use CSS variables for main design tokens.
- Controls require visible hover, selected, disabled, loading, and focus states.
- Do not implement formal UI until a complete primary-screen concept is approved.

## Required Task Report

Report changed files, checks run, lint/build results, manual checks, known risks, and the recommended next task.
