/**
 * Prompt for the AI study planner. Inputs are entirely deterministic:
 * the LLM receives structured academic data and returns a structured plan.
 *
 * Safety constraints:
 * - The model generates tasks and descriptions; it never assigns or modifies grades.
 * - All numeric values (scores, counts, dates) come from the backend, not the model.
 * - The response is Zod-validated before persistence.
 */

export const studyPlannerSystemPrompt = `You are an academic study planner. You receive a student's current academic data and generate a structured weekly study plan in JSON.

Rules:
- Output ONLY valid JSON. No explanation, no markdown.
- Base ALL tasks on the provided academic data — do not invent assessments or grades.
- Prioritise: (1) overdue/missing work, (2) upcoming assessments, (3) weak concepts.
- Be specific: reference actual course names, assignment titles, and concept areas from the input.
- Keep tasks realistic and achievable — a student can study 2–4 hours per day at most.
- Distribute work across the week so no single day is overwhelming.
- Each task must have a reasonable estimatedMinutes (15–120) and a priority (high/medium/low).
- Do not fabricate student data, grades, or percentages not present in the input.`;

interface UpcomingAssessment {
  type: 'assignment' | 'quiz';
  title: string;
  courseTitle: string;
  dueAt: string | null;
}

interface WeakConcept {
  topic: string;
  courseTitle: string;
  masteryState: string;
}

interface StudyPlanInput {
  studentName: string;
  weekStart: string;
  weekEnd: string;
  performance: {
    averageGrade: number | null;
    attendancePercentage: number | null;
    completionRate: number | null;
    missingSubmissions: number;
  };
  upcomingAssessments: UpcomingAssessment[];
  weakConcepts: WeakConcept[];
  courses: string[];
}

export const buildStudyPlannerUserPrompt = (input: StudyPlanInput): string => {
  const lines: string[] = [
    `Generate a weekly study plan for ${input.studentName} covering ${input.weekStart} to ${input.weekEnd}.`,
    '',
    'ACADEMIC CONTEXT:',
    `Enrolled courses: ${input.courses.join(', ') || 'none'}`,
    `Overall average grade: ${input.performance.averageGrade !== null ? `${input.performance.averageGrade.toFixed(1)}%` : 'no data yet'}`,
    `Attendance: ${input.performance.attendancePercentage !== null ? `${input.performance.attendancePercentage.toFixed(1)}%` : 'no data yet'}`,
    `Completion rate: ${input.performance.completionRate !== null ? `${input.performance.completionRate.toFixed(1)}%` : 'no data yet'}`,
    `Missing submissions: ${input.performance.missingSubmissions}`,
    '',
  ];

  if (input.upcomingAssessments.length > 0) {
    lines.push('UPCOMING ASSESSMENTS (prioritise these):');
    for (const a of input.upcomingAssessments) {
      lines.push(`  - [${a.type}] ${a.title} (${a.courseTitle})${a.dueAt ? ` — due ${new Date(a.dueAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}`);
    }
    lines.push('');
  }

  if (input.weakConcepts.length > 0) {
    lines.push('WEAK CONCEPTS (include targeted review tasks):');
    for (const c of input.weakConcepts) {
      lines.push(`  - "${c.topic}" in ${c.courseTitle} (mastery: ${c.masteryState})`);
    }
    lines.push('');
  }

  lines.push(`Return JSON matching this exact structure (all 7 days required, even if a day has no tasks):`);
  lines.push(`{
  "summary": "<one sentence describing the week's focus>",
  "weekStart": "${input.weekStart}",
  "days": [
    {
      "day": "Monday",
      "date": "YYYY-MM-DD",
      "tasks": [
        {
          "type": "assignment|quiz|review|practice|concept",
          "title": "<brief task title>",
          "courseId": "<optional — only if task is tied to a specific course from the list>",
          "courseTitle": "<optional — only if courseId is set>",
          "description": "<one or two sentences explaining what to do>",
          "estimatedMinutes": 45,
          "priority": "high|medium|low"
        }
      ]
    }
  ],
  "evidence": {
    "upcomingAssessments": ${input.upcomingAssessments.length},
    "weakConcepts": ${input.weakConcepts.length},
    "missingSubmissions": ${input.performance.missingSubmissions},
    "averageGrade": ${input.performance.averageGrade ?? 'null'}
  }
}`);

  return lines.join('\n');
};
