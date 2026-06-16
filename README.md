<div align="center">
  <br />
  <img src="https://raw.githubusercontent.com/demgufever-arch/Supamerge/main/src/assets/logo.png" alt="SupaMerge" width="120" style="border-radius: 24px;" />
  <br />
  <br />
  <img src="https://img.shields.io/badge/React-19-10b981?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-7-10b981?logo=vite" alt="Vite 7" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-10b981?logo=typescript" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/Tailwind-4-10b981?logo=tailwindcss" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/license-MIT-10b981" alt="MIT License" />
  <br />
  <br />
  <p align="center"><strong>by Parithosh Varma</strong></p>
  <br />
  <h1 align="center" style="border-bottom: none;">SupaMerge</h1>
  <h3 align="center">Unify Your Supabase Databases</h3>
  <p align="center">
    Unify multiple Supabase projects into a single virtual cluster —<br />
    shard KV data, distribute file storage, and merge AI vector memories across nodes.
  </p>
  <br />
  <p align="center">
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#design-system">Design System</a>
  </p>
  <br />
</div>

---

## Overview

SupaMerge is a **browser-only SPA** that aggregates independent Supabase databases into a distributed system. No backend server — your API keys stay in `localStorage`, never transmitted to third parties.

The app has **two phases**: a full marketing landing page (hero, features grid, how-it-works, CTA) that introduces the product, and the actual tool interface (sidebar + tab layout) for managing the cluster.

## Features

| | Feature | Description |
|---|---|---|
| 🔑 | **Sharded KV Store** | Consistent hashing (FNV-1a, 4 virtual nodes per physical node) distributes keys across databases with 2x replication. |
| 📁 | **Distributed File System** | Split files into chunks, spread across nodes for fault-tolerant storage. Automatic replica failover on download. |
| 🧠 | **Vector AI Memory** | 384-dim embeddings (deterministic mock), round-robin placement, parallel fan-out search across all nodes with client-side merge/dedup. |
| 🖥️ | **Cluster Console** | Add/remove Supabase projects, real-time health checks, latency monitoring, one-click SQL setup. |
| 🛡️ | **Browser-Only Privacy** | No backend. Your keys and data stay in your browser. Inlined single-file build for easy deployment. |

## Quick Start

```sh
git clone https://github.com/demgufever-arch/Supamerge.git
cd Supamerge
npm install
npm run dev
```

Open `http://localhost:5173`, and you'll see the **SupaMerge landing page**. Click **"Launch Dashboard"** to enter the cluster management interface, then go to the **Cluster Console** tab to add your Supabase projects.

### Required Supabase Schema

Run this SQL in **each** Supabase project's SQL Editor:

<details>
<summary>Click to expand SQL setup</summary>

```sql
-- Key-value store
CREATE TABLE IF NOT EXISTS unified_kv (
  key TEXT PRIMARY KEY,
  value JSONB,
  tags TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File chunk storage
CREATE TABLE IF NOT EXISTS unified_chunks (
  chunk_id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT,
  chunk_index INT,
  total_chunks INT,
  data TEXT,
  size_bytes BIGINT
);

-- Vector memory (requires pgvector extension)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS unified_vector (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT,
  embedding VECTOR(384),
  metadata JSONB DEFAULT '{}'
);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_unified_vectors(
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM unified_vector
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

</details>

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build to `dist/index.html` (single inlined file, ~900 KB) |
| `npm run preview` | Preview production build |
| `npm run test` | Run vitest smoke tests |

> `tsconfig.json` enforces `noUnusedLocals` / `noUnusedParameters` — the build step surfaces these errors.

## Architecture

```
src/
├── main.tsx                          # Entry point (StrictMode + ErrorBoundary)
├── App.tsx                           # Two-phase UI + cluster orchestration
├── App.test.tsx                      # Smoke tests (vitest)
├── index.css                         # Tailwind + custom animations + glass utilities
├── types.ts                          # All TypeScript interfaces
├── components/
│   ├── LandingPage.tsx               # Marketing site (hero, features, how-it-works, CTA)
│   ├── ErrorBoundary.tsx             # Render crash handler
│   ├── Dashboard.tsx                 # Cluster topology overview
│   ├── KVStore.tsx                   # Sharded key-value management
│   ├── FileSharding.tsx              # Distributed file upload/download
│   ├── VectorMemory.tsx              # Vector memory search + 2D projection map
│   ├── NodeConsole.tsx               # Add/remove nodes, schema health
│   └── ui/                           # shadcn/ui primitives (Button, Card, Input, etc.)
├── utils/
│   ├── hash.ts                       # Consistent hashing ring (FNV-1a)
│   └── embedding.ts                  # Deterministic 384-dim mock embeddings
└── lib/
    └── utils.ts                      # cn() class merge utility
```

### Data Flow

1. **Add Supabase projects** via the Cluster Console — stored in `localStorage` under `sb_live_nodes`.
2. **On load**, the app pings every node, queries all 3 tables in parallel, merges results client-side.
3. **KV writes** use consistent hashing to pick a primary node + replica.
4. **File chunks** replicate to the primary + next active node.
5. **Vector memory** uses round-robin placement across nodes with neighbor replication. Search is a parallel fan-out with client-side dedup.

## Design System

| Token | Value |
|---|---|
| Canvas | `#020617` (deep navy) — 60% |
| Surfaces | `#070d1e` — 30% |
| Accent | `#10b981` (emerald) — 10% |
| Spacing | 8px grid (`p-2`, `p-4`, `p-6`, `p-8`) |
| Radius | 8px controls, 12px cards |
| Borders | `border-slate-800/60` |
| Shadows | Layered multi-stop (`0 4px 16px -4px rgba(0,0,0,0.2), ...`) |
| Font | Geist Variable (sans-serif) |
| Backgrounds | Animated mesh gradients + subtle grid pattern + noise texture |

## Tech Stack

**React 19** · **Vite 7** · **TypeScript 5.9** · **Tailwind CSS 4** · **Supabase JS** · **Lucide Icons** · **shadcn/ui** · **Geist Font** · **vitest** + **@testing-library/react**

---

<div align="center">
  Built by <strong>Parithosh Varma</strong>
  <br />
  <br />
  MIT &copy; 2026
</div>
