import { fnv1a } from './hash';

/**
 * Generates a deterministic 384-dimensional unit vector embedding based on word hashing.
 * Words that are the same will map to the same dimensions, creating a realistic
 * word-overlap semantic similarity model that runs client-side in microseconds.
 */
export function generateMockEmbedding(text: string): number[] {
  const dimensions = 384;
  const vector = new Array(dimensions).fill(0);
  
  // Clean text and split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (words.length === 0) {
    // Return a random unit vector for empty text
    vector[0] = 1;
    return vector;
  }

  words.forEach((word) => {
    // Seeded random number generator based on the word's FNV-1a hash
    let seed = fnv1a(word);
    const rand = () => {
      // Linear Congruential Generator (LCG)
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Distribute this word's influence across 10 deterministic dimensions
    for (let i = 0; i < 10; i++) {
      const dim = Math.floor(rand() * dimensions);
      const weight = rand() * 2 - 1; // -1 to 1
      vector[dim] += weight;
    }
  });

  // Normalize the vector to unit length (Euclidean L2 norm)
  // This ensures that the dot product is exactly equal to the cosine similarity
  let sumOfSquares = 0;
  for (let i = 0; i < dimensions; i++) {
    sumOfSquares += vector[i] * vector[i];
  }
  
  const magnitude = Math.sqrt(sumOfSquares);
  
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= magnitude;
    }
  } else {
    vector[0] = 1;
  }

  return vector;
}

/**
 * Calculates the cosine similarity between two vectors.
 * Since our mock embeddings are normalized to unit length, this is just the dot product!
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  
  // Bound between -1 and 1, then scale to 0 to 1 for easier UI display
  const cosine = Math.max(-1, Math.min(1, dotProduct));
  return (cosine + 1) / 2;
}
