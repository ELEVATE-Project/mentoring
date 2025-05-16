'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const permissionsData = [
			{
				code: 'resource_api',
				module: 'resources',
				request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
				api_path: '/mentoring/v1/resources/*',
				status: 'ACTIVE',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]
		await queryInterface.bulkInsert('permissions', permissionsData)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('permissions', null, {})
	},
}
