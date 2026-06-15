export interface SupabaseNode {
  id: string;
  name: string;
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  status: 'connected' | 'disconnected' | 'checking';
  latency?: number;
  dbUsageBytes: number;
  dbLimitBytes: number; // e.g., 500MB = 524288000 bytes
  storageUsageBytes: number;
  storageLimitBytes: number; // e.g., 1GB = 1073741824 bytes
  region: string;
}

export interface KVRecord {
  key: string;
  value: unknown;
  tags: string[];
  updatedAt: string;
  nodeId: string; // The primary node where it's stored
  replicaNodeId?: string; // Backup node if replication is enabled
}

export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  totalChunks: number;
  chunkIds: string[];
  nodeDistribution: { [chunkIndex: number]: string }; // chunkIndex -> nodeId
  createdAt: string;
}

export interface FileChunk {
  chunkId: string;
  fileName: string;
  fileType: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // base64 encoded chunk data
  sizeBytes: number;
}

export interface VectorMemory {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    category: string;
    agentName: string;
    timestamp: string;
  };
  nodeId: string;
  similarity?: number; // Used during search queries
}

export interface ClusterMetrics {
  totalNodes: number;
  activeNodes: number;
  totalDbCapacityBytes: number;
  usedDbBytes: number;
  totalStorageCapacityBytes: number;
  usedStorageBytes: number;
  averageLatencyMs: number;
}

export type ActiveTab = 'dashboard' | 'kv' | 'files' | 'vector' | 'console';
