import React, { useState, useEffect } from 'react';
import { SupabaseNode } from '../types';
import { createClient } from '@supabase/supabase-js';
import { Plus, Trash2, Terminal, Check, AlertTriangle, RefreshCw, ShieldCheck, Download, Upload, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { encryptKey, decryptKey, generatePassphrase } from '../utils/encryption';

interface NodeConsoleProps {
  nodes: SupabaseNode[];
  onAddNode: (node: Omit<SupabaseNode, 'id' | 'status' | 'latency' | 'dbUsageBytes' | 'storageUsageBytes'>) => Promise<void>;
  onDeleteNode: (id: string) => void;
}

const SCHEMA_SQL = `-- 1. Enable the pgvector extension (Supabase supports this out-of-the-box!)
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
  const [runningSql, setRunningSql] = useState<string | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<{ [nodeId: string]: { kv: boolean; chunks: boolean; vector: boolean; checked: boolean; pgvector: boolean } }>({});
  const [checkingSchema, setCheckingSchema] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const ONBOARDING_STEPS = [
    {
      title: 'Welcome to Cluster Console',
      description: 'Connect your Supabase projects together to form a unified distributed database cluster. This tool lets you manage KV stores, distribute file chunks, and run vector search across multiple Supabase instances.',
      action: 'Get Started',
    },
    {
      title: 'Add Your First Node',
      description: 'Enter a name, Supabase project URL (e.g. https://your-project.supabase.co), and your anon API key. The tool will test the connection before adding it to your cluster.',
      action: 'I have my keys ready',
    },
    {
      title: 'Run Schema Setup',
      description: 'After connecting, copy the SQL script to the right into your Supabase SQL Editor. This creates the required tables (unified_kv, unified_chunks, unified_vector) and the pgvector search function.',
      action: 'Show me the SQL',
    },
    {
      title: 'Explore Dashboard & KV Store',
      description: 'Once connected, navigate to the Dashboard tab to see cluster overview and the KV Store tab to start writing distributed key-value data. Files are automatically sharded across nodes.',
      action: 'Launch Dashboard',
    },
  ];

  const [encryptPassphrase, setEncryptPassphrase] = useState('');
  const [encryptTargetKey, setEncryptTargetKey] = useState('');
  const [encryptResult, setEncryptResult] = useState<string | null>(null);
  const [encryptError, setEncryptError] = useState<string | null>(null);
  const [showDecrypted, setShowDecrypted] = useState(false);

  // Generate a passphrase for key encryption
  const handleGeneratePassphrase = () => {
    const phrase = generatePassphrase();
    setEncryptPassphrase(phrase);
  };

  // Encrypt an API key
  const handleEncryptKey = async () => {
    setEncryptError(null);
    setEncryptResult(null);
    if (!encryptPassphrase.trim() || !encryptTargetKey.trim()) {
      setEncryptError('Both passphrase and API key are required.');
      return;
    }
    try {
      const encrypted = await encryptKey(encryptTargetKey.trim(), encryptPassphrase.trim());
      setEncryptResult(encrypted);
      setShowDecrypted(false);
    } catch (err) {
      setEncryptError(`Encryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Decrypt an API key
  const handleDecryptKey = async () => {
    setEncryptError(null);
    setEncryptResult(null);
    if (!encryptPassphrase.trim() || !encryptTargetKey.trim()) {
      setEncryptError('Both passphrase and encrypted key are required.');
      return;
    }
    try {
      const decrypted = await decryptKey(encryptTargetKey.trim(), encryptPassphrase.trim());
      setEncryptResult(decrypted);
      setShowDecrypted(true);
    } catch (err) {
      setEncryptError(`Decryption failed: ${err instanceof Error ? err.message : 'Invalid passphrase or corrupted key'}`);
    }
  };

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

  // Run SQL Schema on all connected nodes
  const handleRunSqlOnAll = async () => {
    setRunningSql('running');
    const connectedNodes = nodes.filter(n => n.status === 'connected');
    let success = 0;
    let failed = 0;

    await Promise.all(
      connectedNodes.map(async (node) => {
        const supabase = createClient(node.url, node.anonKey, { auth: { persistSession: false } });
        try {
          // Attempt to use exec_sql RPC to run SQL
          const { error } = await supabase.rpc('exec_sql', { query: SCHEMA_SQL });
          if (!error) {
            success++;
          } else {
            // RPC doesn't exist or failed — will need manual SQL execution
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );

    setRunningSql(success > 0 && failed === 0 ? 'done' : 'partial');
    setTimeout(() => setRunningSql(null), 3000);
  };

  // Export cluster config as JSON
  const handleExportConfig = () => {
    const config = {
      exportedAt: new Date().toISOString(),
      nodes: nodes.map(n => ({
        name: n.name,
        url: n.url,
        anonKey: n.anonKey,
      })),
    };
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cluster-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import cluster config from JSON
  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const config = JSON.parse(text);

    if (!Array.isArray(config.nodes)) {
      alert('Invalid config format');
      return;
    }

    for (const nodeConfig of config.nodes) {
      if (nodeConfig.url && nodeConfig.anonKey && nodeConfig.name) {
        await onAddNode({
          name: nodeConfig.name,
          url: nodeConfig.url,
          anonKey: nodeConfig.anonKey,
          region: nodeConfig.region || 'us-east-1',
          dbLimitBytes: nodeConfig.dbLimitBytes || 524288000,
          storageLimitBytes: nodeConfig.storageLimitBytes || 1073741824,
        });
      }
    }

    // Reset input
    e.target.value = '';
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
      const supabase = createClient(node.url, node.anonKey, { auth: { persistSession: false } });
      
      const { error: kvError } = await supabase.from('unified_kv').select('*').limit(0);
      const kvExists = !kvError;

      const { error: chunksError } = await supabase.from('unified_chunks').select('*').limit(0);
      const chunksExists = !chunksError;

      const { error: vectorError } = await supabase.from('unified_vector').select('*').limit(0);
      const vectorExists = !vectorError;

      // Check pgvector extension
      let pgvectorExists = false;
      const { data: extData } = await supabase.rpc('exec_sql', { query: "SELECT * FROM pg_extension WHERE extname = 'vector'" });
      if (extData && Array.isArray(extData)) {
        pgvectorExists = extData.length > 0;
      }

      return {
        kv: kvExists,
        chunks: chunksExists,
        vector: vectorExists,
        pgvector: pgvectorExists,
        checked: true,
      };
    } catch (e) {
      return { kv: false, chunks: false, vector: false, pgvector: false, checked: true };
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
      <div className="rounded-2xl p-6 backdrop-blur-xl" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.4)' }}>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          Cluster Environment Control
        </h2>
         <p className="text-xs mt-1 max-w-2xl leading-normal" style={{ color: 'var(--color-text-muted)' }}>
            Connect Supabase REST endpoints together. Each database behaves as an individual shard in the unified cluster.
         </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Side: Node Administration */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-xl backdrop-blur-sm p-5 space-y-4" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
            <h3 className="text-base font-bold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
              <Plus className="h-5 w-5 text-emerald-400" />
              Add Real Supabase Node
            </h3>

            {nodes.length === 0 && (
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400">Onboarding ({onboardingStep + 1}/{ONBOARDING_STEPS.length})</h4>
                  <button
                    onClick={() => setOnboardingStep((onboardingStep + 1) % ONBOARDING_STEPS.length)}
                    className="text-[9px] px-2 py-1 rounded hover:bg-emerald-500/10 transition"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Next →
                  </button>
                </div>
                <h5 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                  {ONBOARDING_STEPS[onboardingStep].title}
                </h5>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {ONBOARDING_STEPS[onboardingStep].description}
                </p>
                <div className="flex gap-1.5">
                  {ONBOARDING_STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setOnboardingStep(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === onboardingStep ? 'w-6 bg-emerald-400' : 'w-1.5'
                      }`}
                      style={{ backgroundColor: i === onboardingStep ? '#10b981' : 'var(--color-border)' }}
                    />
                  ))}
                </div>
              </div>
            )}
            
            <form onSubmit={handleAddNodeSubmit} className="space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                   <label className="block font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
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
                   <label className="block font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
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
                 <label className="block font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
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
                 <label className="block font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
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
                    Measured Latency: <strong>{testResult.latency} ms</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl backdrop-blur-sm p-5 space-y-4" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
                Cluster Provisioned Nodes ({nodes.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={checkAllSchemas}
                disabled={checkingSchema}
                 className="text-[10px] hover:text-white h-auto px-2 py-1" style={{ color: 'var(--color-text-muted)' }}
              >
                <RefreshCw className={`h-3 w-3 ${checkingSchema ? 'animate-spin' : ''}`} />
                Refresh Schemas
              </Button>
            </div>

            <div className="space-y-3">
              {nodes.length === 0 ? (
                 <div className="text-center py-8 text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                   No nodes connected yet. Connect your first Supabase project above!
                 </div>
              ) : (
                nodes.map((node) => {
                  const nodeSchema = schemaStatus[node.id];
                  const isOnline = node.status === 'connected';

                  return (
                    <div
                      key={node.id}
                       className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-4 transition" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid' }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="font-mono font-bold text-xs" style={{ color: 'var(--color-text)' }}>{node.name}</span>
                           <span className="text-[10px]">• {node.region}</span>
                        </div>
                         <span className="text-[10px] font-mono block truncate max-w-[280px]" style={{ color: 'var(--color-text-muted)' }}>
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
                          <Badge
                            variant={nodeSchema.pgvector ? 'default' : 'outline'}
                            className={`text-[9px] font-mono ${
                              nodeSchema.pgvector
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                                : 'text-amber-400 border-amber-500/30'
                            }`}
                            title="pgvector extension"
                          >
                            PG:{nodeSchema.pgvector ? '✓' : '✗'}
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
                           className="hover:text-rose-400 hover:bg-rose-500/10" style={{ color: 'var(--color-text-muted)' }}
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
          <div className="rounded-xl backdrop-blur-sm p-5 space-y-4" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                <Terminal className="h-4 w-4 text-emerald-400" />
                PostgreSQL Schema Setup
              </h3>
               <p className="text-[11px] mt-0.5 leading-normal" style={{ color: 'var(--color-text-muted)' }}>
                 To connect a real Supabase project, copy and run this SQL in your Supabase project's SQL Editor first. It creates the required tables and pgvector RPCs.
               </p>
            </div>

            <div className="relative">
              <div className="absolute right-3 top-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunSqlOnAll}
                  disabled={runningSql !== null || nodes.filter(n => n.status === 'connected').length === 0}
                  className="text-[10px]" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  title="Run SQL on all connected nodes"
                >
                  {runningSql === 'running' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {runningSql === 'done' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  {runningSql === 'partial' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                  {!runningSql && <Terminal className="h-3.5 w-3.5" />}
                  {runningSql === 'running' ? 'Running...' : runningSql === 'done' ? 'Done!' : runningSql === 'partial' ? 'Partial' : 'Run SQL'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySql}
                  className="text-[10px]" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
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
              </div>
              
                <pre className="rounded-lg p-4 font-mono text-[9px] h-[360px] overflow-y-auto leading-relaxed select-all" style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', border: '1px solid', color: 'var(--color-text-muted)' }}>
                 {SCHEMA_SQL}
               </pre>
            </div>

            <div className="rounded-xl backdrop-blur-sm p-5 space-y-4" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <Download className="h-4 w-4 text-emerald-400" />
                  Cluster Configuration
                </h3>
                <p className="text-[11px] mt-0.5 leading-normal" style={{ color: 'var(--color-text-muted)' }}>
                  Export your cluster nodes to a JSON file, or import a previously saved configuration.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportConfig}
                  disabled={nodes.length === 0}
                  className="flex-1 text-[10px]"
                  style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  title="Export cluster configuration"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Config
                </Button>

                <label className="flex-1">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportConfig}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                      input?.click();
                    }}
                    className="w-full text-[10px]"
                    style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    title="Import cluster configuration"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import Config
                  </Button>
                </label>
              </div>
            </div>

            <div className="rounded-xl backdrop-blur-sm p-5 space-y-4" style={{ borderColor: 'var(--color-border)', border: '1px solid', backgroundColor: 'rgba(var(--color-surface-alt-rgb, 228 228 231), 0.1)' }}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  <KeyRound className="h-4 w-4 text-emerald-400" />
                  API Key Encryption
                </h3>
                <p className="text-[11px] mt-0.5 leading-normal" style={{ color: 'var(--color-text-muted)' }}>
                  Encrypt or decrypt Supabase API keys using a passphrase (AES-GCM + PBKDF2).
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Passphrase
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter or generate a passphrase..."
                      value={encryptPassphrase}
                      onChange={(e) => setEncryptPassphrase(e.target.value)}
                      className="font-mono text-[10px]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGeneratePassphrase}
                      className="shrink-0 text-[10px]"
                      title="Generate random passphrase"
                    >
                      Generate
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    {showDecrypted ? 'Decrypted' : 'Key'} Value
                  </label>
                  <Input
                    type={showDecrypted ? 'text' : 'password'}
                    placeholder="Paste API key or encrypted blob..."
                    value={encryptTargetKey}
                    onChange={(e) => setEncryptTargetKey(e.target.value)}
                    className="font-mono text-[10px]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEncryptKey}
                    disabled={!encryptPassphrase.trim() || !encryptTargetKey.trim()}
                    className="flex-1 text-[10px]"
                    style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Encrypt
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDecryptKey}
                    disabled={!encryptPassphrase.trim() || !encryptTargetKey.trim()}
                    className="flex-1 text-[10px]"
                    style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    {showDecrypted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    Decrypt
                  </Button>
                </div>

                {encryptResult && (
                  <div className="rounded-lg border p-2 text-[10px] font-mono break-all max-h-20 overflow-y-auto" style={{
                    backgroundColor: showDecrypted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    borderColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                  }}>
                    <strong className="block mb-1 text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {showDecrypted ? '✓ Decrypted Key' : '✓ Encrypted Blob'}
                    </strong>
                    {encryptResult}
                  </div>
                )}

                {encryptError && (
                  <div className="rounded-lg border p-2 text-[10px]" style={{
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    borderColor: 'rgba(244, 63, 94, 0.2)',
                    color: '#fb7185',
                  }}>
                    {encryptError}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[11px] flex gap-2 leading-relaxed" style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 10%, transparent)', borderColor: 'color-mix(in srgb, #f59e0b 20%, transparent)', color: 'var(--color-text-muted)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <strong className="block" style={{ color: 'var(--color-text)' }}>Security Warning</strong>
                Your Supabase project keys are stored securely client-side in your browser's local storage and never transit any backend. Ensure you do not expose your credentials in shared public environments.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
