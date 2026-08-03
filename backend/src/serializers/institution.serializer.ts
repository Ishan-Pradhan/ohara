import type { Program } from '../models/programs.model.js';

export const serializeProgram = (p: Program) => ({
  id: p.id,
  name: p.name,
  institutionType: p.institutionType,
  description: p.description,
  createdAt: p.createdAt,
});
