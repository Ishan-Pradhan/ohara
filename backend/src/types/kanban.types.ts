import type { Optional } from 'sequelize';

export type ProjectType = 'course' | 'personal';

export interface ProjectAttributes {
  id: string;
  courseId: string | null;
  ownerId: string | null;
  type: ProjectType;
  name: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProjectCreationAttributes = Optional<
  ProjectAttributes,
  'id' | 'courseId' | 'ownerId' | 'type' | 'createdAt' | 'updatedAt'
>;

export interface ProjectMemberAttributes {
  id: string;
  projectId: string;
  studentId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProjectMemberCreationAttributes = Optional<
  ProjectMemberAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

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
