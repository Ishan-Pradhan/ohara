import type { Optional } from 'sequelize';

export type EventAudience = 'global' | 'program' | 'class' | 'section' | 'course';

export interface EventAttributes {
  id: string;
  createdBy: string;
  title: string;
  description: string | null;
  startAt: Date;
  audience: EventAudience;
  programId: string | null;
  classId: string | null;
  sectionId: string | null;
  courseId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EventCreationAttributes = Optional<
  EventAttributes,
  'id' | 'description' | 'programId' | 'classId' | 'sectionId' | 'courseId' | 'createdAt' | 'updatedAt'
>;
