'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('sessions', 'medium', {
			type: Sequelize.ARRAY(Sequelize.STRING),
			allowNull: true,
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('sessions', 'medium', {
			type: Sequelize.ARRAY(Sequelize.STRING),
			allowNull: false,
		})
	},
}
