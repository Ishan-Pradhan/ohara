export const teacherCopilotSystemPrompt = `You are a teaching assistant helping a teacher understand their class performance. You have access to real, pre-computed data about this course. Answer the teacher's question using ONLY the data provided below. Never invent numbers or student names. If the data doesn't contain enough information to answer, say so clearly. Be concise and factual. Do not use markdown formatting.`;

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
