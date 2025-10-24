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
			throw 'no permission found'
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
				permission_id: await getPermissionId('cache', ['DELETE', 'GET'], '/mentoring/v1/cache/*'),
				module: 'cache',
				request_type: ['DELETE', 'GET'],
				api_path: '/mentoring/v1/cache/*',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
			{
				role_title: common.ORG_ADMIN_ROLE,
				permission_id: await getPermissionId('cache', ['DELETE', 'GET'], '/mentoring/v1/cache/*'),
				module: 'cache',
				request_type: ['DELETE', 'GET'],
				api_path: '/mentoring/v1/cache/*',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
		]
		await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', {
			module: 'cache',
			api_path: '/mentoring/v1/cache/*',
		})
	},
}
