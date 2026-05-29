'use strict'

/**
 * Adds composite indexes to back the new organization_code predicates introduced
 * by the org-code migration (Issue 3):
 *
 * - user_extensions(tenant_code, organization_code): backs both UPDATE queries in
 *   addVisibleToOrg which filter on WHERE organization_code = $2 AND tenant_code = $3
 *
 * - sessions(tenant_code, mentor_organization_code): backs queries that filter
 *   sessions by the new mentor_organization_code column added in migration 00001
 */
module.exports = {
	async up(queryInterface) {
		await queryInterface.addIndex('user_extensions', ['tenant_code', 'organization_code'], {
			name: 'idx_user_extensions_tenant_org_code',
		})
		console.log(
			'Created index idx_user_extensions_tenant_org_code on user_extensions(tenant_code, organization_code)'
		)

		await queryInterface.addIndex('sessions', ['tenant_code', 'mentor_organization_code'], {
			name: 'idx_sessions_tenant_mentor_org_code',
		})
		console.log(
			'Created index idx_sessions_tenant_mentor_org_code on sessions(tenant_code, mentor_organization_code)'
		)
	},

	async down(queryInterface) {
		await queryInterface.removeIndex('user_extensions', 'idx_user_extensions_tenant_org_code')
		await queryInterface.removeIndex('sessions', 'idx_sessions_tenant_mentor_org_code')
	},
}
