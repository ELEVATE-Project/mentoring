'use strict'
require('dotenv').config()
const common = require('@constants/common')
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission) {
			throw new Error('No permission found')
		}
		return permission.id
	} catch (error) {
		throw error
	}
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const rolePermissionsData = [
			{
				role_title: common.MENTOR_ROLE,
				permission_id: await getPermissionId('users', ['GET'], '/mentoring/v1/users/requestCount'),
				module: 'users',
				request_type: ['GET'],
				api_path: '/mentoring/v1/users/requestCount',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
		]
		await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
	},

	down: async (queryInterface, Sequelize) => {
		const permissionId = await getPermissionId('users', ['GET'], '/mentoring/v1/users/requestCount')
		await queryInterface.bulkDelete(
			'role_permission_mapping',
			{
				role_title: common.MENTOR_ROLE,
				permission_id: permissionId,
			},
			{}
		)
	},
}
