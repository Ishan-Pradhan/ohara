export type GradebookAssessmentType = 'assignment' | 'quiz';

export type GradebookEntryStatus =
  | 'graded'
  | 'pending'
  | 'ungraded'
  | 'not_submitted'
  | 'not_attempted';

export interface GradebookAssessment {
  id: string;
  type: GradebookAssessmentType;
  title: string;
  maxScore: number;
}

export interface GradebookEntry {
  assessmentId: string;
  type: GradebookAssessmentType;
  score: number | null;
  maxScore: number;
  status: GradebookEntryStatus;
}

export interface GradebookRow {
  studentId: string;
  studentName: string;
  entries: GradebookEntry[];
  totalScore: number;
  totalMaxScore: number;
  average: number | null;
}

export interface Gradebook {
  assessments: GradebookAssessment[];
  rows: GradebookRow[];
}
