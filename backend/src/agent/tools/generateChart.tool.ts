import { validateChartSpec } from '../../utils/chart.js';
import type { AgentTool } from '../../types/agent.types.js';
import type { ToolContext, ToolExecutionResult } from './index.js';

export const generateChartTool: AgentTool = {
  name: 'generate_chart',
  description:
    'Emit a chart to illustrate a concept (e.g. a graph shape, a sample function, a worked example) for the student. Only for illustration with sampled/example points you supply — never claim these are the student\'s real grades or performance data, which this tool has no access to.',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['line', 'bar', 'scatter', 'function'] },
      title: { type: 'string' },
      xLabel: { type: 'string' },
      yLabel: { type: 'string' },
      series: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            points: {
              type: 'array',
              items: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' } },
                required: ['x', 'y'],
              },
            },
          },
          required: ['name', 'points'],
        },
      },
    },
    required: ['type', 'title', 'xLabel', 'yLabel', 'series'],
  },
};

export const executeGenerateChart = async (
  rawArgs: string,
  _ctx: ToolContext,
): Promise<ToolExecutionResult> => {
  const spec = validateChartSpec(JSON.parse(rawArgs));
  return {
    content: `Chart "${spec.title}" generated and shown to the student.`,
    sources: null,
    chart: spec,
  };
};
