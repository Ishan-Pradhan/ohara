import type { Optional } from 'sequelize';
import type {
  TUTOR_CONVERSATION_STATUSES,
  TUTOR_MESSAGE_ROLES,
  TUTOR_MESSAGE_TYPES,
} from '../constants/index.js';

export type TutorConversationStatus =
  (typeof TUTOR_CONVERSATION_STATUSES)[keyof typeof TUTOR_CONVERSATION_STATUSES];
export type TutorMessageRole = (typeof TUTOR_MESSAGE_ROLES)[keyof typeof TUTOR_MESSAGE_ROLES];
export type TutorMessageType = (typeof TUTOR_MESSAGE_TYPES)[keyof typeof TUTOR_MESSAGE_TYPES];

export interface TutorSource {
  documentId: string;
  filename: string;
  chunkContent: string;
}

export interface TutorConversationAttributes {
  id: string;
  courseId: string;
  studentId: string;
  title: string;
  status: TutorConversationStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TutorConversationCreationAttributes = Optional<
  TutorConversationAttributes,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;

export interface TutorMessageAttributes {
  id: string;
  conversationId: string;
  seq: number;
  role: TutorMessageRole;
  type: TutorMessageType;
  content: string | null;
  toolCalls: unknown | null;
  toolResult: unknown | null;
  sources: TutorSource[] | null;
  chart: unknown | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TutorMessageCreationAttributes = Optional<
  TutorMessageAttributes,
  'id' | 'toolCalls' | 'toolResult' | 'sources' | 'chart' | 'createdAt' | 'updatedAt'
>;
