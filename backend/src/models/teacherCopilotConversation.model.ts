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

import { User } from './users.model.js';
import { Course } from './courses.model.js';

export type CopilotConversationStatus = 'active' | 'closed';

@Table({ tableName: 'teacher_copilot_conversations', timestamps: true })
export class TeacherCopilotConversation extends Model {
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
  declare teacherId: string;

  @BelongsTo(() => User)
  declare teacher?: User;

  @AllowNull(false)
  @Default('New conversation')
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Default('active')
  @Column(DataType.ENUM('active', 'closed'))
  declare status: CopilotConversationStatus;

  @HasMany(() => TeacherCopilotMessage)
  declare messages?: TeacherCopilotMessage[];
}

export type CopilotMessageRole = 'user' | 'assistant';

@Table({ tableName: 'teacher_copilot_messages', timestamps: true })
export class TeacherCopilotMessage extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => TeacherCopilotConversation)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare conversationId: string;

  @BelongsTo(() => TeacherCopilotConversation)
  declare conversation?: TeacherCopilotConversation;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare seq: number;

  @AllowNull(false)
  @Column(DataType.ENUM('user', 'assistant'))
  declare role: CopilotMessageRole;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare dataContext: Record<string, unknown> | null;
}
