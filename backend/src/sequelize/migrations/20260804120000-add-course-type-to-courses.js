'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Courses', 'courseType', {
      type: Sequelize.ENUM('compulsory', 'elective'),
      allowNull: false,
      defaultValue: 'compulsory',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Courses', 'courseType');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Courses_courseType";');
  },
};
