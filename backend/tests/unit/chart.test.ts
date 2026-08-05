import { describe, it, expect } from 'vitest';
import { validateChartSpec } from '../../src/utils/chart.js';

describe('validateChartSpec', () => {
  it('accepts a valid line chart spec', () => {
    const spec = validateChartSpec({
      type: 'line',
      title: 'y = x^2',
      xLabel: 'x',
      yLabel: 'y',
      series: [{ name: 'parabola', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }] }],
    });
    expect(spec.type).toBe('line');
  });

  it('rejects an unknown chart type', () => {
    expect(() =>
      validateChartSpec({
        type: 'pie',
        title: 'x',
        xLabel: 'x',
        yLabel: 'y',
        series: [{ name: 'a', points: [{ x: 0, y: 0 }] }],
      }),
    ).toThrow();
  });

  it('rejects a series with more than 200 points', () => {
    const points = Array.from({ length: 201 }, (_, i) => ({ x: i, y: i }));
    expect(() =>
      validateChartSpec({
        type: 'line',
        title: 'x',
        xLabel: 'x',
        yLabel: 'y',
        series: [{ name: 'a', points }],
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => validateChartSpec({ type: 'line' })).toThrow();
  });
});
