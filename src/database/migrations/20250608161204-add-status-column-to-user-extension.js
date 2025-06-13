'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('user_extensions', 'status', {
			type: Sequelize.STRING,
			allowNull: true,
			defaultValue: 'ACTIVE',
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('user_extensions', 'status')
	},
}
