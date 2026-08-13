import { InstitutionPerformanceInsight } from '../models/institutionPerformanceInsight.model.js';
import type { NarrativeInsights } from '../types/aiInsights.types.js';

export const institutionPerformanceInsightRepository = {
  /** Single-tenant: at most one row ever exists — always the earliest-created. */
  find: async (): Promise<InstitutionPerformanceInsight | null> =>
    InstitutionPerformanceInsight.findOne({ order: [['createdAt', 'ASC']] }),

  upsert: async (content: NarrativeInsights): Promise<InstitutionPerformanceInsight> => {
    const existing = await InstitutionPerformanceInsight.findOne({ order: [['createdAt', 'ASC']] });
    if (existing) {
      existing.content = content;
      existing.generatedAt = new Date();
      return existing.save();
    }
    return InstitutionPerformanceInsight.create({ content, generatedAt: new Date() });
  },
};
