# Dev Rules v1.0 (High Priority)

## 1. Logging (Mandatory)
Format: `[Module][Type] Message`
- Types: [UI] (clicks/inputs), [API] (fetch params/results), [State] (provider/modal switches).
- Errors: `console.error` + Sync to UI status area.

## 2. Refactoring & Safety
- **Anti-Destruction**: NEVER remove existing UI (Test/Save/Close buttons, Status areas) when converting static HTML to JS.
- **Dynamic Bind**: Use `providerId` for dynamic element IDs & listeners.
- **Safe Code**: 
  - `async/await` must use `try-catch`.
  - Validate `JSON.parse(localStorage)`.
  - `removeEventListener` before deleting dynamic elements.

## 3. UI/UX Logic
- **Confirmation**: Required for Deleting (Provider/Model) or Closing unsaved panels.
- **Context First**: Analyze local files before assuming Git history.

## 4. Environment
- Node 20-alpine, Docker, `nodemon --legacy-watch`.
- DO NOT modify `.dockerignore` (keep `node_modules/` and `DL/` ignored).