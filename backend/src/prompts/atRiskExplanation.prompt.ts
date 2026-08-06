/** FR-42: a short natural-language explanation of why a student was
 * flagged at-risk, from already-computed metrics — the model explains, it
 * never decides the flag itself (that's deterministic threshold logic in
 * atRisk.controller.ts). */
export const atRiskExplanationSystemPrompt = `You are an assistant helping a teacher understand why a student was flagged as academically at-risk. Given the student's metrics for one course, write a short, factual, 1-2 sentence explanation of why they were flagged. Be specific about which numbers crossed the threshold. Do not suggest interventions or give advice — just explain the "why" in plain language. Do not use markdown formatting.`;

export const atRiskExplanationUserPrompt = (metrics: {
  studentName: string;
  courseName: string;
  averageGrade: number | null;
  attendancePercentage: number | null;
  missingSubmissions: number;
  lateSubmissions: number;
  minAverageThreshold: number;
  minAttendanceThreshold: number;
  maxMissingThreshold: number;
}): string =>
  `Student: ${metrics.studentName}
Course: ${metrics.courseName}
Average grade: ${metrics.averageGrade === null ? 'no graded work yet' : `${metrics.averageGrade.toFixed(1)}%`} (flag threshold: below ${metrics.minAverageThreshold}%)
Attendance: ${metrics.attendancePercentage === null ? 'no sessions taken yet' : `${metrics.attendancePercentage.toFixed(1)}%`} (flag threshold: below ${metrics.minAttendanceThreshold}%)
Missing assignments: ${metrics.missingSubmissions} (flag threshold: ${metrics.maxMissingThreshold} or more)
Late submissions: ${metrics.lateSubmissions}

Explain why this student was flagged at-risk.`;
