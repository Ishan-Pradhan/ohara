import { z } from 'zod';
import { embed } from '../../services/embeddings.service.js';
import { documentChunkRepository } from '../../repositories/documentChunks.repository.js';
import { TUTOR_RETRIEVAL_K, TUTOR_RELEVANCE_MAX_DISTANCE } from '../../constants/index.js';
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

  // knowledgeBaseDocumentId comes from ctx (orchestrator-injected, resolved
  // from the course once per turn), never from the model's arguments — this
  // is what makes the tool scoped to the teacher's selected document, not
  // the model's good behavior. No document selected means nothing to
  // search, so skip the embed call entirely rather than searching nothing.
  if (!ctx.knowledgeBaseDocumentId) {
    return { content: 'No relevant material found for this query.', sources: null };
  }

  const [queryVector] = await embed([query]);
  if (!queryVector) {
    return { content: 'Search failed — could not embed the query.', sources: null };
  }

  const chunks = await documentChunkRepository.findSimilar(
    ctx.knowledgeBaseDocumentId,
    queryVector,
    TUTOR_RETRIEVAL_K,
    TUTOR_RELEVANCE_MAX_DISTANCE,
  );

  if (chunks.length === 0) {
    return { content: 'No relevant material found for this query.', sources: null };
  }

  const excerpts = await Promise.all(
    chunks.map(async (chunk) => {
      const document = chunk.document ?? (await chunk.$get('document'));
      return {
        documentId: chunk.documentId,
        filename: document?.filename ?? 'Unknown document',
        chunkContent: chunk.content,
      };
    }),
  );

  const content = excerpts
    .map((s, i) => `[Excerpt ${i + 1}, from "${s.filename}"]\n${s.chunkContent}`)
    .join('\n\n');

  // The model sees every excerpt above (multiple chunks from the same
  // document carry distinct content, all worth showing) — but citations are
  // one badge per document, not per chunk, so dedupe here for `sources`
  // specifically, keeping the first (closest) chunk's document entry.
  const seenDocumentIds = new Set<string>();
  const sources = excerpts.filter((s) => {
    if (seenDocumentIds.has(s.documentId)) return false;
    seenDocumentIds.add(s.documentId);
    return true;
  });

  return { content, sources };
};
