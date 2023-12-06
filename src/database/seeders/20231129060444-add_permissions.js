'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		const permissionsData = [
			{ code: 'All_session', module: 'sessions', actions: 'ALL', status: 'ACTIVE' },
			{ code: 'READ_session', module: 'sessions', actions: 'READ', status: 'ACTIVE' },
			{ code: 'WRITE_session', module: 'sessions', actions: 'WRITE', status: 'ACTIVE' },
			{ code: 'UPDATE_session', module: 'sessions', actions: 'UPDATE', status: 'ACTIVE' },
			{ code: 'DELETE_session', module: 'sessions', actions: 'DELETE', status: 'ACTIVE' },
		]

		// Insert the data into the 'permissions' table
		await queryInterface.bulkInsert('permissions', permissionsData)
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the 'permissions' table
		await queryInterface.dropTable('permissions')
	},
}
