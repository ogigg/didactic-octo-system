# Documentation Writer Guide

> **Document status:** Current standard
> **Purpose:** Keep project documentation consistent, trustworthy, and maintainable for people and models.
> **Last reviewed:** 2026-08-18

## Table Of Contents

- [Principles](#principles)
- [Source Of Truth](#source-of-truth)
- [Where Documents Belong](#where-documents-belong)
- [Required Document Shape](#required-document-shape)
- [Writing Style](#writing-style)
- [Links, Code, And Diagrams](#links-code-and-diagrams)
- [Workflow For Writers And Models](#workflow-for-writers-and-models)
- [Definition Of Done](#definition-of-done)

## Principles

1. Document durable knowledge that helps someone make or verify a decision.
2. Prefer one canonical source with links over repeated explanations.
3. Describe current behavior as current, planned behavior as planned, and old
   behavior as historical.
4. Verify implementation details against the repository before documenting
   them.
5. Update relevant documentation in the same change as behavior, setup,
   architecture, database, or workflow changes.
6. Keep documentation proportional. Do not create placeholders or empty arc42
   sections solely for completeness.

## Source Of Truth

When documents conflict, use this order:

1. `PROJECT.md` for current product intent and execution context.
2. `AGENTS.md` for contributor and agent working agreements.
3. Focused current standards under `docs/`, `.ai/`, or `project-wiki/`.
4. The current implementation and migrations for exact technical behavior.
5. Historical PRDs, plans, and design records for background only.

Correct or clearly label stale documentation when a conflict is discovered.
Do not silently copy the stale statement into a new document.
When code and a standard disagree, determine whether the implementation is
wrong or the standard is stale before changing either one.

## Where Documents Belong

| Content                                                       | Location               |
| ------------------------------------------------------------- | ---------------------- |
| Documentation index and arc42 map                             | `docs/README.md`       |
| Cross-cutting UI/component standards                          | `docs/styles/`         |
| Product direction and active priorities                       | `PROJECT.md`           |
| Agent/contributor rules                                       | `AGENTS.md`            |
| Architecture, stack, schema, i18n, and detailed UI references | `.ai/`                 |
| Operational runbooks                                          | `project-wiki/guides/` |
| Feature design records and implementation plans               | `docs/superpowers/`    |

Use the [arc42 map](README.md#architecture-arc42-map) for architecture
knowledge. Add a focused document and link it from the relevant arc42 section;
do not reorganize working sources merely to match section numbers.

Use lower-case kebab-case filenames. Choose a name based on the subject, not a
ticket number or author.

## Required Document Shape

Every durable guide or reference begins with:

```md
# Clear Document Title

> **Document status:** Current standard | Current reference | Draft | Historical
> **Purpose:** One sentence describing what decision or task this document supports.
> **Last reviewed:** YYYY-MM-DD
```

Add a table of contents when a document has several sections or is likely to
grow. Begin with scope or context, then put the most actionable guidance before
background detail.

## Writing Style

- Write short, direct sentences in present tense.
- Use headings that describe the reader's task or question.
- Use lists for rules and steps; use tables for comparisons and mappings.
- Define unfamiliar domain terms on first use.
- Use `must` for requirements, `should` for strong defaults, and `may` for
  optional choices.
- Include the reason when a rule is surprising or protects against a known
  failure mode.
- Avoid promotional language, vague claims, and speculative future designs.
- Keep examples minimal but runnable or structurally accurate.

## Links, Code, And Diagrams

- Use relative Markdown links for repository files.
- Link to the canonical document or source file at the first useful mention.
- Check headings and paths after renaming a file or section.
- Use fenced code blocks with a language identifier.
- Keep commands copyable and state the directory from which they run.
- Use Mermaid or a small text diagram only when it explains relationships more
  clearly than prose. Add a short explanation because diagrams can become stale.
- Never place credentials, private user data, or production secrets in docs or
  examples.

## Workflow For Writers And Models

1. Read [`docs/README.md`](README.md), `PROJECT.md`, `AGENTS.md`, and the focused
   source closest to the change.
2. Inspect current code, configuration, migrations, or commands before making
   factual claims.
3. Find the canonical document and update it. Create a new focused document only
   when the subject has a distinct audience or maintenance lifecycle.
4. Link the new or changed document from the nearest index and relevant arc42
   section.
5. Mark historical context explicitly and remove contradictory current guidance.
6. Run formatting and the checks relevant to any documented commands or code.
7. Review the diff for broken links, duplicated rules, unsupported claims, and
   unrelated changes.

Models must not infer product intent solely from historical plans. If current
intent is unclear and affects the outcome, ask rather than presenting an
assumption as a standard.

## Definition Of Done

- [ ] The document has a clear purpose, status, and review date.
- [ ] Claims were checked against current sources.
- [ ] The content has one canonical home and is linked from the appropriate index.
- [ ] Current, planned, and historical information are distinguishable.
- [ ] File links, heading links, commands, and code examples are valid.
- [ ] The relevant README, `AGENTS.md`, arc42 map, or focused index is updated.
- [ ] Formatting passes and unrelated files remain untouched.
