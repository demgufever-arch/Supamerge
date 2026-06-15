# SupaMerge

**Pool multiple Supabase Free Tier databases into a single unified virtual cluster.**

Browser-only SPA that aggregates independent Supabase projects into a distributed system with sharded key-value storage, distributed file chunks, and vector memory search — all client-side, no backend required.

## Features

- **Sharded KV Store** — Consistent hashing (FNV-1a, 4 virtual nodes per physical node) distributes keys across databases with 2x replication.
- **Distributed File System** — Split files into chunks, distribute across nodes, download with automatic replica failover.
- **Vector AI Memory** — 384-dim mock embeddings, round-robin placement, parallel fan-out search across all nodes with client-side merge/dedup.
- **Cluster Console** — Add/remove Supabase projects, view schema health, one-click SQL setup script.

## Quick Start

```sh
npm install
npm run dev
```

Open the browser, go to the **Cluster Console** tab, add your Supabase project URLs + anon keys, then use the KV, DFS, and Vector tabs.

### Required Supabase Tables

Run the SQL from the Cluster Console's schema panel (or copy from `NodeConsole.tsx`) on each Supabase project:

- `unified_kv` — key-value shards
- `unified_chunks` — file chunk storage
- `unified_vector` — vector embeddings with pgvector
- `match_unified_vectors` — RPC function for similarity search

## Build

```sh
npm run build
```

Outputs a single `dist/index.html` (all assets inlined via `vite-plugin-singlefile`).

## Tech Stack

React 19 · Vite 7 · TypeScript 5.9 · Tailwind CSS 4 · Supabase JS · Lucide Icons

## License

MIT
