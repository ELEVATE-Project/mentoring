'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('entity_types', 'report_filter', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		})

		await queryInterface.sequelize.query('UPDATE entity_types SET report_filter = false;')
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('entity_types', 'report_filter')
	},
}
