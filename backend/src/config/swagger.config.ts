import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import { registry } from '../validations/registry.js';

// Importing these modules for their side effects is what populates the
// registry. A new schema module must be added here or its paths never appear.
import '../validations/user.response.js';
import '../validations/auth.validation.js';
import '../validations/admin.validation.js';

registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'accessToken',
  description:
    'HTTP-only cookie set on login and register. Send credentials with every request.',
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const swaggerSpec = generator.generateDocument({
  openapi: '3.0.3',
  info: {
    title: 'Ohara API',
    version: '1.0.0',
    description:
      'REST API for Ohara — authentication, user administration, and (from Phase 2) academic management.',
  },
  servers: [{ url: '/api/v1', description: 'Current server' }],
  security: [{ cookieAuth: [] }],
  tags: [
    { name: 'Health', description: 'Server status' },
    { name: 'Auth', description: 'Register, login, logout, token management' },
    {
      name: 'Email Verification',
      description: 'Verify and resend confirmations',
    },
    { name: 'Password', description: 'Forgot, reset and change password' },
    { name: 'OAuth', description: 'Google and GitHub OAuth 2.0 flows' },
    { name: 'Admin', description: 'User management (admin only)' },
  ],
});
