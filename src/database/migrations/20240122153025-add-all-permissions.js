'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('permissions', null, {})

		try {
			const permissionsData = [
				//Mentoring API's
				{
					code: 'admin_permissions',
					module: 'admin',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/admin/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'get_signedurl_permissions',
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/mentoring/v1/cloud-services/getSignedUrl',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'entity_type_permissions',
					module: 'entity-type',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/entity-type/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_entity_type_permissions',
					module: 'entity-type',
					request_type: ['POST'],
					api_path: '/mentoring/v1/entity-type/read',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'entity_permissions',
					module: 'entity',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/entity/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_entity_permissions',
					module: 'entity',
					request_type: ['POST'],
					api_path: '/mentoring/v1/entity/read',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'feedback_permissions',
					module: 'feedback',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/feedback/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'form_permissions',
					module: 'form',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/form/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_form_permissions',
					module: 'form',
					request_type: ['POST'],
					api_path: '/mentoring/v1/form/read*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'issues_permissions',
					module: 'issues',
					request_type: ['POST'],
					api_path: '/mentoring/v1/issues/create',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'mentees_permissions',
					module: 'mentees',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/mentees/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'create_mentors_permissions',
					module: 'mentors',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/mentors/create',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'createdsession_mentors_permissions',
					module: 'mentors',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/mentors/createdSessions',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'deletementor_extension_permissions',
					module: 'mentors',
					request_type: ['POST', 'DELETE'],
					api_path: '/mentoring/v1/mentors/deleteMentorExtension',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'mentor_reports_permissions',
					module: 'mentors',
					request_type: ['GET'],
					api_path: '/mentoring/v1/mentors/reports',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'mentor_update_permissions',
					module: 'mentors',
					request_type: ['POST', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/mentors/update',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'mentor_permissions',
					module: 'mentors',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/mentors/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'notification_permissions',
					module: 'notification',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/notification/template*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'org_admin_permissions',
					module: 'org-admin',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/org-admin/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'organization_permissions',
					module: 'organization',
					request_type: ['POST', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/organization/update',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'platform_permissions',
					module: 'platform',
					request_type: ['GET'],
					api_path: '/mentoring/v1/platform/config',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'profile_permissions',
					module: 'profile',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/profile/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'questions_permissions',
					module: 'questions',
					request_type: ['POST', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/questions/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_questions_permissions',
					module: 'questions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/questions/read*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'questions_set_permissions',
					module: 'question-set',
					request_type: ['POST', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/question-set/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_questions_set_permissions',
					module: 'question-set',
					request_type: ['POST'],
					api_path: '/mentoring/v1/question-set/read*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'sessions_completed_permissions',
					module: 'sessions',
					request_type: ['PATCH', 'GET'],
					api_path: '/mentoring/v1/sessions/completed*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'enrolledmentees_permissions',
					module: 'sessions',
					request_type: ['GET'],
					api_path: '/mentoring/v1/sessions/enrolledMentees*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'start_session_permissions',
					module: 'sessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/sessions/start*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'update_session_permissions',
					module: 'sessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/sessions/update*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'updaterecording_permissions',
					module: 'sessions',
					request_type: ['POST'],
					api_path: '/mentoring/v1/sessions/updateRecordingUrl*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'sessionss_permissions',
					module: 'sessions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/sessions/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'users_permissions',
					module: 'users',
					request_type: ['GET'],
					api_path: '/mentoring/v1/users/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'permissionss',
					module: 'permissions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/permissions/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'modules_permissionss',
					module: 'modules',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/modules/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'role_mapping_permissionss',
					module: 'role-permission-mapping',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/role-permission-mapping/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_role_mapping_permissionss',
					module: 'role-permission-mapping',
					request_type: ['POST'],
					api_path: '/mentoring/v1/role-permission-mapping/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'manage_sessions_permissionss',
					module: 'manage-sessions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/manage-sessions/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'addmentee_session_permissionss',
					module: 'sessions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/mentoring/v1/sessions/addMentees',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'profile_filter_permissionss',
					module: 'profile',
					request_type: ['GET'],
					api_path: '/mentoring/v1/profile/filterList',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'mentee_list_permissionss',
					module: 'mentees',
					request_type: ['GET'],
					api_path: '/mentoring/v1/mentees/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'remove_mentees_permissionss',
					module: 'sessions',
					request_type: ['DELETE'],
					api_path: '/mentoring/v1/sessions/removeMentees',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]
			await queryInterface.bulkInsert('permissions', permissionsData)
		} catch (error) {
			console.log(error)
			throw error
		}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('permissions', null, {})
	},
}
