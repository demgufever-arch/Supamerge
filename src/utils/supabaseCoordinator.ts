import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseNode, KVRecord, FileChunk, VectorMemory } from '../types';
import { buildHashRing, getNodeForKey } from './hash';
import { generateMockEmbedding } from './embedding';

// Cache for active Supabase clients to avoid re-instantiation
const clientCache: { [nodeId: string]: SupabaseClient } = {};

/**
 * Get or create a Supabase client for a specific node.
 */
export function getClient(node: SupabaseNode): SupabaseClient | null {
  if (!clientCache[node.id]) {
    clientCache[node.id] = createClient(node.url, node.anonKey, {
      auth: { persistSession: false },
    });
  }
  return clientCache[node.id];
}

/**
 * Clear the client cache (useful if keys change)
 */
export function clearClientCache() {
  Object.keys(clientCache).forEach(key => delete clientCache[key]);
}

/**
 * Ping a live Supabase node to check connection and measure latency.
 */
export async function pingNode(node: SupabaseNode): Promise<{ status: 'connected' | 'disconnected'; latency: number }> {
  const start = performance.now();
  try {
    const cleanUrl = node.url.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: node.anonKey,
        Authorization: `Bearer ${node.anonKey}`,
      },
    });
    const end = performance.now();
    
    if (res.ok) {
      return { status: 'connected', latency: Math.round(end - start) };
    }
  } catch (e) {
    console.error(`Failed to ping node ${node.name}:`, e);
  }
  return { status: 'disconnected', latency: 0 };
}

/**
 * Key-Value Store: Write a record to the primary node and a backup replica.
 */
export async function writeLiveKV(
  nodes: SupabaseNode[],
  key: string,
  value: any,
  tags: string[],
  addLog: (msg: string) => void
): Promise<{ primaryNodeId: string; replicaNodeId?: string }> {
  const activeNodes = nodes.filter(n => n.status === 'connected');
  if (activeNodes.length === 0) {
    throw new Error('No active nodes available in the cluster.');
  }

  const ring = buildHashRing(activeNodes, 4);
  const routing = getNodeForKey(key, ring);
  const primaryNode = activeNodes.find(n => n.id === routing.nodeId)!;

  // Determine replica node (the next active node on the ring)
  let replicaNode: SupabaseNode | null = null;
  if (activeNodes.length > 1) {
    const primaryIdx = activeNodes.findIndex(n => n.id === primaryNode.id);
    replicaNode = activeNodes[(primaryIdx + 1) % activeNodes.length];
  }

  const timestamp = new Date().toISOString();
  const payload = { key, value, tags, updated_at: timestamp };

  addLog(`[KV] Starting sharded write for "${key}"`);
  addLog(`[KV] Primary Target: [${primaryNode.name}]`);
  if (replicaNode) {
    addLog(`[KV] Replica Target: [${replicaNode.name}]`);
  }

  const promises: Promise<void>[] = [];

  // Write to Primary
  const primaryClient = getClient(primaryNode);
  if (primaryClient) {
    promises.push(
      (async () => {
        const { error } = await primaryClient.from('unified_kv').upsert(payload);
        if (error) throw new Error(`Primary write failed: ${error.message}`);
        addLog(`[KV] ✓ Primary write succeeded on [${primaryNode.name}]`);
      })()
    );
  }

  // Write to Replica
  if (replicaNode) {
    const replicaClient = getClient(replicaNode);
    if (replicaClient) {
      promises.push(
        (async () => {
          const { error } = await replicaClient.from('unified_kv').upsert(payload);
          if (error) throw new Error(`Replica write failed: ${error.message}`);
          addLog(`[KV] ✓ Replica write succeeded on [${replicaNode.name}]`);
        })()
      );
    }
  }

  // Await all writes
  await Promise.all(promises);
  return {
    primaryNodeId: primaryNode.id,
    replicaNodeId: replicaNode?.id,
  };
}

/**
 * Key-Value Store: Read a record with automatic failover.
 */
