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
					role_title: common.MENTEE_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['POST'],
						'/mentoring/v1/requestSessions/create'
					),
					module: 'requestSessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/requestSessions/create',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTEE_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/list'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTOR_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/list'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.SESSION_MANAGER_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/list'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/list'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTEE_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/getDetails'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/getDetails',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTOR_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/getDetails'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/getDetails',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.SESSION_MANAGER_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/getDetails'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/getDetails',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/getDetails'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/getDetails',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTOR_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['POST'],
						'/mentoring/v1/requestSessions/accept'
					),
					module: 'requestSessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/requestSessions/accept',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTOR_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['POST'],
						'/mentoring/v1/requestSessions/reject'
					),
					module: 'requestSessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/requestSessions/reject',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTEE_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/userAvailability'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/userAvailability',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.MENTOR_ROLE,
					permission_id: await POSTPermissionId(
						'requestSessions',
						['GET'],
						'/mentoring/v1/requestSessions/userAvailability'
					),
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/userAvailability',
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
