'use strict';

/**
 * Widens Users.role from ('user','admin') to the four roles in docs/SCHEMA.md,
 * and adds the status + deletedAt columns that drive soft-delete and graduation.
 *
 * PostgreSQL cannot remove a value from an existing enum type, so role is
 * rebuilt via a new type rather than altered in place.
 *
 * The table is "Users" (capital U), so Sequelize named the enum type
 * "enum_Users_role". Both identifiers must stay double-quoted or PostgreSQL
 * folds them to lowercase and the statements fail.
 *
 * NOTE ON ROLLBACK: down() collapses 'teacher' and 'alumni' rows to 'user',
 * because the original type has no equivalent value. This is lossy by nature.
 */
module.exports = {
  async up(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_Users_role_new" AS ENUM ('admin','teacher','student','alumni')`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ALTER COLUMN "role" DROP DEFAULT`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ALTER COLUMN "role" TYPE "enum_Users_role_new"
         USING (CASE "role"::text WHEN 'user' THEN 'student' ELSE "role"::text END)::"enum_Users_role_new"`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ALTER COLUMN "role" SET DEFAULT 'student'`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(`DROP TYPE "enum_Users_role"`, {
        transaction: t,
      });
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_Users_role_new" RENAME TO "enum_Users_role"`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_Users_status" AS ENUM ('active','inactive','graduated','archived')`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ADD COLUMN "status" "enum_Users_status" NOT NULL DEFAULT 'active'`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ADD COLUMN "deletedAt" TIMESTAMPTZ NULL`,
        { transaction: t },
      );

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" DROP COLUMN "deletedAt"`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" DROP COLUMN "status"`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(`DROP TYPE "enum_Users_status"`, {
        transaction: t,
      });

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_Users_role_old" AS ENUM ('user','admin')`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ALTER COLUMN "role" DROP DEFAULT`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ALTER COLUMN "role" TYPE "enum_Users_role_old"
         USING (CASE "role"::text WHEN 'admin' THEN 'admin' ELSE 'user' END)::"enum_Users_role_old"`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "Users" ALTER COLUMN "role" SET DEFAULT 'user'`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(`DROP TYPE "enum_Users_role"`, {
        transaction: t,
      });
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_Users_role_old" RENAME TO "enum_Users_role"`,
        { transaction: t },
      );

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
};
