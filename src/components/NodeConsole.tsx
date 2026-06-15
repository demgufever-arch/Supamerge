import React, { useState, useEffect } from 'react';
import { SupabaseNode } from '../types';
import { createClient } from '@supabase/supabase-js';
import { Plus, Trash2, Terminal, Check, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface NodeConsoleProps {
  nodes: SupabaseNode[];
  onAddNode: (node: Omit<SupabaseNode, 'id' | 'status' | 'latency' | 'dbUsageBytes' | 'storageUsageBytes'>) => Promise<void>;
  onDeleteNode: (id: string) => void;
}

const SCHEMA_SQL = `-- 1. Enable the pgvector extension (Supabase free tier supports this out-of-the-box!)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the Key-Value Shard Table
CREATE TABLE IF NOT EXISTS public.unified_kv (
    key TEXT PRIMARY KEY,
    value JSONB,
    tags TEXT[],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create the Distributed File Chunk Table
CREATE TABLE IF NOT EXISTS public.unified_chunks (
    chunk_id TEXT PRIMARY KEY,
    file_name TEXT,
    file_type TEXT,
    chunk_index INTEGER,
    total_chunks INTEGER,
    data TEXT, -- Base64-encoded chunk binary
    size_bytes INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create the Vector Memory Table (384 dimensions for lightweight client-side models)
CREATE TABLE IF NOT EXISTS public.unified_vector (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    embedding vector(384),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Create the Vector Search Helper Function
CREATE OR REPLACE FUNCTION match_unified_vectors (
    query_embedding vector(384),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        id,
        content,
        metadata,
        1 - (unified_vector.embedding <=> query_embedding) AS similarity
    FROM unified_vector
    WHERE 1 - (unified_vector.embedding <=> query_embedding) > match_threshold
    ORDER BY unified_vector.embedding <=> query_embedding
    LIMIT match_count;
$$;`;

export default function NodeConsole({
  nodes,
  onAddNode,
  onDeleteNode,
}: NodeConsoleProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [region, setRegion] = useState('US East (N. Virginia)');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [schemaStatus, setSchemaStatus] = useState<{ [nodeId: string]: { kv: boolean; chunks: boolean; vector: boolean; checked: boolean } }>({});
  const [checkingSchema, setCheckingSchema] = useState(false);

  // Auto-check schemas when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0) {
      checkAllSchemas();
    }
  }, [nodes.length]);

  // Copy SQL Schema
  const handleCopySql = () => {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Test Node Connection
  const testNodeConnection = async (nodeUrl: string, nodeKey: string): Promise<{ success: boolean; message: string; latency?: number }> => {
    const start = performance.now();
    try {
      const cleanUrl = nodeUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: nodeKey,
          Authorization: `Bearer ${nodeKey}`,
        },
      });
      const end = performance.now();
      
      if (res.ok) {
        return {
          success: true,
          message: 'Connection Successful! Handshake complete.',
          latency: Math.round(end - start),
        };
      } else {
        return {
          success: false,
          message: `HTTP Error: Received status ${res.status}. Verify your API key is correct.`,
        };
      }
    } catch (err) {
      return {
        success: false,
        message: `Network Error: ${err instanceof Error ? err.message : 'Could not reach server.'} Ensure URL is correct and CORS is enabled.`,
      };
    }
  };

  // Add Node Form Submit
  const handleAddNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !anonKey) return;

    setIsTesting(true);
    setTestResult(null);

    const result = await testNodeConnection(url, anonKey);
    setIsTesting(false);
    setTestResult(result);

    if (result.success) {
      try {
        await onAddNode({
          name: name.trim(),
          url: url.trim(),
          anonKey: anonKey.trim(),
          region,
          dbLimitBytes: 524288000, // 500MB
          storageLimitBytes: 1073741824, // 1GB
        });
        // Clear form
        setName('');
        setUrl('');
        setAnonKey('');
        setTestResult(null);
      } catch (err) {
        setTestResult({ success: false, message: `Failed to save node: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    }
  };

  // Check Schema on Node
  const checkNodeSchema = async (node: SupabaseNode) => {
    try {
      const supabase = createClient(node.url, node.anonKey);
      
      const { error: kvError } = await supabase.from('unified_kv').select('*').limit(0);
      const kvExists = !kvError;

      const { error: chunksError } = await supabase.from('unified_chunks').select('*').limit(0);
      const chunksExists = !chunksError;

      const { error: vectorError } = await supabase.from('unified_vector').select('*').limit(0);
      const vectorExists = !vectorError;

      return {
        kv: kvExists,
        chunks: chunksExists,
        vector: vectorExists,
        checked: true,
      };
    } catch (e) {
      return { kv: false, chunks: false, vector: false, checked: true };
    }
  };

  const checkAllSchemas = async () => {
    if (nodes.length === 0) return;
    setCheckingSchema(true);
    const statuses: typeof schemaStatus = {};
    
    for (const node of nodes) {
      statuses[node.id] = await checkNodeSchema(node);
    }
    
    setSchemaStatus(statuses);
    setCheckingSchema(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-xl">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          Cluster Environment Control
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-normal">
          Connect actual Supabase free-tier REST endpoints together. Each database behaves as an individual shard in the unified cluster.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Side: Node Administration */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm space-y-4">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-1.5">
              <Plus className="h-5 w-5 text-emerald-400" />
              Add Real Supabase Node
            </h3>
            
            <form onSubmit={handleAddNodeSubmit} className="space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Node Label (Name)
                  </label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. supabase-prod-west"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Hosting Region
                  </label>
                    <Input
                      type="text"
                      list="supabase-regions"
                      placeholder="e.g. us-east-1, eu-central-1..."
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    />
                  <datalist id="supabase-regions">
                    <option value="us-east-1 (N. Virginia)" />
                    <option value="us-west-1 (N. California)" />
                    <option value="us-west-2 (Oregon)" />
                    <option value="ca-central-1 (Canada Central)" />
                    <option value="eu-west-1 (Ireland)" />
                    <option value="eu-west-2 (London)" />
                    <option value="eu-west-3 (Paris)" />
                    <option value="eu-central-1 (Frankfurt)" />
                    <option value="ap-southeast-1 (Singapore)" />
                    <option value="ap-southeast-2 (Sydney)" />
                    <option value="ap-northeast-1 (Tokyo)" />
                    <option value="ap-northeast-2 (Seoul)" />
                    <option value="ap-south-1 (Mumbai)" />
                    <option value="sa-east-1 (São Paulo)" />
                    <option value="me-central-1 (Dubai)" />
                    <option value="af-south-1 (Cape Town)" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Supabase Project URL
                </label>
                    <Input
                      type="url"
                      required
                      placeholder="https://your-project-ref.supabase.co"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="font-mono"
                    />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Supabase Anon API Key
                </label>
                    <Input
                      type="password"
                      required
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={anonKey}
                      onChange={(e) => setAnonKey(e.target.value)}
                      className="font-mono"
                    />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isTesting || !name || !url || !anonKey}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Verifying Handshake...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Test & Add Node
                    </>
                  )}
                </Button>
              </div>
            </form>

            {testResult && (
              <div
                className={`rounded-lg border p-3 text-xs ${
                  testResult.success
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {testResult.success ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{testResult.success ? 'HANDSHAKE PASSED' : 'HANDSHAKE FAILED'}</span>
                </div>
                <p className="mt-1 leading-relaxed">{testResult.message}</p>
                {testResult.latency && (
                  <div className="mt-2 font-mono text-[10px]">
                    Measured Latency: <strong className="text-white">{testResult.latency} ms</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Cluster Provisioned Nodes ({nodes.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={checkAllSchemas}
                disabled={checkingSchema}
                className="text-[10px] text-slate-400 hover:text-white h-auto px-2 py-1"
              >
                <RefreshCw className={`h-3 w-3 ${checkingSchema ? 'animate-spin' : ''}`} />
                Refresh Schemas
              </Button>
            </div>

            <div className="space-y-3">
              {nodes.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  No nodes connected yet. Connect your first Supabase project above!
                </div>
              ) : (
                nodes.map((node) => {
                  const nodeSchema = schemaStatus[node.id];
                  const isOnline = node.status === 'connected';

                  return (
                    <div
                      key={node.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-950/50 border border-slate-800 p-4 transition hover:border-slate-800/100"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-200">{node.name}</span>
                          <span className="text-[10px] text-slate-500">• {node.region}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[280px]">
                          {node.url}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
                        {nodeSchema?.checked && (
                          <div className="flex gap-1">
                          <Badge
                            variant={nodeSchema.kv ? 'default' : 'outline'}
                            className={`text-[9px] font-mono ${
                              nodeSchema.kv
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                                : 'text-amber-400 border-amber-500/30'
                            }`}
                            title="unified_kv table"
                          >
                            KV:{nodeSchema.kv ? '✓' : '✗'}
                          </Badge>
                          <Badge
                            variant={nodeSchema.chunks ? 'default' : 'outline'}
                            className={`text-[9px] font-mono ${
                              nodeSchema.chunks
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                                : 'text-amber-400 border-amber-500/30'
                            }`}
                            title="unified_chunks table"
                          >
                            DFS:{nodeSchema.chunks ? '✓' : '✗'}
                          </Badge>
                          <Badge
                            variant={nodeSchema.vector ? 'default' : 'outline'}
                            className={`text-[9px] font-mono ${
                              nodeSchema.vector
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                                : 'text-amber-400 border-amber-500/30'
                            }`}
                            title="unified_vector & RPC function"
                          >
                            VEC:{nodeSchema.vector ? '✓' : '✗'}
                          </Badge>
                          </div>
                        )}

                        <Badge
                          variant={isOnline ? 'default' : 'destructive'}
                          className={`gap-1.5 ${isOnline ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20' : ''}`}
                        >
                          <span className={`h-1 w-1 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {isOnline ? 'Active' : 'Offline'}
                        </Badge>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteNode(node.id)}
                          className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Remove Node from Cluster"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: PostgreSQL SQL Schema Exporter */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/10 p-5 backdrop-blur-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-emerald-400" />
                PostgreSQL Schema Setup
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                To connect a real Supabase project, copy and run this SQL in your Supabase project's SQL Editor first. It creates the required tables and pgvector RPCs.
              </p>
            </div>

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySql}
                className="absolute right-3 top-3 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 text-[10px]"
                title="Copy SQL Script"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copy SQL
                  </>
                )}
              </Button>
              
              <pre className="rounded-lg bg-slate-950 p-4 font-mono text-[9px] text-slate-400 border border-slate-800 h-[360px] overflow-y-auto leading-relaxed select-all">
                {SCHEMA_SQL}
              </pre>
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 text-[11px] text-amber-300 flex gap-2 leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-200">Security Warning</strong>
                Your Supabase project keys are stored securely client-side in your browser's local storage and never transit any backend. Ensure you do not expose your credentials in shared public environments.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
