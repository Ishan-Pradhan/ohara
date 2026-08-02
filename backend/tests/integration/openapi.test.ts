import { describe, it, expect } from 'vitest';
import request from 'supertest';

import { app } from '../../src/app.js';

describe('GET /api/docs.json', () => {
  it('serves a valid OpenAPI document', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
  });

  it('documents login with both a request body and a response schema', async () => {
    const res = await request(app).get('/api/docs.json');
    const login = res.body.paths['/auth/login']?.post;

    expect(login).toBeDefined();
    expect(login.requestBody).toBeDefined();
    expect(login.responses['200']).toBeDefined();
    expect(login.responses['403']).toBeDefined();
  });

  it('advertises the four user roles', async () => {
    const res = await request(app).get('/api/docs.json');
    const roles = res.body.components.schemas.UserPublic.properties.role.enum;

    expect(roles).toEqual(['admin', 'teacher', 'student', 'alumni']);
  });

  it('advertises the four account statuses', async () => {
    const res = await request(app).get('/api/docs.json');
    const statuses =
      res.body.components.schemas.UserPublic.properties.status.enum;

    expect(statuses).toEqual([
      'active',
      'inactive',
      'graduated',
      'archived',
    ]);
  });

  it('never documents password or refreshToken as response fields', async () => {
    const res = await request(app).get('/api/docs.json');
    const props = res.body.components.schemas.UserPublic.properties;

    expect(props).not.toHaveProperty('password');
    expect(props).not.toHaveProperty('refreshToken');
  });

  it('marks the admin routes as requiring cookie auth', async () => {
    const res = await request(app).get('/api/docs.json');
    const adminUsers = res.body.paths['/admin/users']?.get;

    expect(adminUsers).toBeDefined();
    expect(adminUsers.responses['403']).toBeDefined();
  });

  it('leaves the public auth routes unauthenticated', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.body.paths['/auth/login'].post.security).toEqual([]);
    expect(res.body.paths['/auth/register'].post.security).toEqual([]);
  });
});
