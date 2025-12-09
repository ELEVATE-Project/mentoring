'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const permissionsData = [
				{
					code: 'reports_filter_permission',
					module: 'reports',
					request_type: ['GET'],
					api_path: '/mentoring/v1/reports/filterList',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]
			await queryInterface.bulkInsert('permissions', permissionsData)
		} catch (error) {
			console.log(error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('permissions', null, {})
	},
}
