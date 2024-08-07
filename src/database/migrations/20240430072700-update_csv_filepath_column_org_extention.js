'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('organization_extension', 'uploads', {
			type: Sequelize.JSONB,
			allowNull: true,
		})
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('organization_extension', 'uploads')
	},
}
