# Project Documentation

> **Document status:** Current index
> **Purpose:** Provide one entry point to product, architecture, engineering, and design documentation.
> **Last reviewed:** 2026-08-18

This repository uses the [arc42](https://docs.arc42.org/home/) structure to
organize architecture knowledge. Existing source documents remain canonical;
this index maps them into arc42 instead of duplicating their content.

## Table Of Contents

- [Start Here](#start-here)
- [Architecture: arc42 Map](#architecture-arc42-map)
- [Design And UI Standards](#design-and-ui-standards)
- [Engineering And Operations](#engineering-and-operations)
- [Plans And Historical Material](#plans-and-historical-material)
- [Documentation Standards](#documentation-standards)

## Start Here

| Need                                            | Source                                              |
| ----------------------------------------------- | --------------------------------------------------- |
| Current product direction and execution context | [`PROJECT.md`](../PROJECT.md)                       |
| Agent and contributor working agreements        | [`AGENTS.md`](../AGENTS.md)                         |
| Mobile development setup                        | [`apps/mobile/README.md`](../apps/mobile/README.md) |
| Planning and reference document roles           | [`.ai/README.md`](../.ai/README.md)                 |
| Documentation writing rules                     | [`documentation-guide.md`](documentation-guide.md)  |

## Architecture: arc42 Map

The map follows arc42's twelve sections. A section may point into an existing
document when that document is already the best source of truth.

| #   | arc42 section            | Coverage | Current source                                                                                                                    |
| --- | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Introduction and goals   | Current  | [`PROJECT.md`](../PROJECT.md); historical background in [`.ai/prd.md`](../.ai/prd.md)                                             |
| 2   | Architecture constraints | Current  | [`AGENTS.md`](../AGENTS.md); [`.ai/tech-stack.md`](../.ai/tech-stack.md)                                                          |
| 3   | Context and scope        | Current  | [`.ai/architecture.md`](../.ai/architecture.md#main-system-boundaries)                                                            |
| 4   | Solution strategy        | Current  | [`.ai/architecture.md`](../.ai/architecture.md#current-architecture-summary)                                                      |
| 5   | Building block view      | Partial  | [`.ai/architecture.md`](../.ai/architecture.md#main-system-boundaries); [repository structure](../README.md#repository-structure) |
| 6   | Runtime view             | Partial  | [`.ai/architecture.md`](../.ai/architecture.md#primary-data-flows)                                                                |
| 7   | Deployment view          | Current  | [Running and releasing the mobile app](../project-wiki/guides/running-and-releasing-mobile-app.md)                                |
| 8   | Cross-cutting concepts   | Current  | [Database schema](../.ai/db-schema.md), [internationalization](../.ai/i18n.md), and [UI style guide](style-guide.md)              |
| 9   | Architecture decisions   | Partial  | No dedicated ADR index yet; relevant design context exists in [`superpowers/specs`](superpowers/specs/)                           |
| 10  | Quality requirements     | Partial  | Product priorities in [`PROJECT.md`](../PROJECT.md); test conventions in [`apps/mobile/README.md`](../apps/mobile/README.md)      |
| 11  | Risks and technical debt | Partial  | Current concerns in [`PROJECT.md`](../PROJECT.md); add durable risks to the relevant focused document                             |
| 12  | Glossary                 | Deferred | Domain terms should be defined close to their canonical model until a shared glossary is needed                                   |

Do not create empty documents merely to fill an arc42 section. Add a focused
document when the missing knowledge is useful and can be maintained.

## Design And UI Standards

- [UI style guide](style-guide.md)
- [Bottom sheets and modals](styles/bottom-sheets.md)
- [Detailed tokens and component patterns](../.ai/ui-guidelines.md)
- [Internationalization](../.ai/i18n.md)

## Engineering And Operations

- [Mobile app development](../apps/mobile/README.md)
- [Running and releasing the mobile app](../project-wiki/guides/running-and-releasing-mobile-app.md)
- [Publishing to TestFlight via CLI](skills/publish-to-testflight.md)
- [Database schema](../.ai/db-schema.md)
- [Technology stack](../.ai/tech-stack.md)

## Plans And Historical Material

- [`docs/superpowers/specs`](superpowers/specs/) contains feature design records.
- [`docs/superpowers/plans`](superpowers/plans/) contains implementation plans.
- [`.ai/prd.md`](../.ai/prd.md) is historical MVP context, not current product direction.

Plans describe intended work at a point in time. Verify the current code before
treating a plan as implemented behavior.

## Documentation Standards

Follow the [Documentation Writer Guide](documentation-guide.md) for document
placement, status labels, style, links, maintenance, and review requirements.
