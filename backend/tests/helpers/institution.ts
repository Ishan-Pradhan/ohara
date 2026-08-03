import { programRepository } from '../../src/repositories/programs.repository.js';
import { classRepository } from '../../src/repositories/classes.repository.js';
import type { Program } from '../../src/models/programs.model.js';
import type { Class } from '../../src/models/classes.model.js';
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
