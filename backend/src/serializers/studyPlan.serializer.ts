import type { StudyPlan } from '../models/studyPlan.model.js';

export const serializeStudyPlan = (plan: StudyPlan) => ({
  id: plan.id,
  studentId: plan.studentId,
  weekStart: plan.weekStart,
  content: plan.content,
  status: plan.status,
  isStale: plan.isStale,
  staleReason: plan.staleReason,
  generatedAt: plan.generatedAt.toISOString(),
  createdAt: (plan as unknown as { createdAt: Date }).createdAt.toISOString(),
});

export type StudyPlanDTO = ReturnType<typeof serializeStudyPlan>;
