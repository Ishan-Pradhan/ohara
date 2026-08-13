import type { Transaction } from 'sequelize';
import { QueryTypes } from 'sequelize';
import pgvector from 'pgvector';
import { DocumentChunk } from '../models/documentChunks.model.js';
import type { DocumentChunkCreationAttributes } from '../types/documents.types.js';
import { sequelize } from '../config/db.js';

export const documentChunkRepository = {
  bulkCreate: async (
    data: DocumentChunkCreationAttributes[],
    transaction?: Transaction,
  ): Promise<DocumentChunk[]> => {
    return await DocumentChunk.bulkCreate(data, { transaction });
  },

  countByDocument: async (documentId: string): Promise<number> => {
    return await DocumentChunk.count({ where: { documentId } });
  },

  /** Whether the given document has any chunked, ready material at all —
   * checked up front by the tutor agent so it can refuse deterministically
   * before ever calling the LLM, rather than trusting the model to admit "no
   * material" on its own (see tutorAgent.ts for why that trust fails in
   * practice). Scoped by documentId, not courseId: a course may have several
   * uploaded documents, but only its `knowledgeBaseDocumentId` (courses.model.ts)
   * is ever searched — findSimilar below uses the same scoping. */
  existsForDocument: async (documentId: string): Promise<boolean> => {
    const row = await sequelize.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM "DocumentChunks" dc
         JOIN "Documents" d ON d.id = dc."documentId"
         WHERE dc."documentId" = :documentId AND d.status = 'ready'
       ) AS "exists"`,
      {
        replacements: { documentId },
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return row?.exists ?? false;
  },

  /** Cosine-nearest chunks within one ready document — the course's selected
   * knowledge-base document, not every document it has uploaded (see
   * courses.knowledgeBaseDocumentId). Raw query — pgvector's `<=>` operator
   * and ORDER BY/LIMIT aren't expressible through sequelize-typescript's
   * query builder.
   *
   * `maxDistance` is optional and off by default (existing callers —
   * quiz/lesson-planner/course-structure generation — are unaffected): when
   * given, chunks whose cosine distance from the query exceeds it are
   * excluded, filtered in SQL rather than after the fact so LIMIT still
   * caps real work. Callers that want "nothing genuinely relevant" to come
   * back as an empty result instead of the k nearest-anyway chunks (the
   * tutor — see TUTOR_RELEVANCE_MAX_DISTANCE) pass it explicitly. */
  findSimilar: async (
    documentId: string,
    queryVector: number[],
    k: number,
    maxDistance?: number,
  ): Promise<DocumentChunk[]> => {
    const distanceFilter = maxDistance !== undefined ? 'AND (dc.embedding <=> :vector) < :maxDistance' : '';
    return await sequelize.query<DocumentChunk>(
      `SELECT dc.* FROM "DocumentChunks" dc
       JOIN "Documents" d ON d.id = dc."documentId"
       WHERE dc."documentId" = :documentId AND d.status = 'ready' ${distanceFilter}
       ORDER BY dc.embedding <=> :vector
       LIMIT :k`,
      {
        replacements: { documentId, vector: pgvector.toSql(queryVector), k, maxDistance: maxDistance ?? null },
        type: QueryTypes.SELECT,
        model: DocumentChunk,
        mapToModel: true,
      },
    );
  },
};
