import { api } from '../../lib/axios.js';
import { lessonPlanSchema, type LessonPlan } from './lessonPlanner.schema.js';

export const generateLessonPlan = async (
  courseId: string,
  topic: string,
  durationMinutes: number,
): Promise<LessonPlan> => {
  const res = await api.post(`/courses/${courseId}/lesson-plan`, { topic, durationMinutes });
  return lessonPlanSchema.parse(res.data.data);
};
