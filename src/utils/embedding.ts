/**
 * Mock embedding generator - deterministic, not ML-backed.
 * For demo purposes. Replace with real embedding model in production.
 */

export function generateMockEmbedding(text: string, dimensions = 384): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = ((seed << 5) - seed) + text.charCodeAt(i);
    seed |= 0;
  }

  const embedding: number[] = [];
  for (let d = 0; d < dimensions; d++) {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    embedding.push((seed / 0x7fffffff) * 2 - 1);
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / magnitude);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Build a pgvector-compatible SQL query for vector search.
 */
export function buildPgVectorSearchQuery(
  table: string,
  embeddingColumn: string,
  queryEmbedding: number[],
  matchThreshold: number = 0.7,
  matchCount: number = 10,
  filterColumn?: string,
  filterValue?: string
): string {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  let sql = `SELECT *, ${embeddingColumn} <=> '${embeddingStr}'::vector AS distance
FROM ${table}
WHERE ${embeddingColumn} <=> '${embeddingStr}'::vector < ${1 - matchThreshold}`;

  if (filterColumn && filterValue) {
    sql += ` AND ${filterColumn} = '${filterValue}'`;
  }

  sql += ` ORDER BY ${embeddingColumn} <=> '${embeddingStr}'::vector
LIMIT ${matchCount}`;

  return sql;
}

/**
 * Merge and deduplicate search results from multiple nodes.
 */
export function mergeSearchResults(
  results: { nodeId: string; data: any[] }[],
  idField: string = 'id',
  sortByScore: boolean = true
): any[] {
  const seen = new Set<string>();
  const merged: any[] = [];

  for (const nodeResult of results) {
    for (const item of nodeResult.data) {
      const id = item[idField];
      if (!seen.has(id)) {
        seen.add(id);
        merged.push({ ...item, _sourceNode: nodeResult.nodeId });
      }
    }
  }

  if (sortByScore && merged[0]?.similarity !== undefined) {
    merged.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }

  return merged;
}
