import { CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS } from '../constants/index.js';

// How far past a chunk boundary to look for a space before cutting a word in
// half. Not model-tuned like CHUNK_SIZE_CHARS/CHUNK_OVERLAP_CHARS — just a
// small local slack, so it stays a plain local constant.
const WORD_BOUNDARY_SLACK_CHARS = 50;

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
  const chunkSize = options.chunkSize ?? CHUNK_SIZE_CHARS;
  const overlap = options.overlap ?? CHUNK_OVERLAP_CHARS;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const nextSpace = normalized.indexOf(' ', end);
      if (nextSpace !== -1 && nextSpace - end < WORD_BOUNDARY_SLACK_CHARS) {
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
