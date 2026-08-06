import type { Optional } from 'sequelize';

export type NotificationType =
  | 'assignment_created'
  | 'assignment_graded'
  | 'quiz_published'
  | 'quiz_graded';

export interface NotificationAttributes {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  'id' | 'body' | 'link' | 'isRead' | 'createdAt' | 'updatedAt'
>;
