import fs from 'node:fs/promises';
import type { Response, NextFunction } from 'express';

import { sequelize } from '../config/db.js';
import type { AuthRequest } from '../types/auth.types.js';
import { documentRepository } from '../repositories/documents.repository.js';
import { documentChunkRepository } from '../repositories/documentChunks.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
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

// ── Viewing ──────────────────────────────────────────────────────────────────

/** Streams the raw PDF inline (not as a download) — the source for the
 * raw-document viewer, used by both the management UI (teacher/admin
 * preview) and the student-facing reader (via listViewableDocuments below
 * for discovery). requireCourseAccess (not requireCourseTeacher) gates the
 * route, so admins, assigned teachers, and enrolled students can all reach
 * it. Deliberately not gated by document status here — the file lands on
 * disk at upload time, before ingestion runs, so a teacher previewing a
 * still-processing or failed document isn't blocked; only
 * listViewableDocuments filters by status for the student-facing list. */
export const getDocumentFile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };

    const document = await documentRepository.findById(id);
    if (!document || document.courseId !== courseId) {
      throw new ApiError(404, 'Document not found');
    }

    // filename is the original uploaded filename (user-supplied at upload
    // time) — strip characters that could break the header value, and
    // additionally encode it via the RFC 5987 extended parameter so
    // non-ASCII names still round-trip correctly in browsers that support it.
    const safeFilename = document.filename.replace(/["\r\n]/g, '');
    res.set(
      'Content-Disposition',
      `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
    );
    res.type('application/pdf');
    res.sendFile(document.storageKey, (err) => {
      // sendFile's error callback fires outside the try/catch asyncHandler
      // wraps this function in — route it through the normal error-handling
      // middleware ourselves so the response envelope stays consistent.
      // headersSent guards against double-responding if the error happened
      // after streaming had already begun.
      if (err && !res.headersSent) {
        logger.warn({ err, documentId: id }, 'Document file missing from disk');
        next(new ApiError(404, 'File not found on disk'));
      }
    });
  },
);

/** The student-facing counterpart to listDocuments: only status: 'ready'
 * documents (nothing still processing or failed), and only once the course
 * is published — same gate getCourseOutline (tutor.controller.ts) uses for
 * modules/lessons, so a course's raw documents and its structured content
 * become visible to students at the same moment. */
export const listViewableDocuments = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const course = await courseRepository.findById(courseId);
    if (!course || !course.isPublished) {
      throw new ApiError(404, 'Course not found');
    }

    const documents = await documentRepository.findAllByCourse(courseId);
    const viewable = documents.filter((d) => d.status === DOCUMENT_STATUS.READY);
    return ok(res, viewable.map(serializeDocument), 'Documents retrieved');
  },
);

// ── Knowledge base selection ────────────────────────────────────────────────

/** Sets (or, with documentId: null, clears) which single uploaded document
 * the tutor and quiz generation are allowed to ground answers/questions in
 * — see Course.knowledgeBaseDocumentId. A course can have several uploaded
 * documents; only one is ever searched. */
export const setKnowledgeBaseDocument = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { documentId } = req.validated?.body as { documentId: string | null };

    if (documentId !== null) {
      const document = await documentRepository.findById(documentId);
      if (!document || document.courseId !== courseId) {
        throw new ApiError(404, 'Document not found');
      }
      if (document.status !== DOCUMENT_STATUS.READY) {
        throw new ApiError(400, 'Only a fully processed document can be selected as the knowledge base');
      }
    }

    const course = await courseRepository.setKnowledgeBaseDocument(courseId, documentId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    return ok(
      res,
      { id: course.id, knowledgeBaseDocumentId: course.knowledgeBaseDocumentId },
      'Knowledge base document updated',
    );
  },
);

/** Sets (or, with documentId: null, clears) which single uploaded document
 * defines this course's official module/lesson structure — see
 * Course.syllabusDocumentId and generateSkeleton (courseContent.controller.ts),
 * which uses this document's own text to produce a skeleton matching an
 * official syllabus instead of inventing a grouping. Independent of
 * setKnowledgeBaseDocument above — same validation shape (must belong to
 * this course, must be status: 'ready'), different course field. */
export const setSyllabusDocument = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { documentId } = req.validated?.body as { documentId: string | null };

    if (documentId !== null) {
      const document = await documentRepository.findById(documentId);
      if (!document || document.courseId !== courseId) {
        throw new ApiError(404, 'Document not found');
      }
      if (document.status !== DOCUMENT_STATUS.READY) {
        throw new ApiError(400, 'Only a fully processed document can be selected as the syllabus');
      }
    }

    const course = await courseRepository.setSyllabusDocument(courseId, documentId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    return ok(
      res,
      { id: course.id, syllabusDocumentId: course.syllabusDocumentId },
      'Syllabus document updated',
    );
  },
);

// ── Shared RAG grounding helper ─────────────────────────────────────────────

/** Embeds `query` and searches the given knowledge base document (a
 * course's Course.knowledgeBaseDocumentId — the caller resolves the course
 * itself, since some callers, e.g. lessonPlanner.controller.ts, already
 * have it loaded for other fields and shouldn't fetch it twice) via the same
 * retrieval the tutor's search_course_material tool uses. Returns null —
 * never an empty string — when knowledgeBaseDocumentId is null, the embed
 * call fails, or nothing relevant is found, so callers can fall back to
 * their own default instead of silently grounding on nothing. Shared by
 * quizzes.controller.ts and lessonPlanner.controller.ts (both had a
 * "topic-only" generation path that previously sent the bare topic string
 * to the LLM with no connection to the course's actual material); same
 * precedent as courses.controller.ts's resolveCurrentAcademicYearForCourse
 * being reused across controllers. */
export const retrieveKnowledgeBaseMaterial = async (
  knowledgeBaseDocumentId: string | null,
  query: string,
  k: number,
): Promise<string | null> => {
  if (!knowledgeBaseDocumentId) {
    return null;
  }

  const [queryVector] = await embed([query]);
  if (!queryVector) {
    return null;
  }

  const chunks = await documentChunkRepository.findSimilar(knowledgeBaseDocumentId, queryVector, k);
  if (chunks.length === 0) {
    return null;
  }

  return chunks.map((c) => c.content).join('\n\n---\n\n');
};
