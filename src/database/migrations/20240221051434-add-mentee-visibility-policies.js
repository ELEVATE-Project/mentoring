'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('organization_extension', 'mentee_visibility_policy', {
			type: Sequelize.STRING,
			defaultValue: 'CURRENT',
		})

		await queryInterface.addColumn('organization_extension', 'external_mentee_visibility_policy', {
			type: Sequelize.STRING,
			defaultValue: 'CURRENT',
		})

		await queryInterface.addColumn('user_extensions', 'external_mentee_visibility', {
			type: Sequelize.STRING,
			defaultValue: 'CURRENT',
		})

		await queryInterface.addColumn('mentor_extensions', 'external_mentee_visibility', {
			type: Sequelize.STRING,
			defaultValue: 'CURRENT',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('organization_extension', 'mentee_visibility_policy')
		await queryInterface.removeColumn('organization_extension', 'external_mentee_visibility_policy')
		await queryInterface.removeColumn('user_extensions', 'external_mentee_visibility')
		await queryInterface.removeColumn('mentor_extensions', 'external_mentee_visibility')
	},
}
