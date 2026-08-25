import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';

import { DOCUMENT_STATUS } from '../constants/index.js';
import type { DocumentStatus } from '../types/documents.types.js';
import { Course } from './courses.model.js';
import { User } from './users.model.js';
import { DocumentChunk } from './documentChunks.model.js';

@Table({ tableName: 'Documents', timestamps: true })
export class Document extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare uploadedBy: string;

  @BelongsTo(() => User)
  declare uploader?: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare filename: string;

  // Filesystem path, populated only for documents uploaded before the
  // Cloudinary migration — new uploads use fileUrl/filePublicId below instead
  // and leave this null. Kept so those older rows stay readable.
  @Column(DataType.STRING)
  declare storageKey: string | null;

  @Column(DataType.STRING)
  declare fileUrl: string | null;

  @Column(DataType.STRING)
  declare filePublicId: string | null;

  @AllowNull(false)
  @Default(DOCUMENT_STATUS.PROCESSING)
  @Column(
    DataType.ENUM(
      DOCUMENT_STATUS.PROCESSING,
      DOCUMENT_STATUS.READY,
      DOCUMENT_STATUS.FAILED,
    ),
  )
  declare status: DocumentStatus;

  @Default(null)
  @Column(DataType.STRING)
  declare errorMessage: string | null;

  @HasMany(() => DocumentChunk)
  declare chunks?: DocumentChunk[];
}
