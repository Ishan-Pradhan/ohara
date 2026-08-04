import 'reflect-metadata';
import { Table, Column, Model, DataType, Default, AllowNull, PrimaryKey } from 'sequelize-typescript';

/** Single-tenant: exactly one row describes the institution running this
 * deployment (e.g. "NCCS College"). Never more than one — the repository
 * always reads/writes the earliest-created row. */
@Table({ tableName: 'InstitutionProfile', timestamps: true })
export class InstitutionProfile extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @Default(null)
  @Column(DataType.STRING)
  declare tagline: string | null;

  @Default(null)
  @Column(DataType.STRING)
  declare address: string | null;

  @Default(null)
  @Column(DataType.STRING)
  declare contactEmail: string | null;

  /** Lowercase, no leading "@" (e.g. "nccs.edu.np"). Null means student
   * self-registration is open to any email — see auth.controller.ts registerUser. */
  @Default(null)
  @Column(DataType.STRING)
  declare allowedEmailDomain: string | null;

  /** When false, POST /auth/register rejects every student signup outright —
   * students can only get in via an admin batch invite (admin.controller.ts
   * inviteUsers). Not enforced against the bootstrap admin. */
  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare selfRegistrationEnabled: boolean;
}
