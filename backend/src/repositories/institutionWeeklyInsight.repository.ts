import { InstitutionWeeklyInsight } from '../models/institutionWeeklyInsight.model.js';
import type { NarrativeInsights } from '../types/aiInsights.types.js';

export const institutionWeeklyInsightRepository = {
  /** Single-tenant: at most one row ever exists — always the earliest-created. */
  find: async (): Promise<InstitutionWeeklyInsight | null> =>
    InstitutionWeeklyInsight.findOne({ order: [['createdAt', 'ASC']] }),

  upsert: async (weekStart: string, content: NarrativeInsights): Promise<InstitutionWeeklyInsight> => {
    const existing = await InstitutionWeeklyInsight.findOne({ order: [['createdAt', 'ASC']] });
    if (existing) {
      existing.weekStart = weekStart;
      existing.content = content;
      existing.generatedAt = new Date();
      return existing.save();
    }
    return InstitutionWeeklyInsight.create({ weekStart, content, generatedAt: new Date() });
  },
};
