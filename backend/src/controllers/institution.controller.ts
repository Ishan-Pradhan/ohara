import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { ProgramCreationAttributes, ClassCreationAttributes } from '../types/institution.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { serializeProgram, serializeClass } from '../serializers/institution.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// ── PROGRAMS ────────────────────────────────────────────────────────────────

export const createProgram = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, institutionType, description } =
      req.validated?.body as ProgramCreationAttributes;

    const program = await programRepository.create({
      name,
      institutionType,
      description: description ?? null,
    });

    return ok(res, serializeProgram(program), 'Program created', 201);
  },
);

export const listPrograms = asyncHandler(
  async (_req: AuthRequest, res: Response) => {
    const programs = await programRepository.findAll();
    return ok(res, programs.map(serializeProgram), 'Programs retrieved');
  },
);

// ── CLASSES ─────────────────────────────────────────────────────────────────

export const createClass = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { programId, name, orderIndex } =
      req.validated?.body as ClassCreationAttributes;

    const program = await programRepository.findById(programId);
    if (!program) {
      throw new ApiError(404, 'Program not found');
    }

    const cls = await classRepository.create({ programId, name, orderIndex });
    return ok(res, serializeClass(cls), 'Class created', 201);
  },
);

export const listClasses = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { programId } = req.validated?.query as { programId?: string };
    const classes = await classRepository.findAll({ programId });
    return ok(res, classes.map(serializeClass), 'Classes retrieved');
  },
);
