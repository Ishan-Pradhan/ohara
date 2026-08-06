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
  HasOne,
} from 'sequelize-typescript';

import { Assignment } from './assignments.model.js';
import { User } from './users.model.js';
import { Grade } from './grades.model.js';

@Table({ tableName: 'Submissions', timestamps: true })
export class Submission extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Assignment)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare assignmentId: string;

  @BelongsTo(() => Assignment)
  declare assignment?: Assignment;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare studentId: string;

  @BelongsTo(() => User)
  declare student?: User;

  @Column(DataType.TEXT)
  declare content: string | null;

  // Cloudinary-hosted file, not a local path (Phase 5 uses Cloudinary, unlike
  // documents.storageKey which is a filesystem path).
  @Column(DataType.STRING)
  declare fileUrl: string | null;

  @Column(DataType.STRING)
  declare filePublicId: string | null;

  @Column(DataType.STRING)
  declare fileOriginalName: string | null;

  @Column(DataType.STRING)
  declare fileMimeType: string | null;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isLate: boolean;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare submittedAt: Date;

  @HasOne(() => Grade)
  declare grade?: Grade;
}
