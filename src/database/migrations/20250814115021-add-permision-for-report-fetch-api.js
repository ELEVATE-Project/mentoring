'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const permissionsData = [
			{
				code: 'report_fetch',
				module: 'reports',
				request_type: ['POST'],
				api_path: '/mentoring/v1/reports/fetchData',
				status: 'ACTIVE',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]
		await queryInterface.bulkInsert('permissions', permissionsData)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('permissions', { code: 'report_fetch' }, {})
	},
}
