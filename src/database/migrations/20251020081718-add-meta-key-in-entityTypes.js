'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('entity_types', 'meta', {
			type: Sequelize.JSONB,
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('entity_types', 'meta')
	},
}
