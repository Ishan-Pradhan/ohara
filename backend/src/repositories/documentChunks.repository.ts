import type { Transaction } from 'sequelize';
import { DocumentChunk } from '../models/documentChunks.model.js';
import type { DocumentChunkCreationAttributes } from '../types/documents.types.js';

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
};
