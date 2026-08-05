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

import { TUTOR_CONVERSATION_STATUSES } from '../constants/index.js';
import type { TutorConversationStatus } from '../types/tutor.types.js';
import { Course } from './courses.model.js';
import { User } from './users.model.js';
import { TutorMessage } from './tutorMessages.model.js';

@Table({ tableName: 'TutorConversations', timestamps: true })
export class TutorConversation extends Model {
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
  declare studentId: string;

  @BelongsTo(() => User)
  declare student?: User;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Default(TUTOR_CONVERSATION_STATUSES.ACTIVE)
  @Column(
    DataType.ENUM(
      TUTOR_CONVERSATION_STATUSES.ACTIVE,
      TUTOR_CONVERSATION_STATUSES.AWAITING_STUDENT,
      TUTOR_CONVERSATION_STATUSES.CLOSED,
    ),
  )
  declare status: TutorConversationStatus;

  @HasMany(() => TutorMessage)
  declare messages?: TutorMessage[];
}
