import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

import { EMBEDDING_MODEL } from '../constants/index.js';

// Loaded once, on first use, and reused for every call — downloading and
// initializing the model per request would be far too slow.
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

const getExtractor = (): Promise<FeatureExtractionPipeline> => {
  extractorPromise ??= pipeline('feature-extraction', EMBEDDING_MODEL);
  return extractorPromise;
};

/** Embeds a batch of texts with bge-small-en-v1.5 (mean-pooled, normalized —
 * the standard configuration for this model's intended cosine-distance
 * similarity search). Output dimension is EMBEDDING_DIMENSIONS
 * (constants/index.ts). */
export const embed = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];

  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });

  // Tensor#tolist() is typed `any[]` upstream (transformers.js ships no
  // stronger type for it) — shape here is guaranteed [texts.length,
  // EMBEDDING_DIMENSIONS] by the pooling config above, so this is the one
  // deliberate boundary cast.
  return output.tolist() as unknown as number[][];
};