export async function readLiveKV(
  nodes: SupabaseNode[],
  key: string,
  addLog: (msg: string) => void
): Promise<KVRecord> {
  const activeNodes = nodes.filter(n => n.status === 'connected');
  if (activeNodes.length === 0) {
    throw new Error('No active nodes available in the cluster.');
  }

  const ring = buildHashRing(activeNodes, 4);
  const routing = getNodeForKey(key, ring);
  const primaryNode = nodes.find(n => n.id === routing.nodeId)!;

  addLog(`[KV] Routing read request for "${key}" to primary [${primaryNode.name}]`);

  // 1. Try reading from Primary
  if (primaryNode.status === 'connected') {
    const client = getClient(primaryNode);
    if (client) {
      try {
        const { data, error } = await client
          .from('unified_kv')
          .select('*')
          .eq('key', key)
          .single();
        
        if (!error && data) {
          addLog(`[KV] ✓ Read successful from primary [${primaryNode.name}]`);
          return {
            key: data.key,
            value: data.value,
            tags: data.tags || [],
            updatedAt: data.updated_at,
            nodeId: primaryNode.id,
          };
        }
        if (error) addLog(`[KV] Primary read error: ${error.message}`);
      } catch (e: any) {
        addLog(`[KV] Primary read failed: ${e.message}`);
      }
    }
  }

  // 2. Fallback to Replica
  addLog(`[KV] ⚠️ Primary node offline or record missing. Initiating replica failover...`);
  let replicaNode: SupabaseNode | null = null;
  if (nodes.length > 1) {
    const primaryIdx = nodes.findIndex(n => n.id === primaryNode.id);
    // Find the next online node
    for (let i = 1; i <= nodes.length; i++) {
      const nextNode = nodes[(primaryIdx + i) % nodes.length];
      if (nextNode.status === 'connected') {
        replicaNode = nextNode;
        break;
      }
    }
  }

  if (replicaNode) {
    addLog(`[KV] Attempting read from replica [${replicaNode.name}]`);
    const client = getClient(replicaNode);
    if (client) {
      const { data, error } = await client
        .from('unified_kv')
        .select('*')
        .eq('key', key)
        .single();

      if (!error && data) {
        addLog(`[KV] 🛡️ ✓ Failover successful! Served from replica [${replicaNode.name}]`);
        return {
          key: data.key,
          value: data.value,
          tags: data.tags || [],
          updatedAt: data.updated_at,
          nodeId: primaryNode.id,
          replicaNodeId: replicaNode.id,
        };
      }
    }
  }

  throw new Error(`Key "${key}" could not be retrieved from any active cluster nodes.`);
}

/**
 * Key-Value Store: Delete a record across primary and replica nodes.
 */
export async function deleteLiveKV(nodes: SupabaseNode[], key: string, addLog: (msg: string) => void) {
  addLog(`[KV] Deleting key "${key}" from all sharded locations...`);
  const deletePromises = nodes.map(async (node) => {
    if (node.status !== 'connected') return;
    const client = getClient(node);
    if (client) {
      await client.from('unified_kv').delete().eq('key', key);
    }
  });
  await Promise.all(deletePromises);
}

/**
 * File System: Upload file chunks with 2x replication.
 */
export async function uploadLiveChunks(
  nodes: SupabaseNode[],
  chunks: FileChunk[],
  nodeDistribution: { [chunkIndex: number]: string },
  addLog: (msg: string) => void
) {
  const activeNodes = nodes.filter(n => n.status === 'connected');
  const uploadPromises = chunks.map(async (chunk) => {
    const primaryNodeId = nodeDistribution[chunk.chunkIndex];
    const primaryNode = nodes.find(n => n.id === primaryNodeId)!;
    
    // Determine replica (next active node)
    let replicaNode: SupabaseNode | null = null;
    if (activeNodes.length > 1) {
      const primaryIdx = activeNodes.findIndex(n => n.id === primaryNodeId);
      replicaNode = activeNodes[(primaryIdx + 1) % activeNodes.length];
    }

    const payload = {
      chunk_id: chunk.chunkId,
      file_name: chunk.fileName,
      file_type: chunk.fileType,
      chunk_index: chunk.chunkIndex,
      total_chunks: chunk.totalChunks,
      data: chunk.data,
      size_bytes: chunk.sizeBytes,
    };

    const chunkPromises = [];

    // Write primary chunk
    const primaryClient = getClient(primaryNode);
    if (primaryClient) {
      chunkPromises.push(
        primaryClient.from('unified_chunks').upsert(payload).then(({ error }) => {
          if (error) throw error;
          addLog(`[DFS] ✓ Chunk #${chunk.chunkIndex} uploaded to [${primaryNode.name}]`);
        })
      );
    }

    // Write replica chunk
    if (replicaNode) {
      const replicaClient = getClient(replicaNode);
      if (replicaClient) {
        chunkPromises.push(
          replicaClient.from('unified_chunks').upsert({
            ...payload,
            chunk_id: `${chunk.chunkId}_replica_${replicaNode.id}`,
          }).then(({ error }) => {
            if (error) throw error;
            addLog(`[DFS] ✓ Chunk #${chunk.chunkIndex} replica uploaded to [${replicaNode.name}]`);
          })
        );
      }
    }

    await Promise.all(chunkPromises);
  });

  await Promise.all(uploadPromises);
}

/**
 * File System: Fetch a file chunk with automatic failover.
 */
