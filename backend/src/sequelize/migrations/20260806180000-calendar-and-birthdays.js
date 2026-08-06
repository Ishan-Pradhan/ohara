'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The Events table shipped this same session with a course/section-scoped
    // model that's being replaced by an institution-type/program/class model
    // for a proper academic calendar — dropping and recreating is simpler and
    // safer than an in-place enum-value removal, and no real data exists yet.
    await queryInterface.dropTable('Events');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Events_audience";');

    await queryInterface.createTable('Events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      type: {
        type: Sequelize.ENUM('event', 'holiday', 'exam'),
        allowNull: false,
        defaultValue: 'event',
      },
      startAt: { type: Sequelize.DATE, allowNull: false },
      endAt: { type: Sequelize.DATE, allowNull: true },
      allDay: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      audience: {
        type: Sequelize.ENUM('global', 'institution_type', 'program', 'class'),
        allowNull: false,
      },
      institutionType: {
        type: Sequelize.ENUM('school', 'college', 'university'),
        allowNull: true,
      },
      programId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Programs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      classId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Classes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
    await queryInterface.addIndex('Events', ['startAt']);

    // Teachers/admins have no profile table (unlike students' lazily-created
    // StudentProfile) — a single nullable column is the right size for one
    // field, not worth a new table.
    await queryInterface.addColumn('Users', 'dateOfBirth', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'dateOfBirth');
    await queryInterface.dropTable('Events');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Events_audience";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Events_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Events_institutionType";');
  },
};
