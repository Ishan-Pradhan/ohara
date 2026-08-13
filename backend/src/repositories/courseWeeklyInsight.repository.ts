import { CourseWeeklyInsight } from '../models/courseWeeklyInsight.model.js';
import type { NarrativeInsights } from '../types/aiInsights.types.js';

export const courseWeeklyInsightRepository = {
  findByCourse: async (courseId: string): Promise<CourseWeeklyInsight | null> =>
    CourseWeeklyInsight.findOne({ where: { courseId } }),

  /** One row per course — replaces whatever was cached before. */
  upsert: async (
    courseId: string,
    weekStart: string,
    content: NarrativeInsights,
  ): Promise<CourseWeeklyInsight> => {
    const existing = await CourseWeeklyInsight.findOne({ where: { courseId } });
    if (existing) {
      existing.weekStart = weekStart;
      existing.content = content;
      existing.generatedAt = new Date();
      return existing.save();
    }
    return CourseWeeklyInsight.create({ courseId, weekStart, content, generatedAt: new Date() });
  },
};
