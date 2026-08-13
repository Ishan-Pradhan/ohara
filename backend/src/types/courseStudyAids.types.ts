import type { Optional } from 'sequelize';

export const STUDY_AID_TYPES = {
  SUMMARY: 'summary',
  FLASHCARDS: 'flashcards',
} as const;

export type StudyAidType = (typeof STUDY_AID_TYPES)[keyof typeof STUDY_AID_TYPES];

export interface SummaryContent {
  summary: string;
  keyPoints: string[];
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardsContent {
  cards: Flashcard[];
}

export type StudyAidContent = SummaryContent | FlashcardsContent;

export interface CourseStudyAidAttributes {
  id: string;
  courseId: string;
  lessonId: string | null;
  type: StudyAidType;
  content: StudyAidContent;
  generatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CourseStudyAidCreationAttributes = Optional<
  CourseStudyAidAttributes,
  'id' | 'lessonId' | 'createdAt' | 'updatedAt'
>;
