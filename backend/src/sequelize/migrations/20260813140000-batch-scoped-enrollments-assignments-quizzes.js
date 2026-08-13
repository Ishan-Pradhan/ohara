'use strict';

// (assignmentId, batchId) pairs, derived once (before writing this migration) from the
// pre-migration backup: for each assignment, its course's classId + its own academicYearId
// resolved to exactly one batch that had a Section (classId, that academicYearId) with real
// ClassMemberships in it — verified zero ambiguous (0 or 2+ candidate) rows before trusting this.
const ASSIGNMENT_BATCH_MAP = [
  ['88f5b7fa-f75a-4791-b41a-231e26932889', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['c66f7732-dea0-4d39-8f00-58e48e06475d', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['1e5df3fa-fe58-4726-8080-4d0ce1323adb', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['09daa078-95a8-475f-8d5e-a0ffabbeeb42', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['b03da541-e25e-4107-a607-5a1d5c6ba7bf', 'b44b09f9-712c-4f22-ae62-79ee85f0ddbf'],
  ['2f12f497-c676-4426-b063-5e10874c85b8', 'b44b09f9-712c-4f22-ae62-79ee85f0ddbf'],
  ['0236b671-a9b1-4db5-b253-694580961487', 'b44b09f9-712c-4f22-ae62-79ee85f0ddbf'],
  ['1875cbe9-fe7b-4534-bc1b-64638ddb188c', '650ea4ec-53c0-455a-8429-55c61eccf279'],
  ['02e0c6c2-743f-4a07-b7c9-e35d4665f16a', '650ea4ec-53c0-455a-8429-55c61eccf279'],
  ['338e3732-18bc-411a-a358-5255a50fee31', '650ea4ec-53c0-455a-8429-55c61eccf279'],
  ['92cd590e-6ccc-4c7a-be73-7d20a377c80d', '51d36189-a91b-4113-bb5d-49d5240696aa'],
  ['b610e7a3-57b2-49d8-beb6-9bfc048a26c8', '51d36189-a91b-4113-bb5d-49d5240696aa'],
  ['df98b176-39f5-4802-872c-b7e1091ab632', '51d36189-a91b-4113-bb5d-49d5240696aa'],
  ['ef530482-007f-4b7b-9ca8-3fa66972092c', '3748de82-558a-469a-957f-1f09294a1900'],
  ['e111f1b7-9835-4580-b2c5-90d96d79ea60', '3748de82-558a-469a-957f-1f09294a1900'],
  ['55cd9111-a2a5-4795-a874-0571c6c0921f', '0d4f38ec-2e2c-48a1-87aa-fff9d0458a1d'],
  ['bcdab031-6ae7-41b9-90d0-741e11656e0d', '0d4f38ec-2e2c-48a1-87aa-fff9d0458a1d'],
  ['dac9e2c5-503f-4536-b498-e9337ba4bde3', '0d4f38ec-2e2c-48a1-87aa-fff9d0458a1d'],
  ['cb5e9f03-77e4-4c61-ad47-84c57d69769d', '81b8dee4-7e99-4a94-bf3f-15afcfa44468'],
  ['53f3a22c-ec22-4638-95bf-874d06354457', '81b8dee4-7e99-4a94-bf3f-15afcfa44468'],
  ['61c23035-fa05-424a-9c81-5aa0ff584320', 'b72e3c13-ea48-4c98-9701-d2acdc499829'],
  ['f51ee9ba-fa20-428d-bc16-fb2f29b23e8d', 'b72e3c13-ea48-4c98-9701-d2acdc499829'],
  ['af3cd2d1-da45-404f-b26c-4bbe43604055', 'b72e3c13-ea48-4c98-9701-d2acdc499829'],
  ['de19fc2d-1382-4943-b33c-4794f9f056bb', '81b8dee4-7e99-4a94-bf3f-15afcfa44468'],
  ['140db78b-4106-406a-8ab9-9c603c3858ac', '3748de82-558a-469a-957f-1f09294a1900'],
];

const QUIZ_BATCH_MAP = [
  ['36e31356-15fb-440f-a21f-0d46570eb28a', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['227ed775-6b8d-4b85-8894-ebcbd951d30d', 'ee24141c-bf18-4f3d-839f-d521a0f0c8f5'],
  ['f151b7bf-5b51-4d29-86d9-aa6101ca6637', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['77c466b3-59c9-4b9c-b24e-dab5acb0d410', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['4bad81b8-74f2-4623-a660-496f04440898', '91be4f1b-13d4-4058-9eb8-fdc7a01292f0'],
  ['7f699df9-e303-49c9-a441-0c7a7821b36d', 'b44b09f9-712c-4f22-ae62-79ee85f0ddbf'],
  ['2106c7f0-0326-40b9-a6ab-5f42d3f9f598', 'b44b09f9-712c-4f22-ae62-79ee85f0ddbf'],
  ['d5cbcab3-ada7-48e3-bcaf-c8f269339bdc', 'b44b09f9-712c-4f22-ae62-79ee85f0ddbf'],
  ['5ed440e5-be65-4e95-9f78-103455a71a4f', '650ea4ec-53c0-455a-8429-55c61eccf279'],
  ['c5384863-65e6-4ce8-b441-d030b2e78fb2', '650ea4ec-53c0-455a-8429-55c61eccf279'],
  ['d871794c-89ce-4f2e-858a-9524875677cc', '650ea4ec-53c0-455a-8429-55c61eccf279'],
  ['48876f4d-d46a-4a6b-9528-8eab01c05af4', '51d36189-a91b-4113-bb5d-49d5240696aa'],
  ['de97661d-7319-4b38-8955-2ff48bf93f03', '51d36189-a91b-4113-bb5d-49d5240696aa'],
  ['fddefb1f-9390-41f8-8e7a-6496140b8e03', '51d36189-a91b-4113-bb5d-49d5240696aa'],
  ['5362425f-f9b5-4050-8188-be0f9e414e46', '3748de82-558a-469a-957f-1f09294a1900'],
  ['e094b9b4-07e4-4e93-baa2-ceb7cb6e1401', '3748de82-558a-469a-957f-1f09294a1900'],
  ['750225d9-80d7-40ac-bfce-7a813feb77dd', '0d4f38ec-2e2c-48a1-87aa-fff9d0458a1d'],
  ['941d3fed-be0b-49bb-90bf-47309ea93290', '0d4f38ec-2e2c-48a1-87aa-fff9d0458a1d'],
  ['021dbe56-1810-43a6-886d-91fc8140c63f', '0d4f38ec-2e2c-48a1-87aa-fff9d0458a1d'],
  ['e6734732-b997-4f50-bbcd-30c4e48d217a', '81b8dee4-7e99-4a94-bf3f-15afcfa44468'],
  ['e371dff4-6669-4c9a-a567-4b565f0adf9b', '81b8dee4-7e99-4a94-bf3f-15afcfa44468'],
  ['50bf07a5-0b19-41b2-a313-f4484442486f', 'b72e3c13-ea48-4c98-9701-d2acdc499829'],
  ['d4e155ba-d1db-49d2-b426-25f441450195', 'b72e3c13-ea48-4c98-9701-d2acdc499829'],
  ['dbfa70e6-0cd1-48fc-ae8a-293d32e29def', 'b72e3c13-ea48-4c98-9701-d2acdc499829'],
  ['bd37573d-d8e7-4255-bdc8-ce848614cbf4', '81b8dee4-7e99-4a94-bf3f-15afcfa44468'],
  ['44929cff-bdf7-4824-b458-c55066c7db0d', '3748de82-558a-469a-957f-1f09294a1900'],
];

const valuesList = (pairs) => pairs.map(([a, b]) => `('${a}'::uuid, '${b}'::uuid)`).join(',\n           ');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Assignments/Quizzes/Enrollments used `academicYearId` for exactly one job: stop a new
  // batch reaching a class from inheriting the previous batch's assignments/quizzes/due-dates/
  // enrollment rows for the same course. Now that ClassMemberships tracks a batch's own
  // progression directly (see 20260813130000), that job belongs to `batchId` instead — a course
  // is reused by every batch that reaches its class, exactly the thing `batchId` already
  // disambiguates, with no year-matching required. This also retires
  // `resolveCurrentAcademicYearForCourse`'s three-tier fallback: "who's really enrolled now" is
  // just `ClassMemberships.outcome = 'enrolled'` joined on classId, no guessing.
  //
  // Enrollments backfill is unambiguous and needs no historical data: a student's batch is
  // permanent, so `ClassMemberships` (student, course's classId) already gives the right batch
  // for every existing enrollment row — verified zero unmatched enrollment rows before writing
  // this.
  //
  // Assignments/Quizzes backfill has no live signal to derive from — `Sections.academicYearId`
  // was already dropped by 20260813130000 — so it's computed from the pre-migration pg_dump
  // instead (each assignment/quiz's old academicYearId + its course's classId resolved to
  // exactly one batch with real ClassMemberships in a Section for that (classId, year); verified
  // zero ambiguous rows before trusting this) and hard-coded above as the map for this specific
  // dataset. A fresh install has zero rows here, so the maps are simply empty lists to iterate.
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // ── Assignments ──────────────────────────────────────────────────────
      await queryInterface.addColumn(
        'Assignments',
        'batchId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Batches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      if (ASSIGNMENT_BATCH_MAP.length > 0) {
        await queryInterface.sequelize.query(
          `UPDATE "Assignments" a SET "batchId" = m.batch_id
           FROM (VALUES
           ${valuesList(ASSIGNMENT_BATCH_MAP)}
           ) AS m(assignment_id, batch_id)
           WHERE a.id = m.assignment_id;`,
          { transaction: t },
        );
      }
      await queryInterface.changeColumn(
        'Assignments',
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
      await queryInterface.removeColumn('Assignments', 'academicYearId', { transaction: t });

      // ── Quizzes ──────────────────────────────────────────────────────────
      await queryInterface.addColumn(
        'Quizzes',
        'batchId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Batches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      if (QUIZ_BATCH_MAP.length > 0) {
        await queryInterface.sequelize.query(
          `UPDATE "Quizzes" q SET "batchId" = m.batch_id
           FROM (VALUES
           ${valuesList(QUIZ_BATCH_MAP)}
           ) AS m(quiz_id, batch_id)
           WHERE q.id = m.quiz_id;`,
          { transaction: t },
        );
      }
      await queryInterface.changeColumn(
        'Quizzes',
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
      await queryInterface.removeColumn('Quizzes', 'academicYearId', { transaction: t });

      // ── Enrollments ──────────────────────────────────────────────────────
      await queryInterface.addColumn(
        'Enrollments',
        'batchId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Batches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t },
      );
      await queryInterface.sequelize.query(
        `UPDATE "Enrollments" e
         SET "batchId" = cm."batchId"
         FROM "ClassMemberships" cm, "Courses" c
         WHERE e."courseId" = c.id AND cm."studentId" = e."studentId" AND cm."classId" = c."classId";`,
        { transaction: t },
      );
      await queryInterface.changeColumn(
        'Enrollments',
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
      await queryInterface.removeIndex('Enrollments', 'enrollments_student_course_year_unique', {
        transaction: t,
      });
      await queryInterface.removeColumn('Enrollments', 'academicYearId', { transaction: t });
      await queryInterface.addIndex('Enrollments', ['studentId', 'courseId', 'batchId'], {
        unique: true,
        name: 'enrollments_student_course_batch_unique',
        transaction: t,
      });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  // Schema rollback, not a full data-preserving reversal — same caveat as 20260813130000's
  // down(): academicYearId comes back as a nullable column with no values, since the real
  // historical mapping isn't reconstructable from post-migration state alone.
  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('Enrollments', 'enrollments_student_course_batch_unique', {
        transaction: t,
      });
      await queryInterface.addColumn(
        'Enrollments',
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
      await queryInterface.addIndex('Enrollments', ['studentId', 'courseId', 'academicYearId'], {
        unique: true,
        name: 'enrollments_student_course_year_unique',
        transaction: t,
      });
      await queryInterface.removeColumn('Enrollments', 'batchId', { transaction: t });

      await queryInterface.addColumn(
        'Quizzes',
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
      await queryInterface.removeColumn('Quizzes', 'batchId', { transaction: t });

      await queryInterface.addColumn(
        'Assignments',
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
      await queryInterface.removeColumn('Assignments', 'batchId', { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
