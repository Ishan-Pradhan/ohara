export interface WeeklySummaryContext {
  courseName: string;
  weekStart: string;
  weekEnd: string;
  enrollmentCount: number;
  attendance: {
    sessions: number;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number | null;
  };
  submissions: {
    total: number;
    submitted: number;
    late: number;
    onTime: number;
    notSubmitted: number;
  };
  quizzes: {
    total: number;
    attempted: number;
    averageScore: number | null;
  };
  atRiskStudents: Array<{ name: string; average: number | null; attendance: number | null; missingSubmissions: number }>;
  classAverage: number | null;
}

export const weeklySummarySystemPrompt = (): string =>
  `You are an academic intelligence assistant providing a weekly class summary for a teacher.

Analyze the provided weekly data and produce a JSON object with this exact shape:
{
  "highlights": ["string — 2-4 key positive developments or achievements this week"],
  "concerns": ["string — 2-4 areas needing attention or declining trends"],
  "recommendations": ["string — 2-3 specific actionable steps the teacher should take next week"],
  "summary": "string — a 2-3 sentence overall narrative of the week"
}

Rules:
- Base all observations strictly on the provided data — do not invent facts.
- Highlight specific student names or patterns when relevant.
- Recommendations must be concrete and actionable (e.g., "Schedule a tutoring session with X" not "Help struggling students").
- If at-risk students are listed, prioritize recommendations about them.
- If attendance is declining, mention it specifically.
- If submission rates are low, address that pattern.
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const weeklySummaryUserPrompt = (ctx: WeeklySummaryContext): string =>
  `Weekly class data for ${ctx.courseName} (${ctx.weekStart} to ${ctx.weekEnd}):

Enrollment: ${ctx.enrollmentCount} students

Attendance:
- Sessions this week: ${ctx.attendance.sessions}
- Present: ${ctx.attendance.present}, Absent: ${ctx.attendance.absent}, Late: ${ctx.attendance.late}
- Attendance rate: ${ctx.attendance.attendanceRate !== null ? `${ctx.attendance.attendanceRate.toFixed(1)}%` : 'N/A'}

Submissions:
- Total required: ${ctx.submissions.total}
- Submitted: ${ctx.submissions.submitted} (${ctx.submissions.total > 0 ? ((ctx.submissions.submitted / ctx.submissions.total) * 100).toFixed(0) : 0}%)
- On time: ${ctx.submissions.onTime}, Late: ${ctx.submissions.late}
- Not submitted: ${ctx.submissions.notSubmitted}

Quizzes:
- Quizzes available: ${ctx.quizzes.total}
- Attempts: ${ctx.quizzes.attempted}
- Average score: ${ctx.quizzes.averageScore !== null ? `${ctx.quizzes.averageScore.toFixed(1)}%` : 'N/A'}

Class average: ${ctx.classAverage !== null ? `${ctx.classAverage.toFixed(1)}%` : 'N/A'}

At-risk students:
${ctx.atRiskStudents.length > 0 ? ctx.atRiskStudents.map((s) => `- ${s.name}: avg ${s.average !== null ? `${s.average.toFixed(0)}%` : 'N/A'}, attendance ${s.attendance !== null ? `${s.attendance.toFixed(0)}%` : 'N/A'}, missing ${s.missingSubmissions} submissions`).join('\n') : 'None flagged'}`;
