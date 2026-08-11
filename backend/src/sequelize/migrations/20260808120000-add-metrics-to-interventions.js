'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('interventions', 'metricsAtCreation', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Snapshot of student metrics at intervention creation',
    });

    await queryInterface.addColumn('interventions', 'metricsAtResolution', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Snapshot of student metrics at intervention resolution',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('interventions', 'metricsAtResolution');
    await queryInterface.removeColumn('interventions', 'metricsAtCreation');
  },
};
