'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.bulkDelete(
			'permissions',
			{
				api_path: '/mentoring/v1/org-admin/themeDetails',
			},
			{}
		)

		await queryInterface.bulkDelete(
			'role_permission_mapping',
			{
				api_path: '/mentoring/v1/org-admin/themeDetails',
			},
			{}
		)
	},

	async down(queryInterface, Sequelize) {
		const permissionsData = [
			{
				code: 'org_theme_details',
				module: 'org-admin',
				request_type: ['GET'],
				api_path: '/mentoring/v1/org-admin/themeDetails',
				status: 'ACTIVE',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]
		await queryInterface.bulkInsert('permissions', permissionsData)

		const rolePermissionsData = [
			{
				role_title: common.ORG_ADMIN_ROLE,
				permission_id: await getPermissionId('org-admin', ['GET'], '/mentoring/v1/org-admin/themeDetails'),
				module: 'org-admin',
				request_type: ['GET'],
				api_path: '/mentoring/v1/org-admin/themeDetails',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
			{
				role_title: common.MENTOR_ROLE,
				permission_id: await getPermissionId('org-admin', ['GET'], '/mentoring/v1/org-admin/themeDetails'),
				module: 'org-admin',
				request_type: ['GET'],
				api_path: '/mentoring/v1/org-admin/themeDetails',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
			{
				role_title: common.ADMIN_ROLE,
				permission_id: await getPermissionId('org-admin', ['GET'], '/mentoring/v1/org-admin/themeDetails'),
				module: 'org-admin',
				request_type: ['GET'],
				api_path: '/mentoring/v1/org-admin/themeDetails',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
			{
				role_title: common.MENTEE_ROLE,
				permission_id: await getPermissionId('org-admin', ['GET'], '/mentoring/v1/org-admin/themeDetails'),
				module: 'org-admin',
				request_type: ['GET'],
				api_path: '/mentoring/v1/org-admin/themeDetails',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
			{
				role_title: common.SESSION_MANAGER_ROLE,
				permission_id: await getPermissionId('org-admin', ['GET'], '/mentoring/v1/org-admin/themeDetails'),
				module: 'org-admin',
				request_type: ['GET'],
				api_path: '/mentoring/v1/org-admin/themeDetails',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
			{
				role_title: common.USER_ROLE,
				permission_id: await getPermissionId('org-admin', ['GET'], '/mentoring/v1/org-admin/themeDetails'),
				module: 'org-admin',
				request_type: ['GET'],
				api_path: '/mentoring/v1/org-admin/themeDetails',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
		]
		await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
	},
}
