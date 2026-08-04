import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const domainPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

export const updateInstitutionProfileSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    tagline: z.string().optional(),
    address: z.string().optional(),
    contactEmail: z.email('Invalid email').optional().or(z.literal('')),
    allowedEmailDomain: z
      .string()
      .regex(domainPattern, 'Enter a bare domain, e.g. nccs.edu.np')
      .optional()
      .or(z.literal('')),
    selfRegistrationEnabled: z.boolean().optional(),
  }),
};

export const institutionProfileSchema = registry.register(
  'InstitutionProfile',
  z.object({
    id: z.uuid(),
    name: z.string(),
    tagline: z.string().nullable(),
    address: z.string().nullable(),
    contactEmail: z.string().nullable(),
    allowedEmailDomain: z.string().nullable(),
    selfRegistrationEnabled: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/institution-profile',
  tags: ['Institution'],
  security: [],
  responses: {
    200: {
      description: 'The institution profile, or null if not yet configured',
      content: {
        'application/json': { schema: envelope(institutionProfileSchema.nullable()) },
      },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/institution-profile',
  tags: ['Institution'],
  request: {
    body: {
      content: { 'application/json': { schema: updateInstitutionProfileSchema.body } },
    },
  },
  responses: {
    200: {
      description: 'Institution profile created or updated',
      content: { 'application/json': { schema: envelope(institutionProfileSchema) } },
    },
    400: { description: 'Validation failed' },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not an admin' },
  },
});
