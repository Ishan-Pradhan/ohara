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

  /** Cosine-nearest chunks for a course's ready documents only. Raw query —
   * pgvector's `<=>` operator and ORDER BY/LIMIT aren't expressible through
   * sequelize-typescript's query builder. */
  findSimilar: async (
    courseId: string,
    queryVector: number[],
    k: number,
  ): Promise<DocumentChunk[]> => {
    return await sequelize.query<DocumentChunk>(
      `SELECT dc.* FROM "DocumentChunks" dc
       JOIN "Documents" d ON d.id = dc."documentId"
       WHERE d."courseId" = :courseId AND d.status = 'ready'
       ORDER BY dc.embedding <=> :vector
       LIMIT :k`,
      {
        replacements: { courseId, vector: pgvector.toSql(queryVector), k },
        type: QueryTypes.SELECT,
        model: DocumentChunk,
        mapToModel: true,
      },
    );
  },
};
