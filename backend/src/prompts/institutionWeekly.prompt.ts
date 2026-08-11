export interface InstitutionWeeklyContext {
  weekStart: string;
  weekEnd: string;
  totals: {
    activeCourses: number;
    totalStudents: number;
    totalAtRisk: number;
  };
  attendance: {
    sessionsThisWeek: number;
    present: number;
    absent: number;
    late: number;
    rate: number | null;
  };
  submissions: {
    dueThisWeek: number;
    submitted: number;
    late: number;
    missing: number;
  };
  quizzes: {
    availableThisWeek: number;
    attempts: number;
    averageScore: number | null;
  };
  programSummaries: Array<{
    name: string;
    averageGrade: number | null;
    attendanceRate: number | null;
    atRiskCount: number;
  }>;
}

export const institutionWeeklySystemPrompt = (): string =>
  `You are an academic intelligence assistant providing a weekly institution summary for an administrator.

Analyze the provided weekly data and produce a JSON object with this exact shape:
{
  "highlights": ["string — 2-4 key positive developments this week"],
  "concerns": ["string — 2-4 areas needing attention or declining trends"],
  "recommendations": ["string — 3-4 specific actionable steps prioritized by impact"],
  "summary": "string — a 3-4 sentence overall narrative of the week"
}

Rules:
- Base all observations strictly on the provided data.
- If attendance is low, identify which programs are affected.
- If submission rates are low, flag the pattern.
- If at-risk counts are high, prioritize recommendations.
- Recommendations must be concrete and actionable.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const institutionWeeklyUserPrompt = (ctx: InstitutionWeeklyContext): string =>
  `Weekly institution summary (${ctx.weekStart} to ${ctx.weekEnd}):

Totals: ${ctx.totals.activeCourses} active courses, ${ctx.totals.totalStudents} students, ${ctx.totals.totalAtRisk} at-risk

Attendance:
- Sessions this week: ${ctx.attendance.sessionsThisWeek}
- Present: ${ctx.attendance.present}, Absent: ${ctx.attendance.absent}, Late: ${ctx.attendance.late}
- Rate: ${ctx.attendance.rate !== null ? `${ctx.attendance.rate.toFixed(1)}%` : 'N/A'}

Submissions:
- Due this week: ${ctx.submissions.dueThisWeek}
- Submitted: ${ctx.submissions.submitted}, Late: ${ctx.submissions.late}, Missing: ${ctx.submissions.missing}

Quizzes:
- Available this week: ${ctx.quizzes.availableThisWeek}
- Attempts: ${ctx.quizzes.attempts}
- Average score: ${ctx.quizzes.averageScore !== null ? `${ctx.quizzes.averageScore.toFixed(1)}%` : 'N/A'}

Program Performance:
${ctx.programSummaries.map((p) => `- ${p.name}: avg ${p.averageGrade !== null ? `${p.averageGrade.toFixed(1)}%` : 'N/A'}, attendance ${p.attendanceRate !== null ? `${p.attendanceRate.toFixed(1)}%` : 'N/A'}, ${p.atRiskCount} at-risk`).join('\n')}`;
