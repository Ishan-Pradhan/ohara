export interface StudyPlanTask {
  type: 'review' | 'practice' | 'assignment' | 'quiz' | 'concept';
  title: string;
  courseId?: string;
  courseTitle?: string;
  description: string;
  estimatedMinutes: number;
  priority: 'high' | 'medium' | 'low';
  done?: boolean;
}

export interface StudyPlanDay {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  date: string;
  tasks: StudyPlanTask[];
}

export interface StudyPlanContent {
  summary: string;
  weekStart: string;
  days: StudyPlanDay[];
  evidence: {
    upcomingAssessments: number;
    weakConcepts: number;
    missingSubmissions: number;
    averageGrade: number | null;
  };
}
