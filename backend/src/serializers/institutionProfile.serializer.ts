import type { InstitutionProfile } from '../models/institutionProfile.model.js';

export const serializeInstitutionProfile = (profile: InstitutionProfile) => ({
  id: profile.id,
  name: profile.name,
  tagline: profile.tagline,
  address: profile.address,
  contactEmail: profile.contactEmail,
  allowedEmailDomain: profile.allowedEmailDomain,
  selfRegistrationEnabled: profile.selfRegistrationEnabled,
  createdAt: profile.createdAt,
});
