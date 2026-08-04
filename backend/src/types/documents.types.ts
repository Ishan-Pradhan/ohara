import type { Optional } from 'sequelize';
import type { DOCUMENT_STATUS } from '../constants/index.js';

export type DocumentStatus = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export interface DocumentAttributes {
  id: string;
  courseId: string;
  uploadedBy: string;
  filename: string;
  storageKey: string;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DocumentCreationAttributes = Optional<
  DocumentAttributes,
  'id' | 'status' | 'errorMessage' | 'createdAt' | 'updatedAt'
>;

export interface DocumentChunkAttributes {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  createdAt?: Date;
}

export type DocumentChunkCreationAttributes = Optional<
  DocumentChunkAttributes,
  'id' | 'createdAt'
>;
