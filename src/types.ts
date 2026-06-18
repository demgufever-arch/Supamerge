export interface SupabaseNode {
  id: string;
  name: string;
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  status: 'connected' | 'disconnected' | 'checking';
  latency?: number;
  dbUsageBytes: number;
  dbLimitBytes: number;
  storageUsageBytes: number;
  storageLimitBytes: number;
  region: string;
  pgVersion?: string;
  extensions?: string[];
  lastSchemaCheck?: string;
}

export interface KVRecord {
  key: string;
  value: unknown;
  tags: string[];
  updatedAt: string;
  nodeId: string;
  replicaNodeId?: string;
  version?: number;
  checksum?: string;
  consistencyStatus?: 'consistent' | 'inconsistent' | 'unchecked';
}

export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  totalChunks: number;
  chunkIds: string[];
  nodeDistribution: { [chunkIndex: number]: string };
  createdAt: string;
  version?: number;
  checksum?: string;
  chunkSizeKb?: number;
}

export interface FileChunk {
  chunkId: string;
  fileName: string;
  fileType: string;
  chunkIndex: number;
  totalChunks: number;
  data: string;
  sizeBytes: number;
  checksum?: string;
  version?: number;
}

export interface VectorMemory {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    category: string;
    agentName: string;
    timestamp: string;
    [key: string]: any;
  };
  nodeId: string;
  similarity?: number;
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

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  nodes: { name: string; url: string; anonKey: string }[];
  kvRecords: KVRecord[];
  files: FileMetadata[];
  vectors: VectorMemory[];
  config: Record<string, any>;
}
