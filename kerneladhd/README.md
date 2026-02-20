# KernelADHD — Personal Task Graph

A calm, personal-first ADHD task system that models life as a simple deterministic graph. Built with React + TypeScript, offline-first, PWA-ready.

## Design Principles

- **Simple first, power later** — no setup paralysis
- **One task visible by default** — Focus View shows a single task at a time
- **Everything connected, nothing cluttered** — task graph with relationships
- **AI suggests, never commands** — optional AI assist that never auto-completes or auto-deletes
- **ADHD-safe UI** — max 5 visible tasks, progressive disclosure, large touch targets, calm palette

## Quick Start

```bash
cd kerneladhd
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

```
kerneladhd/
├── public/
│   ├── favicon.svg           # App icon
│   ├── manifest.json         # PWA manifest
│   └── sw.js                 # Service worker (offline support)
├── src/
│   ├── types/
│   │   └── kernel.ts         # LDS kernel types, task model, audit types
│   ├── utils/
│   │   ├── canonical.ts      # Stable JSON canonicalization + SHA-256 hashing
│   │   ├── audit.ts          # Append-only audit entry factory
│   │   └── theme.ts          # 5 ADHD-safe color palettes
│   ├── store/
│   │   ├── db.ts             # IndexedDB storage layer (offline-first)
│   │   └── context.tsx       # React context + reducer (full CRUD)
│   ├── data/
│   │   └── seed.ts           # 40 seeded tasks, 13 edges, 5 routines
│   ├── components/
│   │   ├── Layout.tsx        # App shell + responsive nav
│   │   ├── ListView.tsx      # Daily task list (default view)
│   │   ├── FocusView.tsx     # Single-task zero-distraction mode
│   │   ├── GraphView.tsx     # Canvas node graph with force layout
│   │   ├── TimelineView.tsx  # Time-based task layout
│   │   ├── HistoryView.tsx   # Completed tasks, stats, patterns
│   │   ├── TaskCard.tsx      # Reusable task card with micro-steps
│   │   ├── TaskEditor.tsx    # Create/edit modal
│   │   ├── AIAssist.tsx      # AI assistant panel (Groq/Anthropic/OpenAI)
│   │   ├── AudioSummary.tsx  # One-tap audio summary (Web Speech API)
│   │   └── Settings.tsx      # Theme, display, AI config, data management
│   ├── App.tsx               # Root component + view router
│   ├── main.tsx              # Entry point + SW registration
│   └── index.css             # Base styles + Tailwind + responsive breakpoints
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Core Concepts

### LDS Kernel Model

All data is encoded as deterministic kernels in `.lds.json` format:
- Every entity has a `$lds` metadata block with version, type, ID, timestamps, and `content_hash`
- Content hash is computed via stable JSON canonicalization + SHA-256
- All mutations are recorded in an append-only audit log

### Task Graph

Tasks are nodes in a graph with typed relationships:

| Edge Type | Meaning |
|-----------|---------|
| `blocks` | Source must complete before target can start |
| `depends_on` | Source depends on target |
| `related_to` | Loosely connected tasks (dashed line in graph) |
| `part_of` | Source is a sub-task of target |
| `scheduled_after` | Source should be done after target |

### Energy & Importance

Each task has:
- **Energy**: `low` / `medium` / `high` — how much effort it takes
- **Importance**: `important` / `optional` / `someday` — priority level

## Views

### List View (Default)
Daily task list sorted by importance and due date. Shows max 5 tasks by default with a "show more" button. Filter by tag or energy level.

### Focus View
One task at a time. Shows micro-steps as large checkable buttons. Celebration animation on completion. "Skip for now" defers without guilt.

### Graph View
Interactive canvas rendering of connected tasks. Force-directed layout with zoom/pan. Color-coded edges by relationship type.

### Timeline View
Tasks grouped by day: Overdue, Today, upcoming days, and Unscheduled. Visual timeline with dot markers.

### History View
Completion stats (total, avg/day, streak), daily bar chart, category breakdown, and full chronological log of completed tasks.

## Features

### AI Assist
Floating assistant panel with quick actions:
- "What should I do next?" — energy-aware priority suggestion
- "Break down a task" — micro-step generation
- "Daily summary" — encouraging overview
- "Motivation nudge" — gentle restart prompt

Supports **Groq** (fast, default), **Anthropic** (Claude), and **OpenAI**. Set your API key in Settings. Keys are stored locally only.

### Audio Summary
One-tap button in the header reads today's task summary aloud via Web Speech API. Includes pending count, top priority, and low-energy options.

### Data Management
- **Export**: Full kernel backup as `.lds.json` file
- **Import**: Restore from any `.lds.json` export
- **Audit Log**: View all recorded actions (task created, edited, completed, AI suggestions accepted/rejected)

### Themes
Five ADHD-safe color palettes:
- **Calm** — muted greens and warm neutrals (default)
- **Ocean** — blue-teal with sandy accents
- **Forest** — deep greens
- **Sunset** — warm terracotta tones
- **Midnight** — dark mode with soft purple accents

## ADHD-Safe UI Rules

- Max 5 visible tasks by default (configurable 3-10)
- No dense dashboards on load
- Progressive disclosure only
- Large touch targets (48px+ minimum)
- High contrast, calm color palette
- Smooth transitions, no jarring animations

## Seed Data

The app comes pre-loaded with realistic data for immediate exploration:
- **30 active tasks** across health, work, home, personal, finance categories
- **10 completed tasks** spanning the past week (for history view)
- **5 routines** (Morning Startup, Evening Wind-Down, Weekly Home Reset, Weekly Planning, Deep Work Block)
- **13 graph edges** connecting tasks with blocks, depends_on, related_to, part_of, and scheduled_after relationships
- **Audit log entries** for all completed tasks

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Vite](https://vite.dev) | Build tool + dev server |
| [React 19](https://react.dev) | UI framework |
| [TypeScript](https://www.typescriptlang.org) | Type safety |
| [Tailwind CSS 4](https://tailwindcss.com) | Utility-first CSS |
| [idb](https://github.com/nicoritschel/idb) | IndexedDB promise wrapper |
| [Lucide React](https://lucide.dev) | Icon library |
| Web Speech API | Audio summaries |
| Web Crypto API | SHA-256 content hashing |
| IndexedDB | Offline-first local storage |
| Service Worker | PWA offline caching |

## License

Personal project. All rights reserved.
