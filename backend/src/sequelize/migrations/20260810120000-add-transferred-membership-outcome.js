'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Adds the outcome recorded on the superseded membership when a student is
    // reassigned across program/class/term/batch — the reassign action closes
    // out the old placement with 'transferred' instead of 'promoted'/'retained',
    // so the promotion chain still carries readable history.
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_ClassMemberships_outcome" ADD VALUE IF NOT EXISTS 'transferred';`,
    );
  },

  async down() {
    // Postgres cannot remove a value from an enum without recreating the type,
    // which would cascade through every column using it — there is no safe
    // in-place down for this migration.
  },
};