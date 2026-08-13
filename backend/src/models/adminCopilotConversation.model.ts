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

/** Institution-scoped counterpart to TeacherCopilotConversation — same
 * persisted-thread shape, but tied to the admin instead of a course, since
 * an admin's questions span the whole institution rather than one class. */
export type AdminCopilotConversationStatus = 'active' | 'closed';

@Table({ tableName: 'admin_copilot_conversations', timestamps: true })
export class AdminCopilotConversation extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare adminId: string;

  @BelongsTo(() => User)
  declare admin?: User;

  @AllowNull(false)
  @Default('New conversation')
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Default('active')
  @Column(DataType.ENUM('active', 'closed'))
  declare status: AdminCopilotConversationStatus;

  @HasMany(() => AdminCopilotMessage)
  declare messages?: AdminCopilotMessage[];
}

export type AdminCopilotMessageRole = 'user' | 'assistant';

@Table({ tableName: 'admin_copilot_messages', timestamps: true })
export class AdminCopilotMessage extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => AdminCopilotConversation)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare conversationId: string;

  @BelongsTo(() => AdminCopilotConversation)
  declare conversation?: AdminCopilotConversation;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare seq: number;

  @AllowNull(false)
  @Column(DataType.ENUM('user', 'assistant'))
  declare role: AdminCopilotMessageRole;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare dataContext: Record<string, unknown> | null;
}
