import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import type { ExamTermCreationAttributes } from '../types/examMarks.types.js';
import { examTermRepository } from '../repositories/examTerms.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { serializeExamTerm } from '../serializers/examTerm.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const createExamTerm = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, academicYearId } = req.validated?.body as Pick<
      ExamTermCreationAttributes,
      'name' | 'academicYearId'
    >;
    const createdBy = req.user?.id;
    if (!createdBy) {
      throw new ApiError(401, 'Unauthorized');
    }

    const year = await academicYearRepository.findById(academicYearId);
    if (!year) {
      throw new ApiError(404, 'Academic year not found');
    }

    const term = await examTermRepository.create({ name, academicYearId, createdBy });
    return ok(res, serializeExamTerm(term), 'Exam term created', 201);
  },
);

export const listExamTerms = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { academicYearId } = req.validated?.query as { academicYearId?: string };
    const terms = await examTermRepository.findAll({ academicYearId });
    return ok(res, terms.map(serializeExamTerm), 'Exam terms retrieved');
  },
);

export const deleteExamTerm = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const deleted = await examTermRepository.delete(id);
    if (!deleted) {
      throw new ApiError(404, 'Exam term not found');
    }
    return ok(res, null, 'Exam term deleted');
  },
);
