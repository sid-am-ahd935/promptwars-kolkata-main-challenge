# MindFlow — Mental Wellness Tracker

A production-grade, client-side Mental Wellness Tracker built with **TypeScript**, **React**, and **Vite**. Provides journal-based mental wellness tracking with deterministic sentiment analysis, crisis safety routing, episodic graph memory, and MCP mock environmental context injection.

## Features

- **Journal Companion** — Open-ended text input for daily reflections with real-time sentiment analysis
- **Crisis Safety Router** — Deterministic keyword detection that immediately surfaces emergency helpline numbers (NIMHANS, Vandrevala Foundation, iCall, AASRA)
- **Deterministic Sentiment Engine** — Rule-based keyword mapping for sentiment scoring (1-10), trigger extraction, and category assignment (Coping / Mindfulness / Encouragement)
- **Episodic Graph Memory** — Relational map: `[Trigger] → (creates) → [Emotion] → (affects) → [SentimentScore]` visualized as an interactive SVG node-link diagram
- **MCP Mock Context** — Simulated Model Context Protocol service injecting environmental data (upcoming exam schedule) from a static `study_logs.json`
- **Analytics Dashboard** — SVG sentiment trend charts, trigger frequency analysis, and filtering by category and date range
- **Accessibility** — Semantic HTML5, ARIA labels, `aria-live` regions, keyboard navigation, and high-contrast crisis card

## Architecture

```
src/
├── types/wellness.ts          # Domain data models & state interfaces
├── utils/
│   ├── safetyRouter.ts        # Crisis keyword detection (pure function)
│   ├── analytics.ts           # Deterministic sentiment/trigger parser
│   └── mcpSync.ts             # MCP mock service + episodic graph logic
├── hooks/useWellnessState.ts  # Central state management (useCallback/useMemo)
├── components/
│   ├── AppShell.tsx           # Root layout with dual-tab navigation
│   ├── JournalView.tsx        # Text input + entry list + crisis card
│   ├── CrisisCard.tsx         # Emergency helpline display
│   ├── AnalyticsDashboard.tsx # Summary cards + filters + charts
│   ├── SentimentChart.tsx     # SVG trend line visualization
│   └── ContextGraph.tsx       # Episodic graph + MCP context table
└── __tests__/
    ├── safetyRouter.test.ts   # 24 unit tests
    ├── analytics.test.ts      # 22 unit tests
    └── mcpSync.test.ts        # 17 unit tests
```

## Quick Start

```bash
npm install
npm run dev
```

## Testing

```bash
npx vitest run        # Run all 63 unit tests
npx tsc --noEmit      # Type-check
npm run build         # Production build
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Testing | Vitest + jsdom |
| Styling | Vanilla CSS (dark mode, glassmorphism) |
| Charts | Native SVG rendering |
| Font | Inter (Google Fonts) |
