import { describe, it, expect } from 'vitest';
import {
  getPaginationParams,
  buildPaginationMeta,
} from '../../src/utils/pagination.utils.js';

describe('getPaginationParams', () => {
  it('defaults to page 1, limit 10', () => {
    expect(getPaginationParams({})).toEqual({ page: 1, limit: 10, offset: 0 });
  });

  it('computes the offset from page and limit', () => {
    expect(getPaginationParams({ page: '3', limit: '20' })).toEqual({
      page: 3,
      limit: 20,
      offset: 40,
    });
  });

  it('clamps the limit to 100', () => {
    expect(getPaginationParams({ limit: '5000' }).limit).toBe(100);
  });

  it('floors a zero or negative page at 1', () => {
    expect(getPaginationParams({ page: '0' }).page).toBe(1);
    expect(getPaginationParams({ page: '-4' }).page).toBe(1);
  });

  it('falls back to defaults for non-numeric input', () => {
    expect(getPaginationParams({ page: 'abc', limit: 'xyz' })).toEqual({
      page: 1,
      limit: 10,
      offset: 0,
    });
  });
});

describe('buildPaginationMeta', () => {
  it('rounds the page count up', () => {
    const meta = buildPaginationMeta({
      totalItems: 42,
      page: 1,
      limit: 10,
      itemCount: 10,
    });
    expect(meta.totalPages).toBe(5);
    expect(meta.currentPage).toBe(1);
    expect(meta.itemsPerPage).toBe(10);
  });
});
