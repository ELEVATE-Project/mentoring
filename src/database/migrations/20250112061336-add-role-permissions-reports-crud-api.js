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
					permission_id: await getPermissionId(
						'reports',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/mentoring/v1/reports/*'
					),
					module: 'reports',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/reports/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'report-type',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/mentoring/v1/report-type/*'
					),
					module: 'report-type',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/report-type/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'report-mapping',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/mentoring/v1/report-mapping/*'
					),
					module: 'report-mapping',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/report-mapping/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'report-queries',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/mentoring/v1/report-queries/*'
					),
					module: 'report-queries',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/report-queries/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'role-extension',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/mentoring/v1/role-extension/*'
					),
					module: 'role-extension',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/role-extension/*',
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
