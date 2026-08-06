import type { Optional } from 'sequelize';
import type { InstitutionType } from './institution.types.js';

export type EventType = 'event' | 'holiday' | 'exam';
export type EventAudience = 'global' | 'institution_type' | 'program' | 'class';

export interface EventAttributes {
  id: string;
  createdBy: string;
  title: string;
  description: string | null;
  type: EventType;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  audience: EventAudience;
  institutionType: InstitutionType | null;
  programId: string | null;
  classId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EventCreationAttributes = Optional<
  EventAttributes,
  | 'id'
  | 'description'
  | 'type'
  | 'endAt'
  | 'allDay'
  | 'institutionType'
  | 'programId'
  | 'classId'
  | 'createdAt'
  | 'updatedAt'
>;
