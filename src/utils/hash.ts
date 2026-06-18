/**
 * Multiple hash algorithms for consistent hashing.
 * Supports FNV-1a, Murmur3, and XXHash-style.
 */

export type HashAlgorithm = 'fnv1a' | 'murmur3' | 'xxhash';

/**
 * FNV-1a 32-bit hash algorithm.
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Murmur3 32-bit hash implementation.
 */
export function murmur3(str: string): number {
  const seed = 0x9747b28c;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  const len = str.length;
  let h1 = seed;

  for (let i = 0; i < len; i += 4) {
    let k1 = 0;
    for (let j = 0; j < 4 && i + j < len; j++) {
      k1 |= (str.charCodeAt(i + j) & 0xff) << (j * 8);
    }
    if (len - i < 4) {
      if (len - i >= 3) k1 ^= (str.charCodeAt(i + 2) & 0xff) << 16;
      if (len - i >= 2) k1 ^= (str.charCodeAt(i + 1) & 0xff) << 8;
      if (len - i >= 1) k1 ^= str.charCodeAt(i) & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
      break;
    }

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

/**
 * Simple XXHash-style 32-bit hash.
 */
export function xxhash(str: string): number {
  const seed = 0x9e3779b9;
  let h32 = seed;
  const prime1 = 0x9e3779b1;
  const prime2 = 0x85ebca77;
  const prime3 = 0xc2b2ae3d;
  const prime4 = 0x27d4eb2f;
  const prime5 = 0x165667b1;

  const len = str.length;
  let index = 0;

  if (len >= 16) {
    let v1 = seed + prime1 + prime2;
    let v2 = seed + prime2;
    let v3 = seed;
    let v4 = seed - prime1;

    for (; index <= len - 16; index += 16) {
      let k1 = 0;
      for (let j = 0; j < 4; j++) k1 |= (str.charCodeAt(index + j) & 0xff) << (j * 8);
      k1 = Math.imul(k1, prime2);
      k1 = (k1 << 31) | (k1 >>> 1);
      k1 = Math.imul(k1, prime1);
      v1 ^= k1;
      v1 = (v1 << 27) | (v1 >>> 5);
      v1 = Math.imul(v1, prime1) + prime4;

      let k2 = 0;
      for (let j = 0; j < 4; j++) k2 |= (str.charCodeAt(index + 4 + j) & 0xff) << (j * 8);
      k2 = Math.imul(k2, prime2);
      k2 = (k2 << 31) | (k2 >>> 1);
      k2 = Math.imul(k2, prime1);
      v2 ^= k2;
      v2 = (v2 << 27) | (v2 >>> 5);
      v2 = Math.imul(v2, prime1) + prime4;

      let k3 = 0;
      for (let j = 0; j < 4; j++) k3 |= (str.charCodeAt(index + 8 + j) & 0xff) << (j * 8);
      k3 = Math.imul(k3, prime2);
      k3 = (k3 << 31) | (k3 >>> 1);
      k3 = Math.imul(k3, prime1);
      v3 ^= k3;
      v3 = (v3 << 27) | (v3 >>> 5);
      v3 = Math.imul(v3, prime1) + prime4;

      let k4 = 0;
      for (let j = 0; j < 4; j++) k4 |= (str.charCodeAt(index + 12 + j) & 0xff) << (j * 8);
      k4 = Math.imul(k4, prime2);
      k4 = (k4 << 31) | (k4 >>> 1);
      k4 = Math.imul(k4, prime1);
      v4 ^= k4;
      v4 = (v4 << 27) | (v4 >>> 5);
      v4 = Math.imul(v4, prime1) + prime4;
    }

    h32 = ((v1 << 1) | (v1 >>> 31)) +
          ((v2 << 7) | (v2 >>> 25)) +
          ((v3 << 12) | (v3 >>> 20)) +
          ((v4 << 18) | (v4 >>> 14));
  } else {
    h32 = seed + prime5;
  }

  h32 += len;

  const remaining = len - index;
  for (; index < len; index++) {
    h32 += (str.charCodeAt(index) & 0xff) * prime5;
    h32 = (h32 << 11) | (h32 >>> 21);
    h32 = Math.imul(h32, prime1);
  }

  h32 ^= h32 >>> 15;
  h32 = Math.imul(h32, prime2);
  h32 ^= h32 >>> 13;
  h32 = Math.imul(h32, prime3);
  h32 ^= h32 >>> 16;

  return h32 >>> 0;
}

export function hashString(str: string, algorithm: HashAlgorithm = 'fnv1a'): number {
  switch (algorithm) {
    case 'fnv1a': return fnv1a(str);
    case 'murmur3': return murmur3(str);
    case 'xxhash': return xxhash(str);
  }
}

export interface HashRingNode {
  nodeId: string;
  hash: number;
  label: string;
  angle: number;
}

export function buildHashRing(
  nodes: { id: string; name: string }[],
  virtualNodesCount = 4,
  algorithm: HashAlgorithm = 'fnv1a'
): HashRingNode[] {
  const ring: HashRingNode[] = [];
  const MAX_HASH = 0xffffffff;

  nodes.forEach((node) => {
    for (let i = 0; i < virtualNodesCount; i++) {
      const vnodeKey = `${node.id}#vnode#${i}`;
      const h = hashString(vnodeKey, algorithm);
      const angle = (h / MAX_HASH) * 360;
      ring.push({
        nodeId: node.id,
        hash: h,
        label: `${node.name} (V-${i})`,
        angle,
      });
    }
  });

  ring.sort((a, b) => a.hash - b.hash);
  return ring;
}

export function getNodeForKey(
  key: string,
  ring: HashRingNode[],
  algorithm: HashAlgorithm = 'fnv1a'
): { nodeId: string; keyHash: number; keyAngle: number; targetVNode: HashRingNode | null } {
  if (ring.length === 0) {
    return { nodeId: '', keyHash: 0, keyAngle: 0, targetVNode: null };
  }

  const keyHash = hashString(key, algorithm);
  const MAX_HASH = 0xffffffff;
  const keyAngle = (keyHash / MAX_HASH) * 360;

  const targetVNode = ring.find((vnode) => vnode.hash >= keyHash) || ring[0];

  return {
    nodeId: targetVNode.nodeId,
    keyHash,
    keyAngle,
    targetVNode,
  };
}

export function getReplicaNodes(
  primaryNodeId: string,
  allNodes: { id: string }[],
  count: number = 1
): string[] {
  const replicas: string[] = [];
  const primaryIndex = allNodes.findIndex((n) => n.id === primaryNodeId);

  for (let i = 1; i <= count && i < allNodes.length; i++) {
    const replicaNode = allNodes[(primaryIndex + i) % allNodes.length];
    if (replicaNode.id !== primaryNodeId) {
      replicas.push(replicaNode.id);
    }
  }

  return replicas;
}
