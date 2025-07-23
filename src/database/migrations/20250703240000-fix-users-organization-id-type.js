'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Change organization_id from integer to varchar for tenant-code migration
		await queryInterface.changeColumn('users', 'organization_id', {
			type: Sequelize.STRING,
			allowNull: false,
		})
	},

	async down(queryInterface, Sequelize) {
		// Revert back to integer
		await queryInterface.changeColumn('users', 'organization_id', {
			type: Sequelize.INTEGER,
			allowNull: false,
		})
	},
}
