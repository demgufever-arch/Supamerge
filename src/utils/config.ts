/**
 * System configuration for SupaMerge.
 * Allows runtime configuration of hashing algorithms, replication factors, etc.
 */

export interface SystemConfig {
  hashingAlgorithm: 'fnv1a' | 'murmur3' | 'xxhash';
  replicationFactor: number;
  virtualNodesCount: number;
  vectorDimensions: number;
  chunkSizeKb: number;
  autoRepair: boolean;
  consistencyLevel: 'eventual' | 'strong' | 'read-repair';
}

const STORAGE_KEY = 'supamerge_config';

const DEFAULTS: SystemConfig = {
  hashingAlgorithm: 'fnv1a',
  replicationFactor: 2,
  virtualNodesCount: 4,
  vectorDimensions: 384,
  chunkSizeKb: 256,
  autoRepair: true,
  consistencyLevel: 'read-repair',
};

export function getSystemConfig(): SystemConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function setSystemConfig(updates: Partial<SystemConfig>): SystemConfig {
  const current = getSystemConfig();
  const updated = { ...current, ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function resetSystemConfig(): SystemConfig {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULTS };
}

export function getConfigDisplay(config: SystemConfig): string {
  return [
    `hash=${config.hashingAlgorithm}`,
    `replicas=${config.replicationFactor}`,
    `vnodes=${config.virtualNodesCount}`,
    `vectors=${config.vectorDimensions}d`,
    `chunk=${config.chunkSizeKb}kb`,
    `consistency=${config.consistencyLevel}`,
  ].join(' | ');
}
