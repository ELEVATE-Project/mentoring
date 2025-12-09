'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const permissionsData = [
				{
					code: 'reports_crud_permission',
					module: 'reports',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/reports/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'reports_type_crud_permission',
					module: 'report-type',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/report-type/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'reports_role_mapping_crud_permission',
					module: 'report-mapping',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/report-mapping/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'reports_queries_crud_permission',
					module: 'report-queries',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/report-queries/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'role_extension_crud_permission',
					module: 'role-extension',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/role-extension/*',
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
