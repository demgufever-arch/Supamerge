# SupaMerge — AGENTS.md

## Stack

- **Framework**: React 19, Vite 7, TypeScript 5.9
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite` plugin)
- **Icons**: `lucide-react`
- **UI Components**: shadcn/ui (`@/components/ui/`) — Button, Card, Input, Badge, Select, Table, Tabs, Textarea, Dialog
- **Utilities**: `clsx` + `tailwind-merge` (via `src/lib/utils.ts`)
- **Database**: `@supabase/supabase-js` — browser-side only, no backend
- **Font**: Geist Variable (`@fontsource-variable/geist`)
- **Tests**: vitest 4 + `@testing-library/react` + jsdom

## Commands

```sh
npm run dev       # Start Vite dev server
npm run build     # Build to dist/ (single HTML file via vite-plugin-singlefile)
npm run preview   # Preview production build
npm run test      # Run vitest smoke tests (headless)
```

`tsconfig.json` has `noUnusedLocals`/`noUnusedParameters` — the build step surfaces these errors.

## Architecture

- **Entrypoint**: `src/main.tsx` → wraps App in `<StrictMode>` + `<ErrorBoundary>`
- **Landing page** (`src/components/LandingPage.tsx`): full marketing site shown first — navbar, hero, 6 feature cards, how-it-works steps, CTA section. User clicks "Launch Dashboard" to enter the app.
- **App** (`src/App.tsx`): sidebar + tab layout with 5 tabs (Dashboard, KV Store, DFS, Vector Memory, Cluster Console). No routing library.
- **ErrorBoundary** (`src/components/ErrorBoundary.tsx`): catches render crashes with a styled error screen + reload button.
- **Utilities** in `src/utils/`: consistent hashing ring (`hash.ts`), mock 384-dim embeddings (`embedding.ts`).
- **Types** in `src/types.ts`: `SupabaseNode`, `KVRecord`, `FileMetadata`, `FileChunk`, `VectorMemory`, `ClusterMetrics`.
- **Tests** in `src/App.test.tsx`: 3 smoke tests verifying landing page renders.

## Key Facts

- **Two-phase UI**: Landing page (marketing) → App (tool). Toggle via `showLanding` state + `?` header button.
- **Browser-only SPA**: No server. Supabase nodes are configured in the UI and stored in `localStorage` under `sb_live_nodes`. Each node URL + anon key is kept client-side.
- **Single-file build**: `vite-plugin-singlefile` inlines all assets into one HTML file (~1.25 MB raw, ~570 KB gzipped).
- **Supabase tables expected**: `unified_kv`, `unified_chunks`, `unified_vector`. Vector search requires a `match_unified_vectors` RPC function in each Supabase project.
- **Path alias**: `@/*` maps to `src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

## Data Flow

1. Add Supabase projects via Cluster Console tab (stored in `localStorage`).
2. On load, app pings each node, queries all 3 tables in parallel, merges results.
3. KV writes use consistent hashing (virtual nodes=4) to pick primary + next-node replica.
4. File chunks replicate to primary + next active node.
5. Vector memory uses round-robin placement + replication to neighbor. Search is parallel fan-out across all connected nodes with client-side merge/dedup.

## Design System

- **Aesthetic**: Sleek Dark Mode with Swiss design influence
- **Color ratio**: 60% deep navy canvas (`#020617`), 30% structural surfaces (`#070d1e`), 10% emerald accent (`#10b981`)
- **Spacing**: 8px grid (p-2, p-4, p-6, p-8 — never p-3/p-5/p-7)
- **Borders**: `border-slate-800/60` with subtle opacity
- **Shadows**: Layered multi-stop: `0 4px 16px -4px rgba(0,0,0,0.2), 0 2px 8px -2px rgba(0,0,0,0.15)`
- **Border radius**: 8px (rounded-lg) controls, 12px (rounded-xl) cards
- **Backgrounds**: `bg-mesh` (animated radial gradients), `bg-grid` (subtle grid pattern), `bg-noise` (texture overlay)

## Nuances

- `PGRST116` is treated as success (empty table, not an error).
- No authentication — each Supabase client uses `{ auth: { persistSession: false } }`.
- KV value type is `unknown` (not `any`) — cast when consuming.
- Mock embeddings are deterministic (not ML-backed) — intentional for demo purposes.
