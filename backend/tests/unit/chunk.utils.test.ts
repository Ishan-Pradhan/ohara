import { describe, it, expect } from 'vitest';
import { chunkText } from '../../src/utils/chunk.utils.js';

describe('chunkText', () => {
  it('returns an empty array for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('returns a single chunk for text shorter than the chunk size', () => {
    const chunks = chunkText('A short sentence.', { chunkSize: 1000, overlap: 100 });
    expect(chunks).toEqual(['A short sentence.']);
  });

  it('normalizes internal whitespace (newlines, repeated spaces) to single spaces', () => {
    const chunks = chunkText('Line one\n\nLine   two\ttab', { chunkSize: 1000, overlap: 100 });
    expect(chunks).toEqual(['Line one Line two tab']);
  });

  it('splits long text into multiple overlapping chunks', () => {
    const text = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100 + 50); // + the word-boundary extension slack
    }
  });

  it('produces overlapping content between consecutive chunks', () => {
    const text = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    const firstChunkTail = chunks[0]?.slice(-10);
    expect(firstChunkTail).toBeDefined();
    expect(chunks[1]).toContain(firstChunkTail);
  });

  it('never drops content — every word from the input appears in at least one chunk', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`);
    const chunks = chunkText(words.join(' '), { chunkSize: 100, overlap: 20 });
    const joined = chunks.join(' ');

    for (const word of words) {
      expect(joined).toContain(word);
    }
  });
});
