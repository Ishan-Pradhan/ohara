'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Questions', 'difficulty', {
      type: Sequelize.ENUM('easy', 'medium', 'hard'),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('Questions', 'cognitiveLevel', {
      type: Sequelize.ENUM('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Questions', 'difficulty');
    await queryInterface.removeColumn('Questions', 'cognitiveLevel');
  },
};
