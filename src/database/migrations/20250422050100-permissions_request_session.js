'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const permissionsData = [
				{
					code: 'request_sessions_create_permission',
					module: 'requestSessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/requestSessions/create',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'request_sessions_list_all_permission',
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'request_sessions_getDetails_permission',
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/getDetails',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'request_sessions_accept_permission',
					module: 'requestSessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/requestSessions/accept',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'request_sessions_reject_permission',
					module: 'requestSessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/requestSessions/reject',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'request_sessions_userAvailability_permission',
					module: 'requestSessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/requestSessions/userAvailability',
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
