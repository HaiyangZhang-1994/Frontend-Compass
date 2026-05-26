# Frontend Compass Design Spec

## Product Summary

Frontend Compass is a local-first frontend onboarding dev tool. A user installs it in a React or Vue project, runs one command from the project root, and gets a local interactive web app that explains the project in human language.

The goal is not to generate a generic repository wiki. The goal is to help a new developer quickly understand a complex frontend codebase and answer practical questions about routes, pages, components, APIs, state, and reading order.

## Problem

Existing code understanding tools are often good at broad repository summaries and generic documentation, but weaker at frontend-specific onboarding:

- page to component relationships
- page to API relationships
- route discovery
- state usage across pages
- framework-aware explanation of React and Vue projects
- newcomer-oriented reading order

Most new developers do not want raw dependency graphs. They want semantic guidance:

- what this page is responsible for
- what happens when it loads
- which requests it triggers
- where to start reading if they need to change a feature
- what other files might be affected

## Product Goals

- Help a new developer understand a large React or Vue project quickly.
- Use structure as evidence, then produce semantic explanations.
- Make the local web app the primary experience.
- Let the user plug in their own OpenAI-compatible model provider.
- Keep the product local-first and lightweight enough to run from inside a normal frontend repo.

## Non-Goals

- Support every frontend framework in V1.
- Reconstruct perfect runtime behavior.
- Replace IDE navigation.
- Act as a generic AI wiki platform for any codebase.
- Depend on a hosted backend service.

## Target Users

Primary user:

- a junior or newly onboarded frontend developer joining an existing project

Secondary users:

- a senior developer preparing onboarding documentation
- a contractor trying to understand a new client codebase
- a full-stack developer entering an unfamiliar frontend repo

## Supported Frameworks in V1

React:

- Vite React
- Next.js

Vue:

- Vite Vue
- Nuxt

V1 should focus on mainstream folder layouts and common patterns, not every advanced plugin or custom macro system.

## User Workflow

1. Install Frontend Compass in a frontend project.
2. Add local configuration for an OpenAI-compatible API.
3. Run the tool from the project root.
4. The tool scans the project and builds a structured analysis.
5. The tool calls the configured model to generate semantic summaries.
6. The tool starts a local web app.
7. The user explores the project through fixed semantic pages.
8. The user optionally asks guided follow-up questions.
9. After code changes, the user triggers a manual refresh.

## Core Product Experience

The product should feel closer to a local frontend dev inspector than a wiki generator.

Important UX principles:

- browse first, chat second
- show semantic explanations before raw code details
- keep structure visible as evidence for explanations
- optimize for onboarding tasks, not abstract architecture admiration
- make it easy to jump from summary to file or component

## Information Model

Frontend Compass should unify React and Vue analysis into one intermediate model.

Main entities:

- project
- route
- page or view
- component
- API call
- state unit
- directory or module
- reading guide item

Relationships:

- route -> page/view
- page/view -> component
- page/view -> API call
- page/view -> state unit
- component -> child component
- API call -> service layer or request helper
- reading guide item -> files and modules

## Main App Surfaces

### Overview

Shows:

- project summary
- detected framework
- key entry points
- major business areas
- newcomer reading sequence

### Routes / Views

Shows:

- discovered routes
- mapped pages or views
- route responsibilities
- related APIs, state, and major components

### Components

Shows:

- reusable component index
- where components are used
- notable props or responsibilities
- major leaf and container relationships

### Data / API

Shows:

- API usage index
- pages and modules that call each API
- request helper locations
- main request flows

### State

Shows:

- local versus shared state hints
- stores, hooks, or composables in use
- which pages depend on which state units

### Reading Guide

Shows:

- recommended reading order for newcomers
- suggested file paths for major features
- entry points for editing common business areas

### Ask

Shows:

- scenario-based follow-up answers
- queries grounded in the structured analysis and generated summaries
- links back to relevant pages and files

## Analysis Strategy

Frontend Compass should not rely on direct whole-repo prompting. That would be expensive and unreliable.

Instead, V1 should use a two-step approach:

1. `Structured extraction`
   Use framework-aware scanning and AST parsing to collect evidence.
2. `Semantic generation`
   Send structured evidence plus selected code snippets to the configured model to generate onboarding-friendly language.

This keeps outputs more accurate and cheaper.

## Framework-Aware Extraction

React extraction priorities:

- route and page discovery
- component boundaries
- `useState`
- `useEffect`
- custom hooks
- API call locations
- state library usage hints

Vue extraction priorities:

- `.vue` single-file component parsing
- route and page discovery
- `ref`
- `reactive`
- `computed`
- `watch`
- composables
- API call locations

## Semantic Generation Strategy

The model should not be asked to summarize the entire project at once.

Preferred flow:

1. file or feature level synthesis
2. page or module level synthesis
3. project level summary
4. newcomer reading guide
5. scenario answer generation

This bottom-up strategy should reduce vague summaries.

## LLM Integration

V1 model integration:

- OpenAI-compatible API only
- user provides `baseURL`
- user provides `apiKey`
- user selects `model`

Optional advanced settings:

- `temperature`
- `maxTokens`

This keeps V1 flexible without forcing separate provider adapters.

## Cache and Refresh

V1 should use local cache to improve repeated startup time.

Cache contents:

- file tree snapshot
- file hash or modification time
- framework detection result
- structured analysis outputs
- semantic summary outputs
- analysis metadata

Refresh flow:

1. detect changed files
2. invalidate affected entities
3. recompute only changed analysis segments where feasible
4. regenerate only impacted semantic summaries
5. update the local web app data

V1 should expose manual refresh instead of automatic watch mode.

## Risks

### Risk 1: Scope explosion

Trying to support too many frameworks or patterns in V1 will reduce quality.

Mitigation:

- keep framework scope to React and Vue only
- prioritize mainstream Vite, Next.js, Vue, and Nuxt conventions

### Risk 2: Overpromising runtime understanding

Static analysis cannot perfectly reconstruct behavior.

Mitigation:

- describe outputs as guided semantic understanding, not perfect execution replay
- label inferred relationships where confidence is lower

### Risk 3: LLM drift and hallucination

Model outputs may overstate conclusions.

Mitigation:

- anchor prompts on extracted evidence
- keep citations or source references in UI
- prefer narrower summaries over broad speculation

## Success Criteria for V1

- A new developer can launch the tool from a React or Vue project with one command.
- The tool opens a local web app without requiring a hosted backend.
- The tool produces useful page, API, and component explanations for mainstream projects.
- The newcomer reading guide feels meaningfully more useful than a raw file tree.
- Follow-up questions can point users toward relevant files and modules instead of vague prose.

## Recommended Public Positioning

Frontend Compass is a local-first onboarding dev tool for React and Vue projects. It turns routes, pages, components, APIs, and state usage into an interactive semantic map that new developers can actually use.
