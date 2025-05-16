'use strict'

module.exports = {
	up: (queryInterface, Sequelize) => {
		return queryInterface.addColumn('resources', 'mime_type', {
			type: Sequelize.STRING,
			allowNull: true,
			defaultValue: null,
		})
	},

	down: (queryInterface, Sequelize) => {
		return queryInterface.removeColumn('resources', 'mime_type')
	},
}
