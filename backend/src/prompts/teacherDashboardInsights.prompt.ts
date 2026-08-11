export interface DashboardInsightsContext {
  totalCourses: number;
  totalStudents: number;
  totalAtRisk: number;
  courses: Array<{
    name: string;
    enrollmentCount: number;
    classAverage: number | null;
    attendanceRate: number | null;
    atRiskCount: number;
  }>;
}

export const teacherDashboardInsightsSystemPrompt = (): string =>
  `You are an academic intelligence assistant providing a teacher's dashboard overview.

Analyze the provided data across all the teacher's courses and produce a JSON object with this exact shape:
{
  "highlights": ["string — 2-3 key positive developments across courses"],
  "concerns": ["string — 2-3 areas needing attention across courses"],
  "recommendations": ["string — 2-3 specific actionable steps prioritized by impact"],
  "summary": "string — a 2-3 sentence overall narrative of the teacher's current academic situation"
}

Rules:
- Base all observations strictly on the provided data — do not invent facts.
- Prioritize courses with the most at-risk students or lowest performance.
- Recommendations must be concrete and actionable.
- If a course has significantly worse metrics than others, highlight it.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const teacherDashboardInsightsUserPrompt = (ctx: DashboardInsightsContext): string =>
  `Teacher's dashboard overview:

Total courses: ${ctx.totalCourses}
Total students across all courses: ${ctx.totalStudents}
Total at-risk students: ${ctx.totalAtRisk}

Course breakdown:
${ctx.courses.map((c) => `- ${c.name}: ${c.enrollmentCount} students, avg ${c.classAverage !== null ? `${c.classAverage.toFixed(1)}%` : 'N/A'}, attendance ${c.attendanceRate !== null ? `${c.attendanceRate.toFixed(1)}%` : 'N/A'}, ${c.atRiskCount} at-risk`).join('\n')}`;
