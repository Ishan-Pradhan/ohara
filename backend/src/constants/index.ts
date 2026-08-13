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

// Nepali affiliated-university programs promote unconditionally — a failed
// final exam is a re-exam concern (out of scope here), not a repeated
// semester — so there is no 'retained' outcome. 'transferred' is the
// mis-placement correction tool (see classMembershipRepository.reassign),
// not a normal lifecycle event; it doesn't move a student's permanent batch
// except as an explicit admin correction.
export const CLASS_MEMBERSHIP_OUTCOMES = {
  ENROLLED: 'enrolled',
  PROMOTED: 'promoted',
  GRADUATED: 'graduated',
  TRANSFERRED: 'transferred',
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
// meant resending the full source text on every call). A module can have a
// few lessons at 400+ words each plus code blocks, so this budget is larger
// than a single lesson would need.
export const MODULE_CONTENT_MAX_COMPLETION_TOKENS = 8192;

// Module-content generation retrieves RAG chunks (documentChunkRepository,
// same as the tutor/quiz/lesson-planner) instead of resending the whole
// document — the source of the Groq 413 "request too large" errors this
// replaced. Sized to leave headroom under Groq's on_demand tier's 12,000
// TPM hard cap alongside MODULE_CONTENT_MAX_COMPLETION_TOKENS: 10 chunks at
// ~1000 chars (CHUNK_SIZE_CHARS) is roughly 2,500 tokens, well under the
// ~3,800 tokens left after the completion budget, with headroom for the
// system prompt and lesson list.
export const MODULE_CONTENT_RETRIEVAL_K = 10;

// Defensive fallback only — used when RAG retrieval finds nothing for a
// module's query (shouldn't happen for a status: 'ready' document, since
// ingestion chunks it before marking it ready). Deliberately small: this is
// a slice of the raw source text, not chunk-selected, so it must stay well
// under the same TPM budget on its own.
export const MODULE_CONTENT_SOURCE_FALLBACK_CHARS = 3000;

// Study aids (summary/flashcards/explain) send a lesson's or a whole
// course's already-curated content verbatim rather than RAG-retrieving it —
// unlike module-content generation above, there's no per-chunk selection to
// bound it, so the raw text needs its own hard ceiling. Sized against the
// same Groq on_demand tier's 12,000 TPM cap: system+user prompt overhead is
// small (~250 tokens, see studyAids.prompt.ts), and the larger of the two
// completion budgets below (flashcards, 2048) leaves roughly 9,700 tokens of
// input room; 20,000 chars is ~5,000 tokens, well under that with headroom
// to spare — the same "well under, with room for prompt overhead" reasoning
// as MODULE_CONTENT_RETRIEVAL_K above. A course with more material than this
// just gets summarized/carded from its first ~20,000 characters, same
// trade-off MODULE_CONTENT_SOURCE_FALLBACK_CHARS already makes.
export const STUDY_AID_SOURCE_MAX_CHARS = 20_000;
export const STUDY_AID_SUMMARY_MAX_COMPLETION_TOKENS = 1024;
export const STUDY_AID_FLASHCARDS_MAX_COMPLETION_TOKENS = 2048;

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

// pgvector cosine distance (`<=>`) cutoff above which a retrieved chunk is
// treated as "not actually relevant" rather than "the closest thing we
// found." Without this, findSimilar's ORDER BY ... LIMIT k always returns k
// chunks regardless of how unrelated the query is — ask a course's tutor an
// off-topic question and it still gets back "material," which the LLM (a
// known-unreliable refuser — see NO_MATERIAL_MESSAGE below) then sometimes
// answers from its own general knowledge while still citing those chunks as
// if they supported it. Calibrated empirically against a real ingested
// document (bge-small-en-v1.5 embeddings), probing both clusters, not just
// one query each way: clearly on-topic queries — including
// awkwardly-phrased-but-legitimate ones like "what is in chapter 1" or "what
// does W6 cover", where structural/navigational phrasing embeds worse than
// topic-based phrasing, and an earlier 0.45 cutoff wrongly rejected these —
// topped out at distance ~0.48; clearly off-topic queries (unrelated trivia,
// small talk) bottomed out at ~0.52. 0.50 sits in that gap. Applied only to
// the tutor's own retrieval (searchCourseMaterial tool + stage1Fallback),
// not to quiz/lesson-planner/course-structure's retrieveKnowledgeBaseMaterial,
// which retrieve for topics the teacher explicitly named and where a hard
// cutoff risks rejecting a genuine but lexically-distant match instead of
// just refusing an off-topic question.
export const TUTOR_RELEVANCE_MAX_DISTANCE = 0.5;

// Higher than TUTOR_RETRIEVAL_K: a single chat answer needs a few precise
// excerpts, but a topic-based quiz (quizzes.controller.ts) can ask for up to
// 20 questions and needs broader material coverage to avoid repeating the
// same fact across questions.
export const QUIZ_RETRIEVAL_K = 10;

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