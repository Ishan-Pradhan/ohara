'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Enrollments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      studentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      courseId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Courses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      academicYearId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'AcademicYears', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM('active', 'completed', 'dropped'),
        allowNull: false,
        defaultValue: 'active',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('Enrollments', ['studentId', 'courseId', 'academicYearId'], {
      unique: true,
      name: 'enrollments_student_course_year_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Enrollments');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_Enrollments_status";',
    );
  },
};
