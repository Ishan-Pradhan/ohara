import fs from 'node:fs/promises';
import type { Response } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import { documentRepository } from '../repositories/documents.repository.js';
import { documentChunkRepository } from '../repositories/documentChunks.repository.js';
import { serializeDocument } from '../serializers/documents.serializer.js';
import { extractText } from '../services/pdf.service.js';
import { embed } from '../services/embeddings.service.js';
import { chunkText } from '../utils/chunk.utils.js';
import { ensureDocumentsDir, documentFilePath } from '../utils/storage.utils.js';
import { DOCUMENT_STATUS } from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/** Runs after the upload response is already sent — never awaited by the
 * request. Any failure here is caught and recorded on the document row
 * itself; there is nothing left to respond to. */
const processDocument = async (documentId: string, buffer: Buffer): Promise<void> => {
  try {
    const text = await extractText(buffer);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await documentRepository.setStatus(
        documentId,
        DOCUMENT_STATUS.FAILED,
        'No extractable text found in this PDF',
      );
      return;
    }

    const embeddings = await embed(chunks);

    await sequelize.transaction(async (transaction) => {
      await documentChunkRepository.bulkCreate(
        chunks.map((content, chunkIndex) => ({
          documentId,
          chunkIndex,
          content,
          embedding: embeddings[chunkIndex] as number[],
        })),
        transaction,
      );
    });

    await documentRepository.setStatus(documentId, DOCUMENT_STATUS.READY);
  } catch (err) {
    logger.error({ err, documentId }, 'Document processing failed');
    await documentRepository.setStatus(
      documentId,
      DOCUMENT_STATUS.FAILED,
      'Could not process this PDF',
    );
  }
};

export const uploadDocument = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }

    const document = await documentRepository.create({
      courseId,
      uploadedBy: userId,
      filename: req.file.originalname,
      storageKey: '', // filled in below, once the id (and therefore the path) exists
    });

    await ensureDocumentsDir();
    const filePath = documentFilePath(document.id);
    await fs.writeFile(filePath, req.file.buffer);
    await document.update({ storageKey: filePath });

    // Fire-and-forget: the response goes out now, processing continues after.
    void processDocument(document.id, req.file.buffer);

    return ok(res, serializeDocument(document), 'Document accepted, processing', 202);
  },
);

export const listDocuments = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const documents = await documentRepository.findAllByCourse(courseId);
    return ok(res, documents.map(serializeDocument), 'Documents retrieved');
  },
);

export const deleteDocument = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };

    const document = await documentRepository.findById(id);
    // requireCourseTeacher only confirmed the caller may manage :courseId —
    // without this check, a teacher could delete a document belonging to a
    // different course by supplying its id here.
    if (!document || document.courseId !== courseId) {
      throw new ApiError(404, 'Document not found');
    }

    const filePath = document.storageKey;
    await documentRepository.delete(id);

    try {
      await fs.unlink(filePath);
    } catch (err) {
      logger.warn({ err, documentId: id }, 'Could not remove document file from disk');
    }

    return ok(res, null, 'Document deleted');
  },
);
