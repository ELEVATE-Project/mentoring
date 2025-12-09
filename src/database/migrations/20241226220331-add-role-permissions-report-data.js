'use strict'

require('module-alias/register')
const userRequests = require('@requests/user')
require('dotenv').config()
const common = require('@constants/common')
const Permissions = require('@database/models/index').Permission

const POSTPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})
		if (!permission) {
			throw error
		}
		return permission.id
	} catch (error) {
		throw error
	}
}

module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const rolePermissionsData = [
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await POSTPermissionId('reports', ['POST'], '/mentoring/v1/reports/reportData'),
					module: 'reports',
					request_type: ['POST'],
					api_path: '/mentoring/v1/reports/reportData',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.SESSION_MANAGER_ROLE,
					permission_id: await POSTPermissionId('reports', ['POST'], '/mentoring/v1/reports/reportData'),
					module: 'reports',
					request_type: ['POST'],
					api_path: '/mentoring/v1/reports/reportData',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTEE_ROLE,
					permission_id: await POSTPermissionId('reports', ['POST'], '/mentoring/v1/reports/reportData'),
					module: 'reports',
					request_type: ['POST'],
					api_path: '/mentoring/v1/reports/reportData',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTOR_ROLE,
					permission_id: await POSTPermissionId('reports', ['POST'], '/mentoring/v1/reports/reportData'),
					module: 'reports',
					request_type: ['POST'],
					api_path: '/mentoring/v1/reports/reportData',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
			]
			await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
		} catch (error) {
			console.error(error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', null, {})
	},
}
