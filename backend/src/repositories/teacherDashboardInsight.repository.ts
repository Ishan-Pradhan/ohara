import { TeacherDashboardInsight } from '../models/teacherDashboardInsight.model.js';
import type { DashboardInsights } from '../types/teacherDashboard.types.js';

export const teacherDashboardInsightRepository = {
  findByTeacher: async (teacherId: string): Promise<TeacherDashboardInsight | null> =>
    TeacherDashboardInsight.findOne({ where: { teacherId } }),

  /** One row per teacher — replaces whatever was cached before. */
  upsert: async (teacherId: string, content: DashboardInsights): Promise<TeacherDashboardInsight> => {
    const existing = await TeacherDashboardInsight.findOne({ where: { teacherId } });
    if (existing) {
      existing.content = content;
      existing.generatedAt = new Date();
      return existing.save();
    }
    return TeacherDashboardInsight.create({ teacherId, content, generatedAt: new Date() });
  },
};
