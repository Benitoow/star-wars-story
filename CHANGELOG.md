# Changelog

## v1.1.1 — 2026-04-17

### 🐛 Hotfix
- Fixed the runtime error where `stringifyNarrativeValue` was not available in the camp summary path.
- Exposed the narrative stringifier at module scope so legacy story rendering can safely reuse it.
- Kept the V1.1 release metadata aligned with the fix.

## v1.1.0 — 2026-04-17

Cloudflare-only release cleanup and legacy archival pass.

### ✨ Highlights
- Archived the classic vanilla JS prototype in `archives/legacy-js/`.
- Clarified that the playable version lives on the Cloudflare-hosted site, not GitHub Pages.
- Removed the GitHub Pages deployment workflow from the active path.

### 🧹 Technical Cleanup
- Reframed the repository as the source/reference tree for the modernized app.
- Updated public documentation to match the real play endpoint.
- Kept release notes aligned with the current deployment model.

## v1.0.0 — 2026-04-17

First official release of **Star Wars Story**.

### ✨ Highlights
- New multi-step story onboarding (identity, tone intensity, setup).
- Local-first dashboard to create, open, and manage stories.
- Full session resume support from dashboard (turn, chapter, messages, and choices).
- Richer long-term story memory with hidden progression systems.

### 🎭 Story & UX Improvements
- Better narrative rendering with clearer section structure.
- Improved dialogue formatting and safer fallback rendering.
- More robust continuity for relationships, faction alignment, and protagonist state.
- Readability and layout improvements across key story screens.

### 🖼️ Providers & Media
- Improved multi-provider text/image handling.
- Stronger fallback behavior for image generation failures.
- Better SVG/icon reliability and rendering consistency.

### 🧠 AI Reliability
- Stronger JSON parsing and schema coercion.
- Additional payload validation for weaker model outputs.
- Better error handling and diagnostics for API/provider failures.

### ⚙️ Platform Notes
- Static app deployment-ready for GitHub Pages.
- PWA metadata/version aligned for release.
- User data remains local (`localStorage`) by design.
