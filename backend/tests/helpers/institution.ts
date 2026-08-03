import { programRepository } from '../../src/repositories/programs.repository.js';
import { classRepository } from '../../src/repositories/classes.repository.js';
import { academicYearRepository } from '../../src/repositories/academicYears.repository.js';
import type { Program } from '../../src/models/programs.model.js';
import type { Class } from '../../src/models/classes.model.js';
import type { AcademicYear } from '../../src/models/academicYears.model.js';
import type { InstitutionType } from '../../src/types/institution.types.js';

export const createProgram = async (
  overrides: Partial<{
    name: string;
    institutionType: InstitutionType;
    description: string | null;
  }> = {},
): Promise<Program> => {
  return programRepository.create({
    name: overrides.name ?? 'Test Program',
    institutionType: overrides.institutionType ?? 'school',
    description: overrides.description ?? null,
  });
};

export const createClass = async (
  overrides: Partial<{ programId: string; name: string; orderIndex: number }> = {},
): Promise<Class> => {
  const programId = overrides.programId ?? (await createProgram()).id;

  return classRepository.create({
    programId,
    name: overrides.name ?? 'Test Class',
    orderIndex: overrides.orderIndex ?? 1,
  });
};

export const createAcademicYear = async (
  overrides: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }> = {},
): Promise<AcademicYear> => {
  return academicYearRepository.create({
    name: overrides.name ?? '2025-2026',
    startDate: overrides.startDate ?? '2025-06-01',
    endDate: overrides.endDate ?? '2026-05-31',
    isCurrent: overrides.isCurrent ?? false,
  });
};