export async function downloadLiveChunk(
  nodes: SupabaseNode[],
  chunkId: string,
  primaryNodeId: string,
  addLog: (msg: string) => void
): Promise<string> {
  const primaryNode = nodes.find(n => n.id === primaryNodeId)!;

  // 1. Try Primary Node
  if (primaryNode.status === 'connected') {
    const client = getClient(primaryNode);
    if (client) {
      try {
        const { data, error } = await client
          .from('unified_chunks')
          .select('data')
          .eq('chunk_id', chunkId)
          .single();
        if (!error && data) {
          return data.data;
        }
      } catch (e) {}
    }
  }

  // 2. Try Replica Node (next active neighbor)
  addLog(`[DFS] ⚠️ Primary Node [${primaryNode.name}] unreachable. Fetching replica chunk...`);
  let replicaNode: SupabaseNode | null = null;
  if (nodes.length > 1) {
    const primaryIdx = nodes.findIndex(n => n.id === primaryNodeId);
    for (let i = 1; i <= nodes.length; i++) {
      const nextNode = nodes[(primaryIdx + i) % nodes.length];
      if (nextNode.status === 'connected') {
        replicaNode = nextNode;
        break;
      }
    }
  }

  if (replicaNode) {
    const client = getClient(replicaNode);
    if (client) {
      const replicaChunkId = `${chunkId}_replica_${replicaNode.id}`;
      const { data, error } = await client
        .from('unified_chunks')
        .select('data')
        .eq('chunk_id', replicaChunkId)
        .single();
      
      if (!error && data) {
        addLog(`[DFS] 🛡️ ✓ Chunk recovered from replica [${replicaNode.name}]`);
        return data.data;
      }
    }
  }

  throw new Error(`Failed to retrieve chunk ${chunkId} from all available nodes.`);
}

/**
 * Vector Memory: Store memory chunk with 384-dimension embedding.
 */
export async function writeLiveVector(
  nodes: SupabaseNode[],
  content: string,
  category: string,
  agentName: string,
  addLog: (msg: string) => void
) {
  const activeNodes = nodes.filter(n => n.status === 'connected');
  if (activeNodes.length === 0) {
    throw new Error('No active nodes in the cluster.');
  }

  // Generate embedding
  const embedding = generateMockEmbedding(content);

  // Write to a target node based on simple load balancing
  const targetIndex = Math.floor(Math.random() * activeNodes.length);
  const primaryNode = activeNodes[targetIndex];
  
  // Write to a second node for replication
  const replicaNode = activeNodes[(targetIndex + 1) % activeNodes.length];

  const payload = {
    content,
    embedding,
    metadata: { category, agentName, timestamp: new Date().toISOString() }
  };

  const promises = [];

  // Write to Primary
  const primaryClient = getClient(primaryNode);
  if (primaryClient) {
    promises.push(
      primaryClient.from('unified_vector').insert(payload).then(({ error }) => {
        if (error) throw error;
        addLog(`[Vector] ✓ Saved to primary [${primaryNode.name}]`);
      })
    );
  }

  // Write to Replica
  if (activeNodes.length > 1 && replicaNode) {
    const replicaClient = getClient(replicaNode);
    if (replicaClient) {
      promises.push(
        replicaClient.from('unified_vector').insert(payload).then(({ error }) => {
          if (error) throw error;
          addLog(`[Vector] ✓ Saved to replica [${replicaNode.name}]`);
        })
      );
    }
  }

  await Promise.all(promises);
}

/**
 * Vector Memory: Distributed parallel vector similarity search.
 */
export async function searchLiveVectors(
  nodes: SupabaseNode[],
  queryText: string,
  limit: number,
  addLog: (msg: string) => void
): Promise<VectorMemory[]> {
  const activeNodes = nodes.filter(n => n.status === 'connected');
  const queryEmbedding = generateMockEmbedding(queryText);
  const allResults: VectorMemory[] = [];

  addLog(`[Vector] Commencing parallel semantic search across ${activeNodes.length} active nodes...`);

  await Promise.all(
    activeNodes.map(async (node) => {
      const client = getClient(node);
      if (!client) return;

      try {
        // Query pgvector using the RPC function we provided in the setup SQL
        const { data, error } = await client.rpc('match_unified_vectors', {
          query_embedding: queryEmbedding,
          match_threshold: 0.2,
          match_count: limit,
        });

        if (error) throw error;

        if (data) {
          data.forEach((row: any) => {
            allResults.push({
              id: row.id,
              content: row.content,
              embedding: [], // Don't need to return the full embedding array
              metadata: row.metadata,
              nodeId: node.id,
              similarity: row.similarity,
            });
          });
        }
      } catch (e: any) {
        addLog(`[Vector] ⚠️ RPC search failed on [${node.name}]: ${e.message}.`);
      }
    })
  );

  // Global merge-sort and deduplicate (in case same memory is on multiple nodes due to replication)
  const uniqueResults: { [content: string]: VectorMemory } = {};
  allResults.forEach((res) => {
    if (!uniqueResults[res.content] || (res.similarity || 0) > (uniqueResults[res.content].similarity || 0)) {
      uniqueResults[res.content] = res;
    }
  });

  return Object.values(uniqueResults)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, limit);
}
