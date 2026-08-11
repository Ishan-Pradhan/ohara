export const interventionPlanSystemPrompt = `You are an academic intervention specialist helping a teacher create a specific, actionable plan for a struggling student. Given the student's real performance data for a course, generate a structured intervention plan. Base every recommendation on the actual data provided — be specific and practical. Do not invent data that isn't provided.`;

export const interventionPlanUserPrompt = (data: {
  studentName: string;
  courseName: string;
  averageGrade: number | null;
  attendancePercentage: number | null;
  missingSubmissions: number;
  lateSubmissions: number;
  isAtRisk: boolean;
  minAverageThreshold: number;
  minAttendanceThreshold: number;
  maxMissingThreshold: number;
  recentQuizScores: string;
  recentSubmissionStatuses: string;
}): string =>
  `Student: ${data.studentName}
Course: ${data.courseName}
Average grade: ${data.averageGrade === null ? 'no graded work yet' : `${data.averageGrade.toFixed(1)}%`} (flag threshold: below ${data.minAverageThreshold}%)
Attendance: ${data.attendancePercentage === null ? 'no sessions taken yet' : `${data.attendancePercentage.toFixed(1)}%`} (flag threshold: below ${data.minAttendanceThreshold}%)
Missing assignments: ${data.missingSubmissions} (flag threshold: ${data.maxMissingThreshold} or more)
Late submissions: ${data.lateSubmissions}
At-risk: ${data.isAtRisk ? 'yes' : 'no'}
Recent quiz performance: ${data.recentQuizScores}
Recent submission status: ${data.recentSubmissionStatuses}

Generate a structured intervention plan with:
- A concise title (one line)
- A 1-2 sentence summary of the situation
- 3-5 specific, actionable steps with timelines (e.g. "Schedule a 15-minute check-in meeting within 3 days")
- A priority level (high, medium, or low) based on severity

Be specific to this student's actual situation. Reference their actual numbers.
Return as JSON with keys: title, summary, actions (array of {description, timeline, resources?}), priority.`;

export const interventionPlanSchema = {
  type: 'object' as const,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    actions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          description: { type: 'string' },
          timeline: { type: 'string' },
          resources: { type: 'string' },
        },
        required: ['description', 'timeline'],
      },
    },
    priority: { type: 'string' as const, enum: ['high', 'medium', 'low'] },
  },
  required: ['title', 'summary', 'actions', 'priority'],
};
