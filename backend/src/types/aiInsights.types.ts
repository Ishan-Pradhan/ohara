/** Shared shape for the narrative AI insights blocks (summary + highlights +
 * concerns + recommendations) used by institution performance, institution
 * weekly, and course weekly intelligence. Matches teacherDashboard.types.ts's
 * DashboardInsights, which predates this file and stays separate to avoid an
 * unrelated rename. */
export interface NarrativeInsights {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}
