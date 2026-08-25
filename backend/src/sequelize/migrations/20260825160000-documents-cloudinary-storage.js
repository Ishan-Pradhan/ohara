'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Documents', 'fileUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Documents', 'filePublicId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    // storageKey stays populated (and readable) for documents uploaded before
    // this migration — their file is still on local disk. New uploads go to
    // Cloudinary and leave storageKey null, so the column can no longer be
    // required.
    await queryInterface.changeColumn('Documents', 'storageKey', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Documents', 'storageKey', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.removeColumn('Documents', 'filePublicId');
    await queryInterface.removeColumn('Documents', 'fileUrl');
  },
};
