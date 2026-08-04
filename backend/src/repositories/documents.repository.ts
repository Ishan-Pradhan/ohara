import { Document } from '../models/documents.model.js';
import type {
  DocumentCreationAttributes,
  DocumentStatus,
} from '../types/documents.types.js';

export const documentRepository = {
  create: async (data: DocumentCreationAttributes): Promise<Document> => {
    return await Document.create(data);
  },

  findAllByCourse: async (courseId: string): Promise<Document[]> => {
    return await Document.findAll({
      where: { courseId },
      order: [['createdAt', 'DESC']],
    });
  },

  findById: async (id: string): Promise<Document | null> => {
    return await Document.findByPk(id);
  },

  setStatus: async (
    id: string,
    status: DocumentStatus,
    errorMessage: string | null = null,
  ): Promise<Document | null> => {
    const document = await Document.findByPk(id);
    if (!document) return null;
    return await document.update({ status, errorMessage });
  },

  /** `document_chunks.documentId` is ON DELETE CASCADE — deleting a document
   * sweeps away its chunks. The file on disk is removed separately by the
   * controller (storageKey is a filesystem path, not this repository's
   * concern). */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Document.destroy({ where: { id } });
    return deleted > 0;
  },
};
