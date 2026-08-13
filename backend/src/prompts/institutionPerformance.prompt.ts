export interface InstitutionPerformanceContext {
  institutionName: string;
  totals: {
    programs: number;
    classes: number;
    courses: number;
    students: number;
    teachers: number;
    activeEnrollments: number;
  };
  academic: {
    overallAverageGrade: number | null;
    overallAttendanceRate: number | null;
    totalAtRisk: number;
    atRiskRate: number | null;
    totalSubmissions: number;
    totalMissingSubmissions: number;
  };
  programs: Array<{
    name: string;
    courseCount: number;
    studentCount: number;
    averageGrade: number | null;
    attendanceRate: number | null;
    atRiskCount: number;
  }>;
  topCourses: Array<{
    courseId: string;
    name: string;
    averageGrade: number | null;
    enrollmentCount: number;
  }>;
  bottomCourses: Array<{
    courseId: string;
    name: string;
    averageGrade: number | null;
    enrollmentCount: number;
  }>;
}

export const institutionPerformanceSystemPrompt = (): string =>
  `You are an academic intelligence assistant providing an institution-wide performance overview for an administrator.

Analyze the provided data and produce a JSON object with this exact shape:
{
  "highlights": ["string — 2-4 key positive developments across the institution"],
  "concerns": ["string — 2-4 areas needing attention or declining patterns"],
  "recommendations": ["string — 3-4 specific actionable steps prioritized by impact"],
  "summary": "string — a 3-4 sentence overall narrative of the institution's academic health"
}

Rules:
- Base all observations strictly on the provided data — do not invent facts.
- Identify patterns across programs and courses (e.g. "Science programs outperform Humanities").
- If at-risk rates are high, prioritize that in concerns and recommendations.
- If attendance is low across multiple programs, flag it as a systemic issue.
- Recommendations must be concrete and actionable (e.g. "Schedule intervention reviews for the 15 at-risk students in Grade 11").
- Respond with ONLY the JSON object. No prose, no markdown code fences, no commentary.`;

export const institutionPerformanceUserPrompt = (ctx: InstitutionPerformanceContext): string =>
  `Institution: ${ctx.institutionName}

Totals:
- Programs: ${ctx.totals.programs}
- Classes: ${ctx.totals.classes}
- Courses: ${ctx.totals.courses}
- Students: ${ctx.totals.students}
- Teachers: ${ctx.totals.teachers}
- Active enrollments: ${ctx.totals.activeEnrollments}

Academic Overview:
- Overall average grade: ${ctx.academic.overallAverageGrade !== null ? `${ctx.academic.overallAverageGrade.toFixed(1)}%` : 'N/A'}
- Overall attendance rate: ${ctx.academic.overallAttendanceRate !== null ? `${ctx.academic.overallAttendanceRate.toFixed(1)}%` : 'N/A'}
- At-risk students: ${ctx.academic.totalAtRisk} (${ctx.academic.atRiskRate !== null ? `${ctx.academic.atRiskRate.toFixed(1)}%` : 'N/A'} of enrolled)
- Total submissions: ${ctx.academic.totalSubmissions}
- Missing submissions: ${ctx.academic.totalMissingSubmissions}

Program Breakdown:
${ctx.programs.map((p) => `- ${p.name}: ${p.courseCount} courses, ${p.studentCount} students, avg ${p.averageGrade !== null ? `${p.averageGrade.toFixed(1)}%` : 'N/A'}, attendance ${p.attendanceRate !== null ? `${p.attendanceRate.toFixed(1)}%` : 'N/A'}, ${p.atRiskCount} at-risk`).join('\n')}

Top Performing Courses:
${ctx.topCourses.map((c) => `- ${c.name}: avg ${c.averageGrade !== null ? `${c.averageGrade.toFixed(1)}%` : 'N/A'}, ${c.enrollmentCount} students`).join('\n')}

Courses Needing Attention:
${ctx.bottomCourses.map((c) => `- ${c.name}: avg ${c.averageGrade !== null ? `${c.averageGrade.toFixed(1)}%` : 'N/A'}, ${c.enrollmentCount} students`).join('\n')}`;
