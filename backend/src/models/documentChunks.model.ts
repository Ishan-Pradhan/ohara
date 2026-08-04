import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  AllowNull,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';

import { vectorType } from '../config/pgvector.js';
import { Document } from './documents.model.js';

@Table({ tableName: 'DocumentChunks', timestamps: false })
export class DocumentChunk extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Document)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare documentId: string;

  @BelongsTo(() => Document)
  declare document?: Document;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare chunkIndex: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(false)
  @Column(vectorType(384))
  declare embedding: number[];
}
