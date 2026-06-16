/**
 * FNV-1a 32-bit hash algorithm.
 * Extremely fast and provides a very uniform distribution of hashes.
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by FNV prime
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

export interface HashRingNode {
  nodeId: string;
  hash: number;
  label: string;
  angle: number; // For rendering on a 360deg circle
}

/**
 * Builds a consistent hashing ring using virtual nodes to distribute keys more evenly.
 */
export function buildHashRing(nodes: { id: string; name: string }[], virtualNodesCount = 3): HashRingNode[] {
  const ring: HashRingNode[] = [];
  const MAX_HASH = 0xffffffff;

  nodes.forEach((node) => {
    for (let i = 0; i < virtualNodesCount; i++) {
      const vnodeKey = `${node.id}#vnode#${i}`;
      const hash = fnv1a(vnodeKey);
      const angle = (hash / MAX_HASH) * 360;
      ring.push({
        nodeId: node.id,
        hash,
        label: `${node.name} (V-${i})`,
        angle,
      });
    }
  });

  // Sort by hash ascending
  ring.sort((a, b) => a.hash - b.hash);
  return ring;
}

/**
 * Finds the node responsible for a given key in the consistent hash ring.
 */
export function getNodeForKey(key: string, ring: HashRingNode[]): { nodeId: string; keyHash: number; keyAngle: number; targetVNode: HashRingNode | null } {
  if (ring.length === 0) {
    return { nodeId: '', keyHash: 0, keyAngle: 0, targetVNode: null };
  }

  const keyHash = fnv1a(key);
  const MAX_HASH = 0xffffffff;
  const keyAngle = (keyHash / MAX_HASH) * 360;

  // Find the first virtual node with a hash >= keyHash
  let targetVNode = ring.find((vnode) => vnode.hash >= keyHash) || null;

  // If none found, wrap around to the first node on the ring
  if (!targetVNode) {
    targetVNode = ring[0];
  }

  return {
    nodeId: targetVNode.nodeId,
    keyHash,
    keyAngle,
    targetVNode,
  };
}


