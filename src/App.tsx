import { useState, useEffect } from 'react';
import { SupabaseNode, KVRecord, FileMetadata, FileChunk, VectorMemory, ActiveTab } from './types';
import { buildHashRing, getNodeForKey } from './utils/hash';
import { generateMockEmbedding } from './utils/embedding';
import { createClient } from '@supabase/supabase-js';

// Import Components
import Dashboard from './components/Dashboard';
import KVStore from './components/KVStore';
import FileSharding from './components/FileSharding';
import VectorMemoryComponent from './components/VectorMemory';
import NodeConsole from './components/NodeConsole';

// Icons
import { Activity, Key, Layers, Brain, Terminal, Database, ShieldAlert, Cpu, RefreshCw } from 'lucide-react';

// Live Supabase Client Cache
const supabaseClientCache: { [nodeId: string]: any } = {};

function getSupabaseClient(node: SupabaseNode) {
  if (!supabaseClientCache[node.id]) {
    supabaseClientCache[node.id] = createClient(node.url, node.anonKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseClientCache[node.id];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [nodes, setNodes] = useState<SupabaseNode[]>([]);
  const [kvRecords, setKvRecords] = useState<KVRecord[]>([]);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [memories, setMemories] = useState<VectorMemory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [clusterLogs, setClusterLogs] = useState<string[]>([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
    return localStorage.getItem('supamerge_onboarding_seen') !== 'true';
  });

  // Initialize and load data on mount
  useEffect(() => {
    loadClusterData();
  }, []);

  const addLog = (msg: string) => {
    console.log(`[CLUSTER] ${msg}`);
    setClusterLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const loadClusterData = async () => {
    setLoading(true);
    addLog("Initializing live cluster...");

    const storedNodes = localStorage.getItem('sb_live_nodes');
    const loadedNodes: SupabaseNode[] = storedNodes ? JSON.parse(storedNodes) : [];
    setNodes(loadedNodes);

    if (loadedNodes.length === 0) {
      addLog("WARNING: No live Supabase nodes provisioned! Redirecting to Console.");
      setKvRecords([]);
      setFiles([]);
      setMemories([]);
      setActiveTab('console');
      setLoading(false);
      return;
    }

    addLog(`Live Mode: Pinging and querying ${loadedNodes.length} connected Supabase nodes in parallel...`);
    
    // Query all live nodes in parallel
    const updatedNodes = [...loadedNodes];
    const allKV: KVRecord[] = [];
    const allChunks: FileChunk[] = [];
    const allVectors: VectorMemory[] = [];

    await Promise.all(
      updatedNodes.map(async (node) => {
        const start = performance.now();
        const supabase = getSupabaseClient(node);
        
        if (!supabase) return;

        try {
          // 1. Ping / Connection test
          const { error: pingError } = await supabase.from('unified_kv').select('key').limit(1);
          const end = performance.now();
          
          if (pingError && pingError.code === 'PGRST116') {
            node.status = 'connected';
            node.latency = Math.round(end - start);
          } else {
            node.status = 'connected';
            node.latency = Math.round(end - start);
          }

          // 2. Query Key-Value Records
          const { data: kvData } = await supabase.from('unified_kv').select('*');
          if (kvData) {
            kvData.forEach((row: any) => {
              allKV.push({
                key: row.key,
                value: row.value,
                tags: row.tags || [],
                updatedAt: row.updated_at,
                nodeId: node.id,
              });
            });
          }

          // 3. Query File Chunks
          const { data: chunksData } = await supabase.from('unified_chunks').select('chunk_id, file_name, file_type, chunk_index, total_chunks, size_bytes');
          if (chunksData) {
            chunksData.forEach((row: any) => {
              allChunks.push({
                chunkId: row.chunk_id,
                fileName: row.file_name,
                fileType: row.file_type,
                chunkIndex: row.chunk_index,
                totalChunks: row.total_chunks,
                data: '', 
                sizeBytes: row.size_bytes,
              });
            });
          }

          // 4. Query Vector Memories
          const { data: vectorsData } = await supabase.from('unified_vector').select('*');
          if (vectorsData) {
            vectorsData.forEach((row: any) => {
              allVectors.push({
                id: row.id,
                content: row.content,
                embedding: row.embedding ? JSON.parse(row.embedding) : [],
                metadata: row.metadata || {},
                nodeId: node.id,
              });
            });
          }

        } catch (err: any) {
          addLog(`ERROR: Failed to connect to node [${node.name}]: ${err.message}`);
          node.status = 'disconnected';
          node.latency = undefined;
        }
      })
    );

    // Resolve Key-Value duplicates (keep latest updatedAt)
    const uniqueKV: { [key: string]: KVRecord } = {};
    allKV.forEach((rec) => {
      if (!uniqueKV[rec.key] || new Date(rec.updatedAt) > new Date(uniqueKV[rec.key].updatedAt)) {
        const activeNodes = updatedNodes.filter(n => n.status === 'connected');
        const ring = buildHashRing(activeNodes, 4);
        const routing = getNodeForKey(rec.key, ring);
        
        let replicaNodeId = '';
        if (activeNodes.length > 1) {
          const primaryIdx = activeNodes.findIndex(n => n.id === routing.nodeId);
          replicaNodeId = activeNodes[(primaryIdx + 1) % activeNodes.length].id;
        }

        uniqueKV[rec.key] = {
          ...rec,
          nodeId: routing.nodeId,
          replicaNodeId,
        };
      }
    });

    // Reconstruct File Metadata from raw chunk nodes
    const fileMap: { [fileName: string]: FileMetadata } = {};
    allChunks.forEach((chunk) => {
      if (!fileMap[chunk.fileName]) {
        fileMap[chunk.fileName] = {
          id: `file_${chunk.fileName.replace(/[^\w]/g, '_')}`,
          name: chunk.fileName,
          type: chunk.fileType,
          size: 0,
          totalChunks: chunk.totalChunks,
          chunkIds: new Array(chunk.totalChunks),
          nodeDistribution: {},
          createdAt: new Date().toISOString(),
        };
      }
      
      const f = fileMap[chunk.fileName];
      f.size += chunk.sizeBytes;
      f.chunkIds[chunk.chunkIndex] = chunk.chunkId;
    });

    const liveChunksDistribution: { [fileName: string]: { [index: number]: string } } = {};
    
    await Promise.all(
      updatedNodes.map(async (node) => {
        if (node.status !== 'connected') return;
        const supabase = getSupabaseClient(node);
        if (!supabase) return;

        try {
          const { data } = await supabase.from('unified_chunks').select('file_name, chunk_index');
          if (data) {
            data.forEach((row: any) => {
              if (!liveChunksDistribution[row.file_name]) {
                liveChunksDistribution[row.file_name] = {};
              }
              liveChunksDistribution[row.file_name][row.chunk_index] = node.id;
            });
          }
        } catch (e) {}
      })
    );

    Object.keys(fileMap).forEach((name) => {
      fileMap[name].nodeDistribution = liveChunksDistribution[name] || {};
    });

    setNodes(updatedNodes);
    setKvRecords(Object.values(uniqueKV));
    setFiles(Object.values(fileMap));
    setMemories(allVectors);
    
    addLog(`Live sync complete! Pooled: ${Object.values(uniqueKV).length} KV records, ${Object.values(fileMap).length} files, ${allVectors.length} vectors.`);
    setLoading(false);
  };

  const handleAddNode = async (newNodeData: Omit<SupabaseNode, 'id' | 'status' | 'latency' | 'dbUsageBytes' | 'storageUsageBytes'>) => {
    const newNode: SupabaseNode = {
      ...newNodeData,
      id: `live-node-${Date.now()}`,
      status: 'connected',
      latency: 50,
      dbUsageBytes: 0,
      storageUsageBytes: 0,
    };

    const updated = [...nodes, newNode];
    setNodes(updated);
    localStorage.setItem('sb_live_nodes', JSON.stringify(updated));
    addLog(`Added new live node: [${newNode.name}] (${newNode.region})`);
    
    await loadClusterData();
  };

  const handleDeleteNode = (id: string) => {
    const updated = nodes.filter((n) => n.id !== id);
    setNodes(updated);
    localStorage.setItem('sb_live_nodes', JSON.stringify(updated));
    addLog(`Removed node [${id}] from live cluster configuration.`);
    
    delete supabaseClientCache[id];
    loadClusterData();
  };

  // KV Operations
  const handleAddKVRecord = async (key: string, value: any, tags: string[]): Promise<{ primary: string; replica: string }> => {
    const activeNodes = nodes.filter((n) => n.status === 'connected');
    if (activeNodes.length === 0) {
      throw new Error('No active database nodes available to write to!');
    }

    const ring = buildHashRing(activeNodes, 4);
    const routing = getNodeForKey(key, ring);
    
    const primaryNodeId = routing.nodeId;
    let replicaNodeId = '';
    
    if (activeNodes.length > 1) {
      const primaryIdx = activeNodes.findIndex(n => n.id === primaryNodeId);
      replicaNodeId = activeNodes[(primaryIdx + 1) % activeNodes.length].id;
    }

    const newRecord: KVRecord = {
      key,
      value,
      tags,
      updatedAt: new Date().toISOString(),
      nodeId: primaryNodeId,
      replicaNodeId: replicaNodeId || undefined,
    };

    const primaryNode = nodes.find(n => n.id === primaryNodeId);
    const replicaNode = replicaNodeId ? nodes.find(n => n.id === replicaNodeId) : null;

    const writePromises = [];

    if (primaryNode) {
      const supabasePrimary = getSupabaseClient(primaryNode);
      if (supabasePrimary) {
        writePromises.push(
          supabasePrimary.from('unified_kv').upsert({
            key,
            value,
            tags,
            updated_at: newRecord.updatedAt,
          })
        );
      }
    }

    if (replicaNode) {
      const supabaseReplica = getSupabaseClient(replicaNode);
      if (supabaseReplica) {
        writePromises.push(
          supabaseReplica.from('unified_kv').upsert({
            key,
            value,
            tags,
            updated_at: newRecord.updatedAt,
          })
        );
      }
    }

    const results = await Promise.all(writePromises);
    const errors = results.filter(r => r.error).map(r => r.error?.message);

    if (errors.length === writePromises.length) {
      throw new Error(`Failed to write to any database: ${errors.join('; ')}`);
    }

    addLog(`[KV] Live sharded write: "${key}" committed.`);
    await loadClusterData();

    return { primary: primaryNodeId, replica: replicaNodeId };
  };

  const handleDeleteKVRecord = async (key: string) => {
    const record = kvRecords.find(r => r.key === key);
    if (!record) return;

    const primaryNode = nodes.find(n => n.id === record.nodeId);
    const replicaNode = record.replicaNodeId ? nodes.find(n => n.id === record.replicaNodeId) : null;

    const deletePromises = [];
    if (primaryNode && primaryNode.status === 'connected') {
      const sub = getSupabaseClient(primaryNode);
      if (sub) deletePromises.push(sub.from('unified_kv').delete().eq('key', key));
    }
    if (replicaNode && replicaNode.status === 'connected') {
      const sub = getSupabaseClient(replicaNode);
      if (sub) deletePromises.push(sub.from('unified_kv').delete().eq('key', key));
    }

    await Promise.all(deletePromises);
    addLog(`[KV] Live sharded delete: "${key}" removed.`);
    await loadClusterData();
  };

  // DFS Operations
  const handleUploadFile = async (
    name: string,
    _type: string,
    _size: number,
    chunks: FileChunk[],
    nodeDistribution: { [chunkIndex: number]: string }
  ) => {
    const uploadPromises = chunks.map(async (chunk) => {
      const primaryNodeId = nodeDistribution[chunk.chunkIndex];
      const primaryNode = nodes.find(n => n.id === primaryNodeId);
      
      const activeNodes = nodes.filter(n => n.status === 'connected');
      const primaryIdx = activeNodes.findIndex(n => n.id === primaryNodeId);
      const replicaNodeId = activeNodes[(primaryIdx + 1) % activeNodes.length].id;
      const replicaNode = nodes.find(n => n.id === replicaNodeId);

      const chunkPromises = [];

      if (primaryNode) {
        const sub = getSupabaseClient(primaryNode);
        if (sub) {
          chunkPromises.push(
            sub.from('unified_chunks').upsert({
              chunk_id: chunk.chunkId,
              file_name: chunk.fileName,
              file_type: chunk.fileType,
              chunk_index: chunk.chunkIndex,
              total_chunks: chunk.totalChunks,
              data: chunk.data,
              size_bytes: chunk.sizeBytes,
            })
          );
        }
      }

      if (replicaNode) {
        const sub = getSupabaseClient(replicaNode);
        if (sub) {
          chunkPromises.push(
            sub.from('unified_chunks').upsert({
              chunk_id: `${chunk.chunkId}_replica_${replicaNodeId}`,
              file_name: chunk.fileName,
              file_type: chunk.fileType,
              chunk_index: chunk.chunkIndex,
              total_chunks: chunk.totalChunks,
              data: chunk.data,
              size_bytes: chunk.sizeBytes,
            })
          );
        }
      }

      await Promise.all(chunkPromises);
    });

    await Promise.all(uploadPromises);
    addLog(`[DFS] Live file sharded upload complete: "${name}"`);
    await loadClusterData();
  };

  const handleDownloadChunk = async (chunkId: string, nodeId: string): Promise<string | null> => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.status !== 'connected') return null;

    const sub = getSupabaseClient(node);
    if (!sub) return null;

    const { data, error: fetchError } = await sub
      .from('unified_chunks')
      .select('data')
      .or(`chunk_id.eq.${chunkId},chunk_id.eq.${chunkId}_replica_${nodeId}`)
      .limit(1)
      .single();
      
    if (fetchError || !data) return null;
    return data.data;
  };

  const handleDeleteFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    const deletePromises = nodes.map(async (node) => {
      if (node.status !== 'connected') return;
      const sub = getSupabaseClient(node);
      if (!sub) return;
      
      await sub.from('unified_chunks').delete().eq('file_name', file.name);
    });

    await Promise.all(deletePromises);
    addLog(`[DFS] Live file shards deleted for: "${file.name}"`);
    await loadClusterData();
  };

  // Vector Memory Operations
  const handleAddMemory = async (content: string, category: string, agentName: string) => {
    const embedding = generateMockEmbedding(content);
    const activeNodes = nodes.filter(n => n.status === 'connected');
    if (activeNodes.length === 0) {
      throw new Error('No active database nodes available to commit memory!');
    }

    const targetIndex = memories.length % activeNodes.length;
    const targetNodeId = activeNodes[targetIndex].id;
    const replicaNodeId = activeNodes[(targetIndex + 1) % activeNodes.length].id;

    const targetNode = nodes.find(n => n.id === targetNodeId);
    const replicaNode = nodes.find(n => n.id === replicaNodeId);
    
    const insertPromises = [];

    if (targetNode) {
      const sub = getSupabaseClient(targetNode);
      if (sub) {
        insertPromises.push(
          sub.from('unified_vector').insert({
            content,
            embedding: JSON.stringify(embedding),
            metadata: { category, agentName, timestamp: new Date().toISOString() },
          })
        );
      }
    }

    if (replicaNode) {
      const sub = getSupabaseClient(replicaNode);
      if (sub) {
        insertPromises.push(
          sub.from('unified_vector').insert({
            content,
            embedding: JSON.stringify(embedding),
            metadata: { category, agentName, timestamp: new Date().toISOString() },
          })
        );
      }
    }

    await Promise.all(insertPromises);
    addLog(`[Vector] Live memory sharded and written: "${content.substring(0, 25)}..."`);
    await loadClusterData();
  };

  const handleSearchMemories = async (queryText: string, limit: number): Promise<VectorMemory[]> => {
    const queryEmbedding = generateMockEmbedding(queryText);
    const activeNodes = nodes.filter(n => n.status === 'connected');
    const allResults: VectorMemory[] = [];

    await Promise.all(
      activeNodes.map(async (node) => {
        const sub = getSupabaseClient(node);
        if (!sub) return;

        try {
          const { data } = await sub.rpc('match_unified_vectors', {
            query_embedding: queryEmbedding,
            match_threshold: 0.2,
            match_count: limit,
          });

          if (data) {
            data.forEach((row: any) => {
              allResults.push({
                id: row.id,
                content: row.content,
                embedding: [],
                metadata: row.metadata || {},
                nodeId: node.id,
                similarity: row.similarity,
              });
            });
          }
        } catch (e: any) {
          addLog(`WARNING: RPC search failed on node [${node.name}]: ${e.message}.`);
        }
      })
    );

    const uniqueResults: { [content: string]: VectorMemory } = {};
    allResults.forEach((res) => {
      if (!uniqueResults[res.content] || (res.similarity || 0) > (uniqueResults[res.content].similarity || 0)) {
        uniqueResults[res.content] = res;
      }
    });

    const sorted = Object.values(uniqueResults)
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit);

    addLog(`[Vector] Live search query: "${queryText}". Fetched and aggregated ${sorted.length} matches.`);
    return sorted;
  };

  const handleDeleteMemory = async (memoryId: string) => {
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return;

    const deletePromises = nodes.map(async (node) => {
      if (node.status !== 'connected') return;
      const sub = getSupabaseClient(node);
      if (!sub) return;

      await sub.from('unified_vector').delete().eq('content', memory.content);
    });

    await Promise.all(deletePromises);
    addLog(`[Vector] Live memory deleted.`);
    await loadClusterData();
  };

  const handleDismissWelcome = () => {
    localStorage.setItem('supamerge_onboarding_seen', 'true');
    setShowWelcomeModal(false);
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
          <div className="text-sm text-slate-400 font-mono">Assembling virtual cluster topology...</div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard nodes={nodes} />;
      case 'kv':
        return (
          <KVStore
            nodes={nodes}
            records={kvRecords}
            onAddRecord={handleAddKVRecord}
            onDeleteRecord={handleDeleteKVRecord}
            isSandbox={false}
          />
        );
      case 'files':
        return (
          <FileSharding
            nodes={nodes}
            files={files}
            onUploadFile={handleUploadFile}
            onDownloadChunk={handleDownloadChunk}
            onDeleteFile={handleDeleteFile}
            isSandbox={false}
          />
        );
      case 'vector':
        return (
          <VectorMemoryComponent
            nodes={nodes}
            memories={memories}
            onAddMemory={handleAddMemory}
            onSearchMemories={handleSearchMemories}
            onDeleteMemory={handleDeleteMemory}
            isSandbox={false}
          />
        );
      case 'console':
        return (
          <NodeConsole
            nodes={nodes}
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#020617] text-slate-100">
      {/* Welcome Onboarding Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#070d1e] p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
            <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-950/40 border border-emerald-400/20">
              <Cpu className="h-8 w-8 text-slate-950 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Welcome to SupaMerge
              </h1>
              <p className="text-emerald-400 font-mono text-xs font-bold tracking-wider uppercase">
                Unified Multi-Database Cluster & AI Memory
              </p>
            </div>

            <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
              SupaMerge pools multiple independent **Supabase Free Tier** databases into a single, unified virtual cluster. It shards key-value data, splits files into distributed blocks, and merges semantic AI memories across nodes using consistent hashing.
            </p>

            <button
              onClick={handleDismissWelcome}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-semibold text-white transition shadow-lg shadow-emerald-950/40"
            >
              Configure Live Cluster
            </button>

            <div className="pt-2 text-xs text-slate-500">
              Your keys and URLs are stored strictly inside your browser's local storage.
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-900 bg-[#070d1e]/85 flex flex-col justify-between shrink-0 font-sans">
        <div className="p-5 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-1">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-950/40 border border-emerald-400/25">
              <Cpu className="h-4.5 w-4.5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent font-sans">
                SUPAMERGE
              </h2>
              <span className="text-[10px] text-emerald-400 font-mono font-bold leading-none block">
                UNIFIED CLUSTER
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Cluster Topology', icon: Activity },
              { id: 'kv', label: 'Sharded KV Store', icon: Key },
              { id: 'files', label: 'Distributed DFS', icon: Layers },
              { id: 'vector', label: 'Vector AI Memory', icon: Brain },
              { id: 'console', label: 'Cluster Console', icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold transition duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/10 text-emerald-400 border border-emerald-500/20 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Console System Logs in Sidebar footer */}
        <div className="p-4 border-t border-slate-900 space-y-3 bg-[#020617]/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              System Log Feed
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          
          <div className="h-28 overflow-y-auto font-mono text-[9px] text-slate-500 space-y-1.5 scrollbar-thin">
            {clusterLogs.length === 0 ? (
              <div className="text-slate-600 italic">No events recorded.</div>
            ) : (
              clusterLogs.map((log, i) => (
                <div key={i} className="leading-normal border-b border-slate-900/30 pb-1 last:border-0 select-all">
                  {log}
                </div>
              ))
            )}
          </div>

          <div className="rounded bg-slate-950/60 p-2 border border-slate-900 text-[10px] text-slate-400 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            <span>
              Mode: <strong className="text-emerald-400 font-mono">Live</strong>
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#090d1e]/40">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-900 px-6 bg-[#070d1e]/30 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Active Environment:</span>
            <span className="rounded-full px-2.5 py-0.5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              Production Unified Pool
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {nodes.length === 0 && (
              <div className="hidden sm:flex items-center gap-1.5 text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded px-2.5 py-1 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>No projects connected! Add them in Cluster Console.</span>
              </div>
            )}

            <div className="text-slate-400">
              Combined DB Capacity: <strong className="text-slate-200 font-mono">
                {`${(nodes.length * 0.5).toFixed(1)} GB`}
              </strong>
            </div>
          </div>
        </header>

        {/* Tab Content Page */}
        <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
