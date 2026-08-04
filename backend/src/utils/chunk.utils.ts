const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 100;

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * Splits text into overlapping chunks for embedding. Whitespace (including
 * newlines from PDF extraction) is normalized to single spaces first, so
 * chunk boundaries are plain character offsets — kept off word boundaries by
 * extending to the next space when one is nearby, so words aren't split
 * mid-token.
 */
export const chunkText = (text: string, options: ChunkOptions = {}): string[] => {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const nextSpace = normalized.indexOf(' ', end);
      if (nextSpace !== -1 && nextSpace - end < 50) {
        end = nextSpace;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = end - overlap;
  }

  return chunks;
};
