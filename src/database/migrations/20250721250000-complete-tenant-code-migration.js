'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log('🚀 Starting simplified tenant-code column addition migration...')
			console.log('='.repeat(70))

			// Tables that need tenant_code column (all 25 tables from helper.js)
			const allTables = [
				'availabilities',
				'connection_requests',
				'connections',
				'default_rules',
				'entities',
				'entity_types',
				'feedbacks',
				'file_uploads',
				'forms',
				'issues',
				'modules',
				'notification_templates',
				'organization_extension',
				'question_sets',
				'questions',
				'report_queries',
				'report_role_mapping',
				'report_types',
				'reports',
				'resources',
				'role_extensions',
				'session_attendees',
				'session_request',
				'sessions',
				'user_extensions',
			]

			// Tables that need both tenant_code AND organization_code columns
			const tablesNeedingOrgCode = [
				'availabilities',
				'default_rules',
				'entity_types',
				'file_uploads',
				'forms',
				'issues',
				'notification_templates',
				'organization_extension',
				'question_sets',
				'questions',
				'report_queries',
				'report_role_mapping',
				'report_types',
				'reports',
				'role_extensions',
				'user_extensions',
			]

			console.log('\n📝 PHASE 1: Adding nullable tenant_code columns...')
			console.log('='.repeat(50))

			// Add tenant_code column to all tables
			for (const tableName of allTables) {
				try {
					// Check if table exists
					const tableExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (!tableExists[0].exists) {
						console.log(`⚠️  Table ${tableName} does not exist, skipping`)
						continue
					}

					// Check if tenant_code column already exists
					const columnExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'tenant_code')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (!columnExists[0].exists) {
						await queryInterface.addColumn(tableName, 'tenant_code', {
							type: Sequelize.STRING(255),
							allowNull: true, // NULLABLE - no constraints yet
						})
						console.log(`✅ Added nullable tenant_code to ${tableName}`)
					} else {
						console.log(`✅ ${tableName} already has tenant_code column`)
					}
				} catch (error) {
					console.log(`❌ Error adding tenant_code to ${tableName}: ${error.message}`)
				}
			}

			console.log('\n📝 PHASE 2: Adding nullable organization_code columns...')
			console.log('='.repeat(50))

			// Add organization_code column to specific tables
			for (const tableName of tablesNeedingOrgCode) {
				try {
					// Check if table exists
					const tableExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (!tableExists[0].exists) {
						console.log(`⚠️  Table ${tableName} does not exist, skipping`)
						continue
					}

					// Check if organization_code column already exists
					const columnExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'organization_code')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (!columnExists[0].exists) {
						await queryInterface.addColumn(tableName, 'organization_code', {
							type: Sequelize.STRING(255),
							allowNull: true, // NULLABLE - no constraints yet
						})
						console.log(`✅ Added nullable organization_code to ${tableName}`)
					} else {
						console.log(`✅ ${tableName} already has organization_code column`)
					}
				} catch (error) {
					console.log(`❌ Error adding organization_code to ${tableName}: ${error.message}`)
				}
			}

			console.log('\n📝 PHASE 3: Adding user_name column to user_extensions...')
			console.log('='.repeat(50))

			// Add user_name column to user_extensions table specifically
			try {
				// Check if table exists
				const tableExists = await queryInterface.sequelize.query(
					`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_extensions')`,
					{ type: Sequelize.QueryTypes.SELECT }
				)

				if (tableExists[0].exists) {
					// Check if user_name column already exists
					const columnExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_extensions' AND column_name = 'user_name')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (!columnExists[0].exists) {
						await queryInterface.addColumn('user_extensions', 'user_name', {
							type: Sequelize.STRING(255),
							allowNull: true, // NULLABLE - no constraints yet
						})
						console.log(`✅ Added nullable user_name to user_extensions`)
					} else {
						console.log(`✅ user_extensions already has user_name column`)
					}
				} else {
					console.log(`⚠️  Table user_extensions does not exist, skipping`)
				}
			} catch (error) {
				console.log(`❌ Error adding user_name to user_extensions: ${error.message}`)
			}

			console.log('\n🎯 SIMPLIFIED MIGRATION COMPLETED!')
			console.log('='.repeat(70))
			console.log('✅ Added nullable columns only - no data population or constraints')
			console.log('📋 Next steps:')
			console.log('   1. Run backfill data script: cd src/tenantDataMigrations && node helper.js')
			console.log('   2. Run finalization script: cd src && node finalize-tenant-migration.js')
			console.log('='.repeat(70))
		} catch (error) {
			console.error('❌ Simplified migration failed:', error)
			throw error
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log('🔄 Rolling back simplified tenant-code migration...')

			const allTables = [
				'availabilities',
				'connection_requests',
				'connections',
				'default_rules',
				'entities',
				'entity_types',
				'feedbacks',
				'file_uploads',
				'forms',
				'issues',
				'modules',
				'notification_templates',
				'organization_extension',
				'question_sets',
				'questions',
				'report_queries',
				'report_role_mapping',
				'report_types',
				'reports',
				'resources',
				'role_extensions',
				'session_attendees',
				'session_request',
				'sessions',
				'user_extensions',
			]

			// Remove tenant_code columns
			for (const tableName of allTables) {
				try {
					await queryInterface.removeColumn(tableName, 'tenant_code')
					console.log(`✅ Removed tenant_code from ${tableName}`)
				} catch (error) {
					console.log(`⚠️  Could not remove tenant_code from ${tableName}: ${error.message}`)
				}
			}

			// Remove organization_code columns
			const tablesWithOrgCode = [
				'availabilities',
				'default_rules',
				'entity_types',
				'file_uploads',
				'forms',
				'issues',
				'notification_templates',
				'organization_extension',
				'question_sets',
				'questions',
				'report_queries',
				'report_role_mapping',
				'report_types',
				'reports',
				'role_extensions',
				'user_extensions',
			]

			for (const tableName of tablesWithOrgCode) {
				try {
					await queryInterface.removeColumn(tableName, 'organization_code')
					console.log(`✅ Removed organization_code from ${tableName}`)
				} catch (error) {
					console.log(`⚠️  Could not remove organization_code from ${tableName}: ${error.message}`)
				}
			}

			// Remove user_name column from user_extensions
			try {
				await queryInterface.removeColumn('user_extensions', 'user_name')
				console.log(`✅ Removed user_name from user_extensions`)
			} catch (error) {
				console.log(`⚠️  Could not remove user_name from user_extensions: ${error.message}`)
			}

			console.log('✅ Rollback completed')
		} catch (error) {
			console.error('❌ Rollback failed:', error)
			throw error
		}
	},
}
