import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { ProgramCreationAttributes } from '../types/institution.types.js';
import { programRepository } from '../repositories/programs.repository.js';
import { serializeProgram } from '../serializers/institution.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';

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
