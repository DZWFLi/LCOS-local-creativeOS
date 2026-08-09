# LCOS Product Interface Design System

This folder is the reusable product-surface design authority for Local Creative OS.

## Sources

- `C:/Users/1/Desktop/OS开发/03_UI设计包/LCOS_GUI_重构总Brief_VNext3.1_能力框架保留_体验收口版_20260809.md`
- `C:/Users/1/Desktop/正式版原型2.zip`
- `docs/design/CREATIVE_OS_MATERIAL_VISUAL_SYSTEM.md`
- Current `apps/web` vNext / Porcelain / Reconstruction implementation.
- Frozen PRD and UI interaction decisions summarized by the repository README and AGENTS rules.

## Index

- `tokens/colors_and_type.css`: canonical product tokens.
- `brand/voice-and-tone.md`: user-facing language rules.
- `brand/style-notes.md`: product material, spacing, motion and object hierarchy.
- The production component implementation remains in `apps/web/src/features/`; it is not duplicated here because the live codebase is the source of truth.

## Current confidence

High confidence: base palette, typography roles, surface hierarchy, object categories, selection language and desktop motion.
Needs continued validation: density at 1366×768, long Chinese project names, 100+ node degradation and Windows packaged-font rendering.
