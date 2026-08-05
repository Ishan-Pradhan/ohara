import { z } from 'zod';

// Whitelisted chart types only — the model can never request an arbitrary
// rendering primitive, per ARCHITECTURE.md §7's chart guardrail.
export const chartSpecSchema = z.object({
  type: z.enum(['line', 'bar', 'scatter', 'function']),
  title: z.string().min(1).max(120),
  xLabel: z.string().max(60),
  yLabel: z.string().max(60),
  series: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        points: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .min(1)
          .max(200), // size cap — a chart is an illustration, not a data dump
      }),
    )
    .min(1)
    .max(6),
});

export type ChartSpec = z.infer<typeof chartSpecSchema>;

/** Throws a ZodError on invalid input — callers (tool handlers) catch this
 * and convert it into a tool-error result, never let it escape raw. */
export const validateChartSpec = (input: unknown): ChartSpec => chartSpecSchema.parse(input);
