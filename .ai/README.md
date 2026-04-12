# .ai Docs Index

> **Document status:** Reference document
> **Purpose:** Explain the role of each document in `.ai` and which ones should be trusted for which type of decision.
> **Last reviewed:** 2026-04-11

## How To Use This Folder

This folder contains product planning, architecture, and reference documents created across different phases of the project.

Not every file here has the same role:

- some are current reference documents
- some are historical artifacts
- some are narrower implementation guides

When in doubt:

1. Use `../PROJECT.md` for the current product and execution context.
2. Use `../AGENTS.md` for canonical agent-facing working guidance.
3. Use the documents below for deeper reference in their specific domain.

## Document Roles

### `prd.md`

- **Document status:** Historical artifact
- **Use it for:** Original MVP scope, assumptions, and acceptance context
- **Do not use it for:** Current product direction without cross-checking `../PROJECT.md`

### `roadmap.md`

- **Document status:** Reference document
- **Use it for:** Historical MVP delivery plan and current post-MVP priority themes
- **Do not use it for:** Fine-grained implementation sequencing unless it has been updated recently

### `architecture.md`

- **Document status:** Reference document
- **Use it for:** System structure, data flow, and boundary-level technical understanding
- **Do not use it for:** Product intent or future commitments unless explicitly labeled

### `tech-stack.md`

- **Document status:** Reference document
- **Use it for:** Current technologies in play and clearly separated future/optional tools
- **Do not use it for:** Inferring active dependencies without checking the repo when precision matters

### `db-schema.md`

- **Document status:** Reference document
- **Use it for:** Database schema design, entities, and data-model reasoning
- **Do not use it for:** Assuming every table or field definition is exact without validating against `../supabase/migrations`

### `i18n.md`

- **Document status:** Reference document
- **Use it for:** Translation workflow, naming conventions, and namespace rules
- **Do not use it for:** General product context

### `ui-guidelines.md`

- **Document status:** Reference document
- **Use it for:** Design tokens, component patterns, and UI consistency guidance
- **Do not use it for:** Current roadmap or implementation priorities

## Trust Order

If documents appear to conflict, prefer this order:

1. `../PROJECT.md`
2. `../AGENTS.md`
3. focused reference docs in `.ai/`
4. historical artifacts such as `prd.md`
