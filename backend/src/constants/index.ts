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

// Course structure generation is two phases (see courseStructure.prompt.ts):
// a cheap skeleton call (generateJson's default token budget is plenty —
// titles and key topics only), then one content call per MODULE (a
// module's handful of lessons, not the whole course in one call and not
// one call per lesson — the former rations depth too thin, the latter
// resends the full source text so often it burns through a Groq token
// quota fast). A module can have a few lessons at 400+ words each plus
// code blocks, so this budget is larger than a single lesson would need.
export const MODULE_CONTENT_MAX_COMPLETION_TOKENS = 8192;

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

// A new conversation's placeholder title before its first message retitles
// it — see tutor.controller.ts's sendMessage.
export const DEFAULT_CONVERSATION_TITLE = 'New conversation';
export const AUTO_TITLE_MAX_LENGTH = 60;

// Bounded-agent-loop guardrails (ARCHITECTURE.md §7) — hard caps, not tuning
// knobs to raise casually. If the agent legitimately needs more steps than
// this, the fallback (stage-1 grounded answer) is the correct behavior, not
// a higher cap.
export const AGENT_MAX_ITERATIONS = 5;
export const AGENT_TURN_TIMEOUT_MS = 30_000;

// Grade lifecycle (Phase 5, golden rule 6): AI only ever writes 'draft'; a
// teacher action is the only path to 'approved'.
export const GRADE_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
} as const;

// Submission file types AI grading can extract text from — see
// utils/fileExtraction.utils.ts. Broader types (xlsx, images) are accepted
// for upload but graded manually by the teacher.
export const SUBMISSION_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
] as const;

// Quiz lifecycle (FR-22/23): a quiz is only attemptable by students once a
// teacher explicitly publishes it — mirrors courses.isPublished.
export const QUIZ_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

// FR-24: only 'mcq' is auto-scored. 'short_answer' responses are stored but
// not scored — no grading workflow for them exists in this sub-project.
export const QUESTION_TYPES = {
  MCQ: 'mcq',
  SHORT_ANSWER: 'short_answer',
} as const;

// FR-41 at-risk thresholds. Code constants, not admin-configurable yet
// (FR-41 says "configurable" — deliberately deferred; wiring these through
// the Institution Settings UI is a follow-up, not done in this pass). A
// student is flagged if ANY threshold is crossed.
export const AT_RISK_MIN_AVERAGE_PERCENT = 50;
export const AT_RISK_MIN_ATTENDANCE_PERCENT = 75;
export const AT_RISK_MAX_MISSING_SUBMISSIONS = 2;