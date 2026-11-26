import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  PrimaryKey,
} from 'sequelize-typescript';

@Table({ tableName: 'Verifications', timestamps: true })
export class Verification extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  declare userId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare token: string;

  @AllowNull(false)
  @Column(DataType.ENUM('emailVerification', 'passwordReset'))
  declare type: 'emailVerification' | 'passwordReset';

  @AllowNull(false)
  @Column(DataType.DATE)
  declare expiresAt: Date;
}
