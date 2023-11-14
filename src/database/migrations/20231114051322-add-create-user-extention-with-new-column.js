'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('user_extensions', 'status', {
			type: Sequelize.STRING,
			defaultValue: 'ACTIVE',
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('mentor_extensions', 'status')
	},
}
