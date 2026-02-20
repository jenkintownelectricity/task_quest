# CLAUDE.md — Project Guide for Claude Code

## Repository Overview

This repository contains **Task Quest** — a suite of productivity and life-management tools built by and for the Lefebvre family. The primary sub-projects are:

- `task_quest/` — Original FocusQuest gamified task system for kids (HTML-based)
- `kerneladhd/` — KernelADHD personal task graph for adults with ADHD (React + TypeScript)

## KernelADHD (`kerneladhd/`)

### Tech Stack
- **Vite 7** + **React 19** + **TypeScript**
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin
- **IndexedDB** via `idb` library for offline-first storage
- **Lucide React** for icons
- No backend — all data lives in the browser's IndexedDB

### Development Commands
```bash
cd kerneladhd
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npx tsc --noEmit     # Type-check without emitting
```

### Key Architectural Decisions

1. **Inline styles over CSS classes**: Most components use inline styles with theme colors from `src/utils/theme.ts`. This enables dynamic theming without CSS variable gymnastics. Only base reset, responsive breakpoints, and animations are in `src/index.css`.

2. **React Context + useReducer**: State management is in `src/store/context.tsx` with a single reducer. No external state library. The `useApp()` hook provides typed access to state and all action creators.

3. **IndexedDB with `idb`**: The storage layer in `src/store/db.ts` wraps IndexedDB with promises. Object stores use `$lds.id` as key paths for tasks and routines. The DB auto-seeds on first load from `src/data/seed.ts`.

4. **LDS Kernel Format**: Every entity has a `$lds` metadata block. Content integrity is enforced via SHA-256 hashing of canonicalized JSON (`src/utils/canonical.ts`). The audit log is append-only — entries are never updated or deleted.

5. **Graph View uses Canvas**: The graph view (`src/components/GraphView.tsx`) renders on an HTML5 canvas with a simple force-directed layout computed in a useMemo. Not using a graph library to keep the bundle small.

### Data Model

- **Tasks** have: title, description, status, energy (low/med/high), importance (important/optional/someday), micro_steps[], tags[], dates, recurring config
- **Edges** connect tasks: depends_on, blocks, related_to, part_of, scheduled_after
- **Routines** group tasks by time of day
- **Audit entries** log every mutation with timestamp and details

### File Organization
```
src/
├── types/kernel.ts        # All TypeScript interfaces and types
├── utils/                 # Pure utility functions (no React)
├── store/                 # State management + persistence
├── data/seed.ts           # Seed data (40 tasks, 13 edges, 5 routines)
├── components/            # React components (one per file)
├── App.tsx                # Root component + view routing
└── main.tsx               # Entry point + service worker registration
```

### UI Constraints (ADHD-Safe)
- Max 5 visible tasks in list view (configurable)
- 48px minimum touch targets
- No dense dashboards
- Progressive disclosure patterns
- 5 calm color themes with consistent palette structure

### Adding a New View
1. Create `src/components/MyView.tsx`
2. Add the view name to the `ViewType` union in `src/types/kernel.ts`
3. Add a case in the `renderView()` switch in `src/App.tsx`
4. Add a nav entry in the `navItems` array in `src/components/Layout.tsx`

### Adding a New Task Field
1. Add the field to the `Task` interface in `src/types/kernel.ts`
2. Include it in `createTask()` in `src/store/context.tsx`
3. Add the field to `TaskEditor.tsx`
4. Update seed data in `src/data/seed.ts`

## Task Quest (`task_quest/`)

### Overview
Original gamified task manager for kids — single-file HTML applications. Key files:
- `armand-quest.html` — Main quest game (140KB standalone)
- `index-lds.html` — LDS pipeline interface
- `armand-admin.html` — Admin panel
- `lds_pipeline.py` / `lds_speech_engine.py` — Python voice/LDS tools

### No Build Step
These are self-contained HTML files. Open directly in a browser.

## Git Conventions
- Branch names: `claude/<feature>-<sessionId>`
- Commit messages: imperative mood, descriptive body
- Never force-push without explicit permission
- Keep commits atomic — one logical change per commit
