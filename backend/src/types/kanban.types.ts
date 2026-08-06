import type { Optional } from 'sequelize';

export interface ProjectAttributes {
  id: string;
  courseId: string;
  name: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProjectCreationAttributes = Optional<ProjectAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export interface BoardColumnAttributes {
  id: string;
  projectId: string;
  name: string;
  orderIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BoardColumnCreationAttributes = Optional<
  BoardColumnAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface TaskAttributes {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  orderIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TaskCreationAttributes = Optional<
  TaskAttributes,
  'id' | 'description' | 'assigneeId' | 'createdAt' | 'updatedAt'
>;
