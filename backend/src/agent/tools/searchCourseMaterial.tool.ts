import { z } from 'zod';
import { embed } from '../../services/embeddings.service.js';
import { documentChunkRepository } from '../../repositories/documentChunks.repository.js';
import { TUTOR_RETRIEVAL_K } from '../../constants/index.js';
import type { AgentTool } from '../../types/agent.types.js';
import type { ToolContext, ToolExecutionResult } from './index.js';

export const searchCourseMaterialTool: AgentTool = {
  name: 'search_course_material',
  description:
    "Search this course's uploaded material for content relevant to a query. Returns the most relevant excerpts with their source document names.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' },
    },
    required: ['query'],
  },
};

const argsSchema = z.object({ query: z.string().min(1) });

export const executeSearchCourseMaterial = async (
  rawArgs: string,
  ctx: ToolContext,
): Promise<ToolExecutionResult> => {
  const { query } = argsSchema.parse(JSON.parse(rawArgs));

  const [queryVector] = await embed([query]);
  if (!queryVector) {
    return { content: 'Search failed — could not embed the query.', sources: null };
  }

  // courseId comes from ctx (orchestrator-injected), never from the model's
  // arguments — this is what makes the tool course-scoped, not the model's
  // good behavior.
  const chunks = await documentChunkRepository.findSimilar(ctx.courseId, queryVector, TUTOR_RETRIEVAL_K);

  if (chunks.length === 0) {
    return { content: 'No relevant material found for this query.', sources: null };
  }

  const sources = await Promise.all(
    chunks.map(async (chunk) => {
      const document = chunk.document ?? (await chunk.$get('document'));
      return {
        documentId: chunk.documentId,
        filename: document?.filename ?? 'Unknown document',
        chunkContent: chunk.content,
      };
    }),
  );

  const content = sources
    .map((s, i) => `[Excerpt ${i + 1}, from "${s.filename}"]\n${s.chunkContent}`)
    .join('\n\n');

  return { content, sources };
};
