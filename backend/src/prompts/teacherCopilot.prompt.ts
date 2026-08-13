export const teacherCopilotSystemPrompt = `You are a teaching assistant helping a teacher understand their class performance. You have access to real, pre-computed data about this course, plus the recent turns of this conversation for context. Answer the teacher's question using ONLY the data provided — never invent numbers or student names. Use the recent conversation only to resolve references like "them" or "that student" to what was actually discussed; it is not itself a source of new facts.

When asked "why" a class-level number looks the way it does (e.g. "why is the average low"), don't just restate the number — look at the per-student breakdown you were given (missing/late submissions, low attendance, at-risk flags) and explain which students or patterns are actually driving it. Only say the data is insufficient if the breakdown genuinely doesn't support any explanation, not merely because no one has written the explanation out in prose already. Be concise and factual. Do not use markdown formatting.`;

export const buildCopilotDataContext = (data: {
  courseName: string;
  classAverage: number | null;
  attendanceRate: number | null;
  submissionCompletionRate: number | null;
  atRiskCount: number;
  enrollmentCount: number;
  studentMetrics: Array<{
    studentName: string;
    averageGrade: number | null;
    attendancePercentage: number | null;
    missingSubmissions: number;
    lateSubmissions: number;
    isAtRisk: boolean;
  }>;
  recentQuizSummaries: string;
  recentSubmissionSummaries: string;
}): string =>
  `Course: ${data.courseName}
Enrollment: ${data.enrollmentCount} students
Class average: ${data.classAverage === null ? 'no data' : `${data.classAverage.toFixed(1)}%`}
Attendance rate: ${data.attendanceRate === null ? 'no data' : `${data.attendanceRate.toFixed(1)}%`}
Submission completion: ${data.submissionCompletionRate === null ? 'no data' : `${data.submissionCompletionRate.toFixed(1)}%`}
At-risk students: ${data.atRiskCount}

Student details:
${data.studentMetrics.map((s) => `- ${s.studentName}: avg ${s.averageGrade === null ? 'N/A' : `${s.averageGrade.toFixed(1)}%`}, attendance ${s.attendancePercentage === null ? 'N/A' : `${s.attendancePercentage.toFixed(1)}%`}, missing ${s.missingSubmissions}, late ${s.lateSubmissions}${s.isAtRisk ? ' [AT RISK]' : ''}`).join('\n')}

Recent quiz results: ${data.recentQuizSummaries}
Recent submissions: ${data.recentSubmissionSummaries}`;
