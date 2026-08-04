import type { FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL = 'Xenova/bge-small-en-v1.5';

// Loaded once, on first use, and reused for every call — downloading and
// initializing the model per request would be far too slow.
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

const getExtractor = (): Promise<FeatureExtractionPipeline> => {
  // @xenova/transformers ships ESM-only (no CJS build), and this backend
  // compiles to CommonJS — a static `import` would throw ERR_REQUIRE_ESM at
  // runtime. A dynamic import() works from CJS regardless.
  extractorPromise ??= import('@xenova/transformers').then(({ pipeline }) =>
    pipeline('feature-extraction', MODEL),
  );
  return extractorPromise;
};

/** Embeds a batch of texts with bge-small-en-v1.5 (384 dimensions, mean-pooled,
 * normalized — the standard configuration for this model's intended cosine-
 * distance similarity search). */
export const embed = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];

  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });

  // Tensor#tolist() is typed `any[]` upstream (transformers.js ships no
  // stronger type for it) — shape here is guaranteed [texts.length, 384] by
  // the pooling config above, so this is the one deliberate boundary cast.
  return output.tolist() as unknown as number[][];
};
