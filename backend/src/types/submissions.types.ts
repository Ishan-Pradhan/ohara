import type { Optional } from 'sequelize';

export interface SubmissionAttributes {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string | null;
  fileUrl: string | null;
  filePublicId: string | null;
  fileOriginalName: string | null;
  fileMimeType: string | null;
  isLate: boolean;
  submittedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SubmissionCreationAttributes = Optional<
  SubmissionAttributes,
  'id' | 'content' | 'fileUrl' | 'filePublicId' | 'fileOriginalName' | 'fileMimeType' | 'isLate' | 'createdAt' | 'updatedAt'
>;
