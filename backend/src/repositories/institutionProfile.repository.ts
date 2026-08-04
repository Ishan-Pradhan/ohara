import type { Optional } from 'sequelize';
import { InstitutionProfile } from '../models/institutionProfile.model.js';

export interface InstitutionProfileAttributes {
  id: string;
  name: string;
  tagline: string | null;
  address: string | null;
  contactEmail: string | null;
  allowedEmailDomain: string | null;
  selfRegistrationEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InstitutionProfileUpdateAttributes = Optional<
  InstitutionProfileAttributes,
  | 'id'
  | 'tagline'
  | 'address'
  | 'contactEmail'
  | 'allowedEmailDomain'
  | 'selfRegistrationEnabled'
  | 'createdAt'
  | 'updatedAt'
>;

export const institutionProfileRepository = {
  /** Single-tenant: there is at most one row. Null means the admin hasn't
   * set one up yet — callers decide the "not configured" fallback. */
  get: async (): Promise<InstitutionProfile | null> => {
    return await InstitutionProfile.findOne({ order: [['createdAt', 'ASC']] });
  },

  /** Creates the singleton row on first save, updates it on every save after. */
  upsert: async (
    data: InstitutionProfileUpdateAttributes,
  ): Promise<InstitutionProfile> => {
    const existing = await InstitutionProfile.findOne({
      order: [['createdAt', 'ASC']],
    });
    if (!existing) {
      return await InstitutionProfile.create(data);
    }
    return await existing.update(data);
  },
};
