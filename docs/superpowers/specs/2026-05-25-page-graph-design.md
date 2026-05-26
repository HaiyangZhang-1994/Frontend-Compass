# Frontend Compass Page Graph Design

## Goal

Frontend Compass should help a frontend engineer who just inherited a large project understand the project flow quickly.

The first deep workflow surface should not be generic cards or repo stats. It should be a browse-first page graph that shows:

- what page opens first
- which pages can navigate to which other pages
- which navigation edges are backed by real code evidence
- what each page contains once a user clicks into it

This feature is meant to answer onboarding questions such as:

- Where does the user land first?
- Which pages are reachable from here?
- What file owns this page?
- Which components are part of this page?
- Which functions, API calls, and state hooks matter on this page?

## Product Direction

The first version should focus on:

- global page flow first
- page detail second
- only deterministic navigation edges

The feature should avoid speculative or semantic-only flow inference in V1. If a line appears on the graph, there should be direct code evidence for it.

## Recommended V1 Experience

The main application view should be reorganized around two panels:

1. a global page graph canvas
2. a page detail panel for the currently selected page

The user flow should be:

1. open Frontend Compass
2. see the full project page graph
3. click a page node
4. inspect detailed information for that page
5. use outgoing and incoming edges to continue tracing the application flow

## Scope

### In Scope

- global page graph for React, Next.js, Vue, and Nuxt projects
- one node per page or route
- deterministic navigation edges extracted from code
- page detail panel
- evidence-backed edge explanations
- page-level component, handler, API, and state summaries

### Out of Scope

- business-flow inference without code evidence
- full runtime tracing
- complicated dynamic route target reconstruction
- middleware-only or auth-guard-only inferred navigation
- freeform AI chat as the primary entry point
- advanced auto-layout engine work beyond a simple readable graph

## UX Structure

### Main Layout

- Top bar
  - project name
  - detected framework
  - cache status
  - summary source
  - refresh button
- Main graph area
  - page nodes
  - navigation edges
- Right detail panel
  - selected page details
  - navigation evidence
  - incoming and outgoing links

### Graph Nodes

Each node should display at least:

- route path
- source file
- short label

The label can default to the route path in V1 if no better title is available.

### Graph Edges

Each edge represents one deterministic navigation relationship from one page to another.

Each edge should include:

- source page
- destination page
- navigation type
- evidence snippet or evidence source

### Detail Panel

When a node is selected, the detail panel should show:

- page path
- source file
- contained components
- detected functions or handlers
- API calls
- state hooks or state signals
- outgoing navigation
- incoming navigation
- navigation evidence

## Navigation Evidence Rules

V1 should only extract navigation edges from clear string-literal patterns.

### React / Next.js

- `<Link href="/x">`
- `<a href="/x">`
- `router.push("/x")`
- `router.replace("/x")`
- `navigate("/x")`

### Vue / Nuxt

- `<NuxtLink to="/x">`
- `<RouterLink to="/x">`
- `<a href="/x">`
- `router.push("/x")`
- `navigateTo("/x")`

### Exclusions

Do not include edges from:

- variable-based target paths
- string concatenation or template expressions with unknown runtime values
- conditional targets that cannot be resolved statically
- redirects inferred from backend responses
- semantic guesses from the language model

## Data Model

The current `routes[]` payload is too shallow for this workflow. V1 should add a page-graph-specific model.

### Page Graph Node

Each node should contain:

- `id`
- `path`
- `file`
- `label`

### Page Graph Edge

Each edge should contain:

- `from`
- `to`
- `type`
- `evidence`

Suggested `type` values:

- `link`
- `anchor`
- `router-push`
- `router-replace`
- `navigate`
- `navigate-to`

### Page Detail

Each page detail record should contain:

- `id`
- `path`
- `file`
- `components`
- `handlers`
- `apiCalls`
- `stateSignals`
- `incomingEdges`
- `outgoingEdges`
- `evidence`

## API Design

### `GET /api/page-graph`

Returns:

- `framework`
- `nodes`
- `edges`

This endpoint powers the global flow graph.

### `GET /api/page-details?nodeId=...`

Returns a detail payload for one selected page.

This endpoint powers the right-side detail panel.

### Existing Endpoints

Keep these:

- `/api/overview`
- `/api/meta`
- `/api/status`

They still support the top-level app shell and diagnostics.

## Analyzer Changes

### Shared Model Expansion

The shared analyzer model should expand beyond:

- `routes`
- `pages`
- `components`
- `apiCalls`
- `stateUnits`

It should also capture:

- page-level handlers
- navigation targets
- navigation evidence

### React / Next.js Analyzer Changes

Add extraction for:

- `Link` href targets
- `a` href targets
- `router.push`
- `router.replace`
- `navigate`
- likely handler names associated with those calls

### Vue / Nuxt Analyzer Changes

Add extraction for:

- `NuxtLink` targets
- `RouterLink` targets
- `a` href targets
- `router.push`
- `navigateTo`
- likely handler names associated with those calls

## UI Behavior

### First Load

On first load:

1. fetch `overview`
2. fetch `page-graph`
3. render graph
4. auto-select the best entry node

The best entry node should prefer:

- `/`
- framework home page
- first discovered route as fallback

### On Node Click

When the user clicks a node:

1. mark node active
2. fetch `page-details`
3. update the right panel

### Empty States

If no deterministic edges are found:

- still show nodes
- show a message explaining that no explicit navigation links were found yet

If the project is unsupported:

- preserve the current unsupported experience
- do not try to render a misleading graph

## Verification Plan

### Analyzer Tests

Add tests for:

- React `Link` extraction
- React `router.push` extraction
- Vue `NuxtLink` extraction
- Vue `navigateTo` extraction
- unsupported dynamic targets are ignored

### API Tests

Add tests for:

- `/api/page-graph` shape
- `/api/page-details` shape
- edge evidence inclusion

### UI Tests

Add tests for:

- graph payload renders nodes
- clicking a node switches detail content
- detail panel shows incoming and outgoing navigation
- evidence list is visible for selected node

## Success Criteria

This feature is successful if a new frontend engineer can:

- open the app and see the project's top-level page map
- identify the first page and major navigation branches
- click a page and understand what it contains
- trace where that page can send the user next
- inspect direct evidence for each navigation edge

## Recommendation

Implement V1 as:

- a global page graph
- with deterministic edges only
- plus a page detail panel

This is the highest-value next surface for Frontend Compass because it turns the product from a summary dashboard into an onboarding map that matches how people actually learn a frontend application.
