import type { Response, Request } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { institutionProfileRepository } from '../repositories/institutionProfile.repository.js';
import { serializeInstitutionProfile } from '../serializers/institutionProfile.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';

export const getInstitutionProfile = asyncHandler(
  async (_req: Request, res: Response) => {
    const profile = await institutionProfileRepository.get();
    return ok(
      res,
      profile ? serializeInstitutionProfile(profile) : null,
      profile ? 'Institution profile retrieved' : 'Institution profile not configured yet',
    );
  },
);

export const updateInstitutionProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { name, tagline, address, contactEmail, allowedEmailDomain, selfRegistrationEnabled } =
      req.validated?.body as {
        name: string;
        tagline?: string;
        address?: string;
        contactEmail?: string;
        allowedEmailDomain?: string;
        selfRegistrationEnabled?: boolean;
      };

    const profile = await institutionProfileRepository.upsert({
      name,
      tagline: tagline ?? null,
      address: address ?? null,
      contactEmail: contactEmail ? contactEmail : null,
      allowedEmailDomain: allowedEmailDomain
        ? allowedEmailDomain.trim().toLowerCase()
        : null,
      selfRegistrationEnabled: selfRegistrationEnabled ?? true,
    });

    return ok(res, serializeInstitutionProfile(profile), 'Institution profile saved');
  },
);
