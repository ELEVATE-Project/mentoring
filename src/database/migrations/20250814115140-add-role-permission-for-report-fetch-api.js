'use strict'

require('module-alias/register')
const userRequests = require('@requests/user')
require('dotenv').config()
const common = require('@constants/common')
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission) {
			throw new Error('Permission not found for module, request_type, and api_path')
		}
		return permission.id
	} catch (error) {
		throw error
	}
}

module.exports = {
	async up(queryInterface, Sequelize) {
		const rolePermissionsData = [
			{
				role_title: common.ADMIN_ROLE,
				permission_id: await getPermissionId('reports', ['POST'], '/mentoring/v1/reports/fetchData'),
				module: 'reports',
				request_type: ['POST'],
				api_path: '/mentoring/v1/reports/fetchData',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
		]
		await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', { api_path: '/mentoring/v1/reports/fetchData' }, {})
	},
}
