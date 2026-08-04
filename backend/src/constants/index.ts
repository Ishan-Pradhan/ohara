// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  ALUMNI: 'alumni',
} as const;

// Academic / access status. Drives soft-delete and graduation.
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  GRADUATED: 'graduated',
  ARCHIVED: 'archived',
} as const;

export const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;
export const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export const INSTITUTION_TYPES = {
  SCHOOL: 'school',
  COLLEGE: 'college',
  UNIVERSITY: 'university',
} as const;

export const COURSE_TYPES = {
  COMPULSORY: 'compulsory',
  ELECTIVE: 'elective',
} as const;

export const CLASS_MEMBERSHIP_OUTCOMES = {
  ENROLLED: 'enrolled',
  PROMOTED: 'promoted',
  RETAINED: 'retained',
  GRADUATED: 'graduated',
} as const;

export const ENROLLMENT_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
} as const;

export const DOCUMENT_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
} as const;

// Not env-configurable, unlike GROQ_MODEL (env.ts) — changing the embedding
// model changes its output dimension, which is baked into the
// document_chunks.embedding column type by a migration. Swapping models
// means a code change + a migration + re-embedding every existing chunk,
// not a runtime env flip, so this is a code constant on purpose.
export const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
export const EMBEDDING_DIMENSIONS = 384;

// Chunking is tuned to the embedding model above, not a deployment concern.
export const CHUNK_SIZE_CHARS = 1000;
export const CHUNK_OVERLAP_CHARS = 100;