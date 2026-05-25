'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface) => {
		const transaction = await queryInterface.sequelize.transaction()

		try {
			// Step 1: Get all tenants from organization_extension restricted to the default org
			const defaultOrgCode = process.env.DEFAULT_ORGANISATION_CODE
			if (!defaultOrgCode) {
				throw new Error('DEFAULT_ORGANISATION_CODE env variable is not set')
			}

			const [defaultOrgPerTenants] = await queryInterface.sequelize.query(
				`SELECT DISTINCT oe.tenant_code, oe.organization_id, oe.organization_code
				FROM organization_extension oe
				INNER JOIN tenants t ON t.code = oe.tenant_code AND t.deleted_at IS NULL
				WHERE oe.deleted_at IS NULL
					AND oe.organization_code = :defaultOrgCode
				ORDER BY oe.tenant_code, oe.organization_id`,
				{ transaction, replacements: { defaultOrgCode } }
			)

			if (defaultOrgPerTenants.length === 0) {
				console.log(
					'No active tenant-org combinations found in organization_extension. Skipping role_extensions insert.'
				)
			} else {
				// Step 2: Insert tenant_admin into role_extensions for each tenant+org combination
				const roleExtensionInserts = defaultOrgPerTenants.map((row) => ({
					title: 'tenant_admin',
					label: 'Tenant Admin',
					status: 'ACTIVE',
					scope: 'ALL',
					organization_id: row.organization_id,
					organization_code: row.organization_code,
					tenant_code: row.tenant_code,
					created_at: new Date(),
					updated_at: new Date(),
					deleted_at: null,
				}))

				await queryInterface.bulkInsert('role_extensions', roleExtensionInserts, {
					transaction,
					ignoreDuplicates: true,
				})

				console.log(`Inserted tenant_admin role for ${defaultOrgPerTenants.length} active tenants`)
			}

			// Step 3: Copy all admin permissions except the admin module
			const [adminPermissions] = await queryInterface.sequelize.query(
				`SELECT DISTINCT
					permission_id,
					module,
					request_type,
					api_path,
					created_by
				FROM role_permission_mapping
				WHERE role_title = 'admin'
					AND module != 'admin'
				ORDER BY permission_id`,
				{ transaction }
			)

			console.log(`Found ${adminPermissions.length} permissions to copy for tenant_admin`)

			if (adminPermissions.length > 0) {
				const permissionInserts = adminPermissions.map((perm) => ({
					role_title: 'tenant_admin',
					permission_id: perm.permission_id,
					module: perm.module,
					request_type: perm.request_type,
					api_path: perm.api_path,
					created_at: new Date(),
					updated_at: new Date(),
					created_by: perm.created_by,
				}))

				await queryInterface.bulkInsert('role_permission_mapping', permissionInserts, {
					transaction,
					ignoreDuplicates: true,
				})

				console.log(`Inserted ${permissionInserts.length} permissions for tenant_admin`)
			}

			await transaction.commit()
			console.log('Migration completed successfully')
		} catch (error) {
			await transaction.rollback()
			console.error('Migration failed, rolled back:', error)
			throw error
		}
	},

	down: async (queryInterface) => {
		const transaction = await queryInterface.sequelize.transaction()

		try {
			await queryInterface.sequelize.query(
				`DELETE FROM role_permission_mapping WHERE role_title = 'tenant_admin'`,
				{ transaction }
			)

			await queryInterface.sequelize.query(`DELETE FROM role_extensions WHERE title = 'tenant_admin'`, {
				transaction,
			})

			await transaction.commit()
			console.log('Rollback completed successfully')
		} catch (error) {
			await transaction.rollback()
			console.error('Rollback failed:', error)
			throw error
		}
	},
}
