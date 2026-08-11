import 'reflect-metadata';
import {
  Table, Column, Model, DataType, Default, AllowNull, PrimaryKey, ForeignKey, BelongsTo,
} from 'sequelize-typescript';
import { User } from './users.model.js';

@Table({ tableName: 'BirthdayWishes', timestamps: true })
export class BirthdayWish extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare recipientId: string;

  @BelongsTo(() => User, { foreignKey: 'recipientId', as: 'recipient' })
  declare recipient?: User;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare senderId: string;

  @BelongsTo(() => User, { foreignKey: 'senderId', as: 'sender' })
  declare sender?: User;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare message: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  declare sentAt: Date;
}
