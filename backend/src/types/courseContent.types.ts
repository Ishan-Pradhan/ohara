import type { Optional } from 'sequelize';

export interface ModuleAttributes {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ModuleCreationAttributes = Optional<
  ModuleAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface LessonAttributes {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  keyTopics: string[];
  orderIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LessonCreationAttributes = Optional<
  LessonAttributes,
  'id' | 'keyTopics' | 'createdAt' | 'updatedAt'
>;
