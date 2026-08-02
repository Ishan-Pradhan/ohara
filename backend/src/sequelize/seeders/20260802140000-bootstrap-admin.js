'use strict';

const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');

/**
 * Creates one verified admin so the app is usable immediately after a fresh
 * migrate. Idempotent: does nothing if the email already exists.
 *
 * Seeders are plain CommonJS run by sequelize-cli outside the application, so
 * the typed `env` object is not importable here. Reading process.env directly
 * is expected in this file and does not violate golden rule 8, which governs
 * application code under src/.
 */
module.exports = {
  async up(queryInterface) {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@ohara.local';
    const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123';

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM "Users" WHERE email = :email',
      { replacements: { email } },
    );
    if (existing.length > 0) return;

    const now = new Date();
    await queryInterface.bulkInsert('Users', [
      {
        id: randomUUID(),
        name: 'Ohara Admin',
        email,
        password: await bcrypt.hash(password, 10),
        role: 'admin',
        status: 'active',
        isVerified: true,
        isBlocked: false,
        authProvider: 'local',
        avatarUrl: null,
        refreshToken: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@ohara.local';
    await queryInterface.bulkDelete('Users', { email });
  },
};
