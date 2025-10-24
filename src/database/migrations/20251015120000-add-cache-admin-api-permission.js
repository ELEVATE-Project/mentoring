'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const permissionsData = [
			{
				code: 'cache_admin_api',
				module: 'cache',
				request_type: ['DELETE', 'GET'],
				api_path: '/mentoring/v1/cache/*',
				status: 'ACTIVE',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]
		await queryInterface.bulkInsert('permissions', permissionsData)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('permissions', {
			code: 'cache_admin_api',
			module: 'cache',
			api_path: '/mentoring/v1/cache/*',
		})
	},
}
