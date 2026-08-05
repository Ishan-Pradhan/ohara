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
} from 'sequelize-typescript';

import { TUTOR_MESSAGE_ROLES, TUTOR_MESSAGE_TYPES } from '../constants/index.js';
import type {
  TutorMessageRole,
  TutorMessageType,
  TutorSource,
} from '../types/tutor.types.js';
import { TutorConversation } from './tutorConversations.model.js';

@Table({ tableName: 'TutorMessages', timestamps: true })
export class TutorMessage extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => TutorConversation)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare conversationId: string;

  @BelongsTo(() => TutorConversation)
  declare conversation?: TutorConversation;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare seq: number;

  @AllowNull(false)
  @Column(
    DataType.ENUM(
      TUTOR_MESSAGE_ROLES.USER,
      TUTOR_MESSAGE_ROLES.ASSISTANT,
      TUTOR_MESSAGE_ROLES.TOOL,
    ),
  )
  declare role: TutorMessageRole;

  @AllowNull(false)
  @Column(
    DataType.ENUM(
      TUTOR_MESSAGE_TYPES.TEXT,
      TUTOR_MESSAGE_TYPES.TOOL_CALL,
      TUTOR_MESSAGE_TYPES.TOOL_RESULT,
      TUTOR_MESSAGE_TYPES.CHART,
    ),
  )
  declare type: TutorMessageType;

  @Default(null)
  @Column(DataType.TEXT)
  declare content: string | null;

  @Default(null)
  @Column(DataType.JSONB)
  declare toolCalls: unknown | null;

  @Default(null)
  @Column(DataType.JSONB)
  declare toolResult: unknown | null;

  @Default(null)
  @Column(DataType.JSONB)
  declare sources: TutorSource[] | null;

  @Default(null)
  @Column(DataType.JSONB)
  declare chart: unknown | null;
}
