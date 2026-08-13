'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Replaces (class, academic_year) as the thing that identifies a specific
  // offering of a semester with (class, batch) — a batch's own progression
  // through Sem 1..N is now the single source of truth for "which one is
  // current," instead of matching a class's derived odd/even/annual term
  // against whichever academic_year happens to be flagged is_current. See
  // docs/SCHEMA.md for the full rationale.
  //
  // Verified safe against real data before writing this:
  //   - zero ClassMemberships rows have ever used outcome: 'retained'
  //     (Nepali affiliated-university programs promote unconditionally;
  //     a failed final exam is a re-exam concern, not a repeated semester)
  //   - 3 sections have never had a single membership — dropped below
  //   - exactly one (class, batch, name) collision exists in real data (a
  //     single-student test placement under the wrong, too-early academic
  //     year alongside the real 18-student section created correctly
  //     later) — merged below rather than assumed away, since a second
  //     run against a different data snapshot could hit more than one
  //
  // The whole thing runs in one transaction: a first attempt at this
  // migration failed partway through (the collision above, undiscovered
  // until the new unique index rejected it) and left Sections half
  // migrated with no automatic way back — recovered by hand from a
  // pg_dump taken first. Never again without a transaction.
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // ── Sections: (class, academic_year) → (class, batch) ────────────────
      await queryInterface.addColumn(
        'Sections',
        'batchId',
        {
          type: Sequelize.UUID,
          allowNull: true, // tightened after backfill
          references: { model: 'Batches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      await queryInterface.addColumn(
        'Sections',
        'startDate',
        { type: Sequelize.DATEONLY, allowNull: true }, // tightened after backfill
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `UPDATE "Sections" s
         SET "batchId" = sub."batchId"
         FROM (
           SELECT DISTINCT ON ("sectionId") "sectionId", "batchId"
           FROM "ClassMemberships"
         ) sub
         WHERE s.id = sub."sectionId";`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `UPDATE "Sections" s
         SET "startDate" = ay."startDate"
         FROM "AcademicYears" ay
         WHERE s."academicYearId" = ay.id;`,
        { transaction: t },
      );

      // Sections nobody was ever placed in have no batch to backfill from —
      // artifacts of the old "auto-create an empty current-year section"
      // pattern. Confirmed zero AttendanceSessions or ClassMemberships
      // reference them before writing this.
      await queryInterface.sequelize.query(
        `DELETE FROM "Sections" s
         WHERE NOT EXISTS (SELECT 1 FROM "ClassMemberships" cm WHERE cm."sectionId" = s.id);`,
        { transaction: t },
      );

      // Merge any (class, batch, name) duplicates — keep the section with
      // the most memberships (ties: oldest first), repoint every
      // membership and attendance session from the rest onto it, then
      // drop the emptied duplicates. Must happen before the new unique
      // index below, or a real collision like this rejects the migration
      // entirely with no indication of where to look.
      await queryInterface.sequelize.query(
        `CREATE TEMP TABLE section_merge_map AS
         WITH ranked AS (
           SELECT s.id, s."classId", s."batchId", s.name,
             (SELECT COUNT(*) FROM "ClassMemberships" cm WHERE cm."sectionId" = s.id) AS member_count,
             ROW_NUMBER() OVER (
               PARTITION BY s."classId", s."batchId", s.name
               ORDER BY (SELECT COUNT(*) FROM "ClassMemberships" cm WHERE cm."sectionId" = s.id) DESC, s."createdAt" ASC
             ) AS rn
           FROM "Sections" s
         ),
         winners AS (
           SELECT "classId", "batchId", name, id AS winner_id FROM ranked WHERE rn = 1
         )
         SELECT r.id AS loser_id, w.winner_id
         FROM ranked r
         JOIN winners w ON w."classId" = r."classId" AND w."batchId" = r."batchId" AND w.name = r.name
         WHERE r.rn > 1;`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `UPDATE "ClassMemberships" cm SET "sectionId" = m.winner_id
         FROM section_merge_map m WHERE cm."sectionId" = m.loser_id;`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `UPDATE "AttendanceSessions" a SET "sectionId" = m.winner_id
         FROM section_merge_map m WHERE a."sectionId" = m.loser_id;`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `DELETE FROM "Sections" s
         WHERE EXISTS (SELECT 1 FROM section_merge_map m WHERE m.loser_id = s.id);`,
        { transaction: t },
      );

      await queryInterface.changeColumn(
        'Sections',
        'batchId',
        {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Batches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      await queryInterface.changeColumn(
        'Sections',
        'startDate',
        { type: Sequelize.DATEONLY, allowNull: false },
        { transaction: t },
      );

      await queryInterface.removeIndex('Sections', 'sections_class_year_name_unique', { transaction: t });
      await queryInterface.removeColumn('Sections', 'academicYearId', { transaction: t });
      await queryInterface.addIndex('Sections', ['classId', 'batchId', 'name'], {
        unique: true,
        name: 'sections_class_batch_name_unique',
        transaction: t,
      });

      // ── ClassMemberships: drop academic_year_id, denormalize class_id ────
      await queryInterface.addColumn(
        'ClassMemberships',
        'classId',
        {
          type: Sequelize.UUID,
          allowNull: true, // tightened after backfill
          references: { model: 'Classes', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `UPDATE "ClassMemberships" cm
         SET "classId" = s."classId"
         FROM "Sections" s
         WHERE cm."sectionId" = s.id;`,
        { transaction: t },
      );
      await queryInterface.changeColumn(
        'ClassMemberships',
        'classId',
        {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'Classes', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );

      await queryInterface.removeIndex('ClassMemberships', 'class_memberships_student_year_unique', { transaction: t });
      await queryInterface.removeColumn('ClassMemberships', 'academicYearId', { transaction: t });
      await queryInterface.addIndex('ClassMemberships', ['studentId', 'classId'], {
        unique: true,
        name: 'class_memberships_student_class_unique',
        transaction: t,
      });

      // outcome: drop 'retained' only — 'transferred' stays (it's the
      // outcome `classMembershipRepository.reassign` uses for its
      // mis-placement correction tool, unrelated to promotion; batch
      // permanence is a normal-lifecycle rule, not a ban on admin
      // corrections). Postgres can't remove an enum value in-place, so
      // swap the type. Safe: zero existing rows use 'retained'. The
      // default has to come off first — a DEFAULT expression is itself
      // typed, so Postgres refuses the column ALTER while one referencing
      // the old type is still attached.
      await queryInterface.sequelize.query(
        `ALTER TABLE "ClassMemberships" ALTER COLUMN "outcome" DROP DEFAULT;`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_ClassMemberships_outcome" RENAME TO "enum_ClassMemberships_outcome_old";`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_ClassMemberships_outcome" AS ENUM('enrolled', 'promoted', 'transferred', 'graduated');`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "ClassMemberships"
         ALTER COLUMN "outcome" TYPE "enum_ClassMemberships_outcome"
         USING ("outcome"::text::"enum_ClassMemberships_outcome");`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "ClassMemberships" ALTER COLUMN "outcome" SET DEFAULT 'enrolled';`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(`DROP TYPE "enum_ClassMemberships_outcome_old";`, { transaction: t });

      // ── Batches: no longer needs a starting academic year ────────────────
      await queryInterface.removeColumn('Batches', 'startAcademicYearId', { transaction: t });

      // ── Programs: institution type only ever meant school vs college vs
      // university term derivation (deriveClassTerm) — every program in
      // this deployment is already 'university', and that's the only type
      // going forward, so the column no longer carries information. ───────
      await queryInterface.removeColumn('Programs', 'institutionType', { transaction: t });
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_Programs_institutionType";`, { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  // Restores the pre-migration shape. Data that only this migration's
  // backfill could reconstruct (startAcademicYearId, institutionType, the
  // exact academicYearId a section/membership had) is NOT re-derived —
  // academic_years itself is untouched by this migration (dropped in a
  // later one), but the links back to it are gone. Treat this as a schema
  // rollback, not a full data-preserving reversal. (Sections merged by
  // this migration's up() also stay merged — the down doesn't re-split them.)
  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'Programs',
        'institutionType',
        { type: Sequelize.ENUM('school', 'college', 'university'), allowNull: true },
        { transaction: t },
      );

      await queryInterface.addColumn(
        'Batches',
        'startAcademicYearId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'AcademicYears', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "ClassMemberships" ALTER COLUMN "outcome" DROP DEFAULT;`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_ClassMemberships_outcome" RENAME TO "enum_ClassMemberships_outcome_new";`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_ClassMemberships_outcome" AS ENUM('enrolled', 'promoted', 'retained', 'transferred', 'graduated');`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "ClassMemberships"
         ALTER COLUMN "outcome" TYPE "enum_ClassMemberships_outcome"
         USING ("outcome"::text::"enum_ClassMemberships_outcome");`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "ClassMemberships" ALTER COLUMN "outcome" SET DEFAULT 'enrolled';`,
        { transaction: t },
      );
      await queryInterface.sequelize.query(`DROP TYPE "enum_ClassMemberships_outcome_new";`, { transaction: t });

      await queryInterface.removeIndex('ClassMemberships', 'class_memberships_student_class_unique', { transaction: t });
      await queryInterface.addColumn(
        'ClassMemberships',
        'academicYearId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'AcademicYears', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      await queryInterface.removeColumn('ClassMemberships', 'classId', { transaction: t });

      await queryInterface.removeIndex('Sections', 'sections_class_batch_name_unique', { transaction: t });
      await queryInterface.addColumn(
        'Sections',
        'academicYearId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'AcademicYears', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      await queryInterface.addIndex('Sections', ['classId', 'academicYearId', 'name'], {
        unique: true,
        name: 'sections_class_year_name_unique',
        transaction: t,
      });
      await queryInterface.removeColumn('Sections', 'startDate', { transaction: t });
      await queryInterface.removeColumn('Sections', 'batchId', { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
