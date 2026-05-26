# Frontend Compass

Frontend Compass is a local-first onboarding tool for React and Vue projects.  
It builds a page graph, shows route relationships, and lets developers click evidence to jump straight to code in VS Code or Cursor.

## Features

- Global page graph with deterministic navigation edges
- Page detail panel with:
  - component/handler tree
  - incoming/outgoing routes
  - navigation evidence
- Click-to-open code in IDE (line-aware)
- Manual analysis start with selectable granularity
- Local cache for faster repeated analysis

## Requirements

- Node.js `>=20`
- npm

## Install

```bash
npm install
```

## Run

```bash
npm run dev -- --project <your-frontend-project-root>
```

Example:

```bash
npm run dev -- --project C:\Users\Haiyang\Desktop\birding-copilot\web
```

Then open:

`http://localhost:4411`

## Analysis Granularity

When the app opens, analysis does **not** start automatically.  
Choose a granularity and click **Start Analysis**.

### 1) Local Only (No AI)

- Pure static local analysis
- No provider/API request
- Fastest and cheapest mode

### 2) File Level (Layered AI)

- Uses local structure extraction first
- Allows AI-enhanced summary layer when provider is configured
- Better semantic guidance with moderate cost

## Configure Your API Key

Create `frontend-compass.config.json` in the tool root (same folder as this `README`):

```json
{
  "provider": {
    "baseURL": "https://your-openai-compatible-endpoint/v1",
    "apiKey": "your-api-key",
    "model": "your-model-name"
  }
}
```

You can copy from:

- `frontend-compass.config.example.json`

If no provider is configured, Local analysis still works.

## Notes

- For monorepos/fullstack repos, pass the **frontend app subfolder** as `--project`.
- If `package.json` is missing at the selected root, the app returns a clear error and stops loading cleanly.

## Scripts

```bash
npm run dev
npm test
npm run typecheck
```

