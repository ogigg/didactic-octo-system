# PROJECT.md

## Overview

`workout` is a mobile-first AI workout app for people across a wide range of training experience who want the app to handle workout planning for them.

The product's core promise is simple: let the user define their training preferences, open the app, and train the workout that has already been generated for them without needing to think through session planning every time.

## Current Stage

The app is in `early product expansion` after the MVP phase.

That means the core loop already exists, and current work should primarily deepen that loop rather than widen the product surface area without a strong reason.

## Target User

The primary user includes both people just starting out and people who have trained consistently for a long time, but who share the same core need:

- they want training direction without having to manually design each session
- they want workouts to reflect their preferences, goals, and constraints
- they want the app to reduce planning overhead while keeping execution straightforward
- they want enough trust in the generated workout that they can open the app and start training

## Core Product Loop

The product should be reasoned about as one connected training loop:

1. User completes onboarding and training setup.
2. The app generates or prepares the next workout from goals, preferences, and history.
3. The user performs the workout with clear in-session guidance and lightweight logging.
4. The app captures performance, feedback, and completion state reliably.
5. That data informs the next workout so progression feels continuous.

When making product or implementation decisions, prefer improvements that strengthen this loop end to end.

## Product Principles

Use these principles when making tradeoffs:

- `Adherence over novelty`: favor features that help users show up and complete workouts over impressive but distracting additions.
- `Low planning overhead`: users should spend their energy training, not configuring or second-guessing the plan.
- `Preferences should matter`: generated workouts should reflect meaningful user preferences without turning setup into a burden.
- `Safety over cleverness`: workout suggestions and progression logic should be conservative, explainable, and validated.
- `Continuity matters`: generation, logging, summaries, and future recommendations should feel like one connected system.
- `Fast in-session UX`: once a workout starts, the experience should feel immediate and resilient.
- `Mobile-first realism`: optimize for short interactions, interrupted sessions, and one-handed use on a phone.

## Current Priorities

Until the roadmap says otherwise, default to work that improves one or more of these areas:

- workout generation quality and reliability
- in-session execution experience
- workout logging speed and resilience
- progression continuity between sessions
- product polish that makes the app feel calmer, clearer, and more trustworthy

## Non-Goals

These may change later, but they should not be the default direction right now:

- social or community features
- gamification for its own sake
- broad platform expansion not tied to the mobile experience
- AI features that add conversation without improving training outcomes
- complexity that mainly serves edge cases instead of improving the main training flow

## Guidance For AI Agents

If you are making changes in this repository:

- start from the current user journey, not from isolated technical opportunities
- preserve the distinction between `historical MVP requirements` and the `current product direction`
- prefer existing patterns and focused changes over broad refactors
- avoid introducing abstractions unless they clearly improve the core training loop or local maintainability
- if a request conflicts with this document and there is no newer planning artifact, ask for clarification instead of guessing

## Source Of Truth

- `PROJECT.md` is the living source of product and execution context.
- `AGENTS.md` is the canonical agent-facing working guide for this repository.
- `.ai/prd.md` is the historical MVP PRD and should be treated as background context, not the current product plan.

## Related Docs

- `README.md` for repo entrypoint and setup
- `AGENTS.md` for agent instructions and repo conventions
- `.ai/prd.md` for original MVP requirements
- `.ai/architecture.md` for system architecture
- `.ai/tech-stack.md` for stack overview
- `apps/mobile/README.md` for mobile-specific development notes
