import { programRepository } from '../../src/repositories/programs.repository.js';
import type { Program } from '../../src/models/programs.model.js';
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
