# SupaMerge — AGENTS.md

## Stack

- **Framework**: React 19, Vite 7, TypeScript 5.9
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite` plugin)
- **Icons**: `lucide-react`
- **Utilities**: `clsx` + `tailwind-merge` (via `src/utils/cn.ts`)
- **Database**: `@supabase/supabase-js` — browser-side only, no backend

## Commands

```sh
npm run dev       # Start Vite dev server
npm run build     # Build to dist/ (single HTML file via vite-plugin-singlefile)
npm run preview   # Preview production build
```

**No test, lint, or typecheck scripts exist.** `tsconfig.json` has `noUnusedLocals`/`noUnusedParameters` — the build step surfaces these errors.

## Architecture

- **Single entrypoint**: `src/main.tsx` → `App.tsx` — the entire app lives here (776 LOC). No routing library.
- **5 tabs**: Dashboard, Sharded KV Store, Distributed DFS, Vector AI Memory, Cluster Console — switched via `activeTab` state.
- **Utilities** in `src/utils/`: consistent hashing ring (`hash.ts`), mock 384-dim embeddings (`embedding.ts`), `cn()` class merge, and a `supabaseCoordinator.ts` that mirrors App's data logic but is **not imported** (dead code).
- **Types** in `src/types.ts`: `SupabaseNode`, `KVRecord`, `FileMetadata`, `FileChunk`, `VectorMemory`, `ClusterMetrics`.

## Key Facts

- **Browser-only SPA**: No server. Supabase nodes are configured in the UI and stored in `localStorage` under `sb_live_nodes`. Each node URL + anon key is kept client-side.
- **Single-file build**: `vite-plugin-singlefile` inlines all assets into one HTML file.
- **Supabase tables expected**: `unified_kv`, `unified_chunks`, `unified_vector`. Vector search requires a `match_unified_vectors` RPC function in each Supabase project.
- **Path alias**: `@/*` maps to `src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

## Data Flow

1. Add Supabase projects via Cluster Console tab (stored in `localStorage`).
2. On load, app pings each node, queries all 3 tables in parallel, merges results.
3. KV writes use consistent hashing (virtual nodes=4) to pick primary + next-node replica.
4. File chunks replicate to primary + next active node.
5. Vector memory uses round-robin placement + replication to neighbor. Search is parallel fan-out across all connected nodes with client-side merge/dedup.

## Nuances

- The `supabaseCoordinator.ts` file duplicates the data access logic already in `App.tsx` and is **unused**. Do not refactor App.tsx to use it unless explicitly asked.
- `PGRST116` is treated as success (empty table, not an error).
- No authentication — each Supabase client uses `{ auth: { persistSession: false } }`.
