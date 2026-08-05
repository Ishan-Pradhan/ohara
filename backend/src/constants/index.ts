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

export const STUDENT_FLAG_STATUSES = {
  OPEN: 'open',
  RESOLVED: 'resolved',
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

export const TUTOR_CONVERSATION_STATUSES = {
  ACTIVE: 'active',
  AWAITING_STUDENT: 'awaiting_student',
  CLOSED: 'closed',
} as const;

export const TUTOR_MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
} as const;

export const TUTOR_MESSAGE_TYPES = {
  TEXT: 'text',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  CHART: 'chart',
} as const;

// How many chunks to retrieve per tutor question — a retrieval-quality
// tuning knob, not a deployment concern, same reasoning as CHUNK_SIZE_CHARS.
export const TUTOR_RETRIEVAL_K = 5;

// Bounded-agent-loop guardrails (ARCHITECTURE.md §7) — hard caps, not tuning
// knobs to raise casually. If the agent legitimately needs more steps than
// this, the fallback (stage-1 grounded answer) is the correct behavior, not
// a higher cap.
export const AGENT_MAX_ITERATIONS = 5;
export const AGENT_TURN_TIMEOUT_MS = 30_000;