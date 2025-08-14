'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const permissionsData = [
			{
				code: 'request_count_api',
				module: 'users',
				request_type: ['GET'],
				api_path: '/mentoring/v1/users/requestCount',
				status: 'ACTIVE',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]
		await queryInterface.bulkInsert('permissions', permissionsData)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete(
			'permissions',
			{
				code: 'request_count_api',
			},
			{}
		)
	},
}
