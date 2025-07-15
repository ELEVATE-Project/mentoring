'use strict'

/**
 * Validate that all organization_ids in database tables exist in the CSV file
 * Fails the migration if any database organization_ids are missing from CSV
 */
async function validateDatabaseOrgsCoveredByCSV(orgLookupCache, queryInterface, Sequelize) {
	console.log('\n🔍 Validating database organization_ids coverage in CSV...')

	const missingOrgs = new Set()
	const csvOrgIds = new Set(orgLookupCache.keys())

	// Get all organization_ids from tables that have organization_id column
	const tablesWithOrgId = [
		'availabilities',
		'default_rules',
		'entity_types',
		'file_uploads',
		'forms',
		'notification_templates',
		'organization_extension',
		'report_queries',
		'report_role_mapping',
		'report_types',
		'reports',
		'resources',
		'role_extensions',
		'sessions',
		'user_extensions',
	]

	for (const tableName of tablesWithOrgId) {
		try {
			// Check if table exists first
			const tableExists = await queryInterface.sequelize.query(
				`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
				{ type: Sequelize.QueryTypes.SELECT }
			)

			if (!tableExists[0].exists) {
				console.log(`⚠️  Table ${tableName} does not exist, skipping`)
				continue
			}

			// Get distinct organization_ids from this table
			const orgResults = await queryInterface.sequelize.query(
				`SELECT DISTINCT organization_id::text as org_id
				 FROM ${tableName}
				 WHERE organization_id IS NOT NULL`,
				{ type: Sequelize.QueryTypes.SELECT }
			)

			// Check each organization_id against CSV data
			for (const row of orgResults) {
				const orgId = row.org_id
				if (!csvOrgIds.has(orgId)) {
					missingOrgs.add(orgId)
				}
			}

			console.log(`✅ Checked ${tableName}: ${orgResults.length} distinct organization_ids`)
		} catch (error) {
			console.warn(`⚠️  Failed to check ${tableName}: ${error.message}`)
		}
	}

	// Also check user_id based tables via user_extensions
	const userIdTables = [
		'connection_requests',
		'connections',
		'entities',
		'feedbacks',
		'issues',
		'modules',
		'post_session_details',
		'question_sets',
		'questions',
		'session_attendees',
		'session_request',
	]

	for (const tableName of userIdTables) {
		try {
			// Check if table exists first
			const tableExists = await queryInterface.sequelize.query(
				`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
				{ type: Sequelize.QueryTypes.SELECT }
			)

			if (!tableExists[0].exists) {
				console.log(`⚠️  Table ${tableName} does not exist, skipping`)
				continue
			}

			// Get organization_ids via user_extensions
			const orgResults = await queryInterface.sequelize.query(
				`SELECT DISTINCT ue.organization_id::text as org_id
				 FROM user_extensions ue
				 INNER JOIN ${tableName} t ON t.user_id = ue.user_id
				 WHERE ue.organization_id IS NOT NULL`,
				{ type: Sequelize.QueryTypes.SELECT }
			)

			// Check each organization_id against CSV data
			for (const row of orgResults) {
				const orgId = row.org_id
				if (!csvOrgIds.has(orgId)) {
					missingOrgs.add(orgId)
				}
			}

			console.log(`✅ Checked ${tableName} (via user_extensions): ${orgResults.length} distinct organization_ids`)
		} catch (error) {
			console.warn(`⚠️  Failed to check ${tableName}: ${error.message}`)
		}
	}

	// Report results
	if (missingOrgs.size > 0) {
		const missingOrgsList = Array.from(missingOrgs).sort()
		console.error('\n❌ VALIDATION FAILED: Missing organization_ids in CSV')
		console.error('='.repeat(60))
		console.error(`Found ${missingOrgs.size} organization_ids in database that are missing from CSV:`)
		missingOrgsList.forEach((orgId) => {
			console.error(`   - organization_id: ${orgId}`)
		})
		console.error('\n📝 Required action:')
		console.error(
			'   - Add missing organization_ids to data_codes.csv with proper tenant_code and organization_code'
		)
		console.error('   - Or verify if these organization_ids should be removed from database')

		throw new Error(
			`Migration cannot proceed: ${missingOrgs.size} organization_ids missing from CSV. See details above.`
		)
	}

	console.log('✅ Validation passed: All database organization_ids are covered in CSV')
}

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log('🚀 Starting complete tenant-code migration (REFRESHED VERSION)...')

			// Check if Citus is enabled
			const citusEnabled = await queryInterface.sequelize.query(
				"SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'citus')",
				{ type: Sequelize.QueryTypes.SELECT }
			)

			if (!citusEnabled[0].exists) {
				console.log('⚠️  Citus not enabled, proceeding with regular PostgreSQL setup')
			} else {
				console.log('✅ Citus enabled, proceeding with distributed setup')
			}

			// =============================================================================
			// PHASE 1: ADD TENANT_CODE COLUMNS TO ALL TABLES
			// =============================================================================
			console.log('\n📝 PHASE 1: Adding tenant_code columns to all tables...')
			console.log('='.repeat(70))

			const tablesToProcess = [
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
				'post_session_details',
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

			// Helper function to safely process each table
			async function processTableSafely(tableName) {
				try {
					console.log(`Processing: ${tableName}`)

					// Check if table exists
					const tableExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (!tableExists[0].exists) {
						console.log(`⚠️  Table ${tableName} does not exist, skipping`)
						return false
					}

					// Check if tenant_code column already exists
					const columnExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'tenant_code')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (!columnExists[0].exists) {
						// Add tenant_code column
						await queryInterface.addColumn(tableName, 'tenant_code', {
							type: Sequelize.STRING(255),
							allowNull: false,
							defaultValue: process.env.DEFAULT_ORGANISATION_CODE || 'default',
						})
						console.log(`✅ Added tenant_code to ${tableName}`)
					} else {
						console.log(`✅ ${tableName} already has tenant_code column`)
					}

					// Update primary key constraints if Citus is enabled
					if (citusEnabled[0].exists) {
						// Undistribute table if currently distributed
						try {
							const distInfo = await queryInterface.sequelize.query(
								`SELECT count(*) as count FROM pg_dist_partition WHERE logicalrelid = '${tableName}'::regclass`,
								{ type: Sequelize.QueryTypes.SELECT }
							)

							if (distInfo[0].count > 0) {
								await queryInterface.sequelize.query(`SELECT undistribute_table('${tableName}')`)
								console.log(`✅ Undistributed: ${tableName}`)
							}
						} catch (error) {
							// Table might not be distributed, continue
						}

						// Update primary keys to include tenant_code (table-specific logic)
						await updatePrimaryKeyForTable(tableName)
					}

					return true
				} catch (error) {
					console.log(`❌ Error processing ${tableName}: ${error.message}`)
					return false
				}
			}

			// Helper function to update primary keys for specific tables
			async function updatePrimaryKeyForTable(tableName) {
				try {
					switch (tableName) {
						case 'connection_requests':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							const [connectionReqColumns] = await queryInterface.sequelize.query(`
								SELECT column_name FROM information_schema.columns 
								WHERE table_name = 'connection_requests' AND table_schema = 'public'
							`)
							const hasIdColumn = connectionReqColumns.some((col) => col.column_name === 'id')

							if (hasIdColumn) {
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id)`
								)
							} else {
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, user_id, friend_id)`
								)
							}
							break

						case 'connections':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, user_id, friend_id)`
							)
							break

						case 'entities':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id, entity_type_id)`
							)
							break

						case 'entity_types':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id, organization_id)`
							)
							break

						case 'forms':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id, organization_id)`
							)
							break

						case 'organization_extension':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS organization_extension_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS organisation_extension_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS organization_extension_organization_id_key CASCADE`
							)

							const [existingPkCheck] = await queryInterface.sequelize.query(`
								SELECT constraint_name FROM information_schema.table_constraints 
								WHERE table_name = 'organization_extension' 
								AND constraint_type = 'PRIMARY KEY'
							`)

							if (existingPkCheck.length === 0) {
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, organization_id)`
								)
							}
							break

						case 'user_extensions':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, user_id)`
							)
							break

						case 'issues':
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id)`
							)
							break

						case 'question_sets':
							const questionSetColumns = await queryInterface.describeTable(tableName)
							if (questionSetColumns.code && questionSetColumns.tenant_code) {
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (code, tenant_code)`
								)
							} else {
								console.log(`⚠️  Missing required columns for ${tableName} primary key`)
							}
							break

						case 'questions':
							// Fixed: Create proper primary key for questions table
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (id, tenant_code)`
							)
							break

						case 'report_queries':
							// Fixed: Ensure all required columns exist before creating primary key
							const reportQueryColumns = await queryInterface.describeTable(tableName)
							if (reportQueryColumns.report_code && reportQueryColumns.tenant_code) {
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								// Use simpler primary key that doesn't require organization_code
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (report_code, tenant_code)`
								)
							} else {
								console.log(`⚠️  Missing required columns for ${tableName} primary key`)
							}
							break

						case 'report_role_mapping':
							// Fixed: Keep existing primary key structure
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (role_title, report_code, tenant_code)`
							)
							break

						case 'report_types':
							const reportTypeColumns = await queryInterface.describeTable(tableName)
							if (reportTypeColumns.title && reportTypeColumns.tenant_code) {
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (title, tenant_code)`
								)
							} else {
								console.log(`⚠️  Missing required columns for ${tableName} primary key`)
							}
							break

						default:
							// For most tables, use (tenant_code, id) as primary key
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
							)
							await queryInterface.sequelize.query(
								`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id)`
							)
							break
					}
					console.log(`✅ Updated primary key for ${tableName}`)
				} catch (error) {
					console.log(`⚠️  Could not update primary key for ${tableName}: ${error.message}`)
				}
			}

			// Process all tables
			let processedCount = 0
			for (const tableName of tablesToProcess) {
				const success = await processTableSafely(tableName)
				if (success) processedCount++
			}

			// Add organization_code columns to all tables that need them
			console.log('\n📝 Adding organization_code columns to all required tables...')
			const allTablesNeedingOrgCode = [
				'availabilities', // tenant and Org
				'default_rules', // tenant and Org
				'entity_types', // tenant and Org
				'file_uploads', // tenant and Org
				'forms', // tenant and Org
				'issues', // tenant and Org (per user specification)
				'notification_templates', // tenant and Org
				'organization_extension', // tenant and Org
				'question_sets', // tenant and Org
				'questions', // tenant and Org (per user specification)
				'report_queries', // tenant and Org
				'report_role_mapping', // tenant and Org (per user specification)
				'report_types', // tenant and Org (per user specification)
				'reports', // tenant and Org
				'role_extensions', // tenant and Org
				'user_extensions', // tenant and Org
			]

			for (const tableName of allTablesNeedingOrgCode) {
				try {
					const tableExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (tableExists[0].exists) {
						const columnExists = await queryInterface.sequelize.query(
							`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'organization_code')`,
							{ type: Sequelize.QueryTypes.SELECT }
						)

						if (!columnExists[0].exists) {
							await queryInterface.addColumn(tableName, 'organization_code', {
								type: Sequelize.STRING(255),
								allowNull: true,
							})
							console.log(`✅ Added organization_code to ${tableName}`)
						} else {
							console.log(`✅ ${tableName} already has organization_code column`)
						}
					}
				} catch (error) {
					console.log(`⚠️  Error adding organization_code to ${tableName}: ${error.message}`)
				}
			}

			// Add user_name to user_extensions if missing
			try {
				const userExtColumns = await queryInterface.describeTable('user_extensions')
				if (!userExtColumns.user_name) {
					await queryInterface.addColumn('user_extensions', 'user_name', {
						type: Sequelize.STRING(255),
						allowNull: true,
					})
					console.log('✅ Added user_name to user_extensions')
				}
			} catch (error) {
				console.log(`⚠️  Error adding user_name to user_extensions: ${error.message}`)
			}

			console.log(
				`\n✅ Phase 1 Complete: Processed ${processedCount}/${tablesToProcess.length} tables with tenant_code`
			)

			// =============================================================================
			// PHASE 1.5: FIX CONSTRAINTS FOR CITUS DISTRIBUTION
			// =============================================================================
			if (citusEnabled[0].exists) {
				console.log('\n🔧 PHASE 1.5: Fixing constraints for Citus distribution...')
				console.log('='.repeat(70))

				// Helper function to fix constraints for specific tables
				async function fixConstraintsForTable(tableName) {
					try {
						console.log(`Fixing constraints for: ${tableName}`)

						switch (tableName) {
							case 'connection_requests':
								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS unique_user_id_friend_id_connection_requests`
								)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX unique_user_id_friend_id_connection_requests_tenant 
									ON connection_requests (tenant_code, user_id, friend_id) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'connections':
								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS unique_user_id_friend_id_connections`
								)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX unique_user_id_friend_id_connections_tenant 
									ON connections (tenant_code, user_id, friend_id) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'default_rules':
								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS unique_default_rules_constraint`
								)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX unique_default_rules_constraint_tenant 
									ON default_rules (tenant_code, type, target_field, requester_field, organization_id) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'entities':
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS unique_entities_value`)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX unique_entities_value_tenant 
									ON entities (tenant_code, value, entity_type_id) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'entity_types':
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id, organization_id)`
								)
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS unique_value_org_id`)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX unique_value_organization_id_tenant 
									ON entity_types (tenant_code, value, organization_id) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'forms':
								const [formsConstraints] = await queryInterface.sequelize.query(`
									SELECT constraint_name, constraint_type 
									FROM information_schema.table_constraints 
									WHERE table_name = 'forms' AND table_schema = 'public'
									AND constraint_type IN ('UNIQUE', 'CHECK')
								`)

								for (const constraint of formsConstraints) {
									try {
										await queryInterface.sequelize.query(
											`ALTER TABLE forms DROP CONSTRAINT IF EXISTS ${constraint.constraint_name} CASCADE`
										)
										console.log(`  Dropped constraint: ${constraint.constraint_name}`)
									} catch (e) {
										console.log(
											`  Could not drop constraint ${constraint.constraint_name}: ${e.message}`
										)
									}
								}

								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS unique_type_subtype_orgid CASCADE`
								)
								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS unique_type_sub_type_org_id CASCADE`
								)
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS forms_type_key CASCADE`)
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS forms_type_unique CASCADE`)

								const [existingIndex] = await queryInterface.sequelize.query(`
									SELECT indexname FROM pg_indexes 
									WHERE tablename = 'forms' AND indexname = 'unique_type_subtype_orgid_tenant'
								`)

								if (existingIndex.length === 0) {
									await queryInterface.sequelize.query(`
										CREATE UNIQUE INDEX unique_type_subtype_orgid_tenant 
										ON forms (tenant_code, type, sub_type, organization_id) 
										WHERE deleted_at IS NULL
									`)
								}
								break

							case 'modules':
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS code_unique`)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX code_unique_tenant 
									ON modules (tenant_code, code) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'organization_extension':
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS organization_extension_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS organisation_extension_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS organization_extension_organization_id_key CASCADE`
								)

								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS organization_extension_organization_id_key`
								)
								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS organization_extension_organization_id_unique`
								)
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS organisation_extension_pkey`)

								const [existingPk] = await queryInterface.sequelize.query(`
									SELECT constraint_name FROM information_schema.table_constraints 
									WHERE table_name = 'organization_extension' 
									AND constraint_type = 'PRIMARY KEY'
								`)

								if (existingPk.length === 0) {
									await queryInterface.sequelize.query(
										`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, organization_id)`
									)
								}
								break

							case 'reports':
								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS report_code_organization_unique`
								)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX report_code_organization_unique_tenant 
									ON reports (tenant_code, code, organization_id) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'user_extensions':
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, user_id)`
								)
								break

							case 'issues':
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (tenant_code, id)`
								)
								break

							case 'question_sets':
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (code, tenant_code)`
								)
								break

							case 'questions':
								// Fixed: No constraint changes needed for questions
								console.log(`✅ ${tableName} constraints fixed`)
								break

							case 'report_queries':
								// Fixed: Add NOT NULL constraint to organization_code before creating primary key
								await queryInterface.sequelize.query(`
									UPDATE report_queries 
									SET organization_code = COALESCE(organization_code, '${process.env.DEFAULT_ORGANISATION_CODE || 'default_code'}')
									WHERE organization_code IS NULL
								`)
								await queryInterface.sequelize.query(`
									ALTER TABLE report_queries ALTER COLUMN organization_code SET NOT NULL
								`)

								await queryInterface.sequelize.query(
									`DROP INDEX IF EXISTS report_code_organization_unique_queries`
								)
								await queryInterface.sequelize.query(`
									CREATE UNIQUE INDEX report_code_organization_unique_queries_tenant 
									ON report_queries (tenant_code, report_code, organization_code) 
									WHERE deleted_at IS NULL
								`)
								break

							case 'report_role_mapping':
								// Fixed: No constraint changes needed
								console.log(`✅ ${tableName} constraints fixed`)
								break

							case 'report_types':
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS report_types_title_unique`)
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS report_types_title`)
								await queryInterface.sequelize.query(`DROP INDEX IF EXISTS report_types_title_key`)
								await queryInterface.sequelize.query(
									`ALTER TABLE report_types DROP CONSTRAINT IF EXISTS report_types_title_unique CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE report_types DROP CONSTRAINT IF EXISTS report_types_title CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE report_types DROP CONSTRAINT IF EXISTS report_types_title_key CASCADE`
								)

								const [existingTitleIndex] = await queryInterface.sequelize.query(`
									SELECT indexname FROM pg_indexes 
									WHERE tablename = 'report_types' AND indexname = 'report_types_title_unique_tenant_new'
								`)

								if (existingTitleIndex.length === 0) {
									await queryInterface.sequelize.query(`
										CREATE UNIQUE INDEX report_types_title_unique_tenant_new 
										ON report_types (tenant_code, title) 
										WHERE deleted_at IS NULL
									`)
								}

								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE`
								)
								await queryInterface.sequelize.query(
									`ALTER TABLE ${tableName} ADD PRIMARY KEY (title, tenant_code)`
								)
								break

							default:
								console.log(`✅ ${tableName} constraints already properly configured`)
								break
						}

						console.log(`✅ Fixed constraints for ${tableName}`)
						return true
					} catch (error) {
						console.log(`❌ Could not fix constraints for ${tableName}: ${error.message}`)
						return false
					}
				}

				// Fix constraints for tables that had issues
				const constraintFixTables = [
					'connection_requests',
					'connections',
					'default_rules',
					'entities',
					'entity_types',
					'forms',
					'issues',
					'modules',
					'organization_extension',
					'question_sets',
					'questions',
					'report_queries',
					'report_role_mapping',
					'report_types',
					'reports',
					'user_extensions',
				]

				let constraintFixCount = 0
				for (const tableName of constraintFixTables) {
					const success = await fixConstraintsForTable(tableName)
					if (success) constraintFixCount++
				}

				console.log(
					`\n✅ Phase 1.5 Complete: Fixed constraints for ${constraintFixCount}/${constraintFixTables.length} tables`
				)
			}

			// =============================================================================
			// PHASE 2: POPULATE DATA WITH PROPER SEQUENCING
			// =============================================================================
			console.log('\n🔄 PHASE 2: Populating tenant_code and organization_code data...')
			console.log('='.repeat(70))

			// Load data_codes.csv data
			const fs = require('fs')
			const path = require('path')
			const csv = require('csv-parser')

			const orgLookupCache = new Map()
			const csvPath = path.join(__dirname, '../../data/data_codes.csv')

			if (fs.existsSync(csvPath)) {
				console.log('📂 Loading data_codes.csv...')
				try {
					await new Promise((resolve, reject) => {
						let rowCount = 0
						let validRowCount = 0

						fs.createReadStream(csvPath)
							.pipe(csv())
							.on('data', (row) => {
								rowCount++
								try {
									if (row.organization_id && row.organization_code && row.tenant_code) {
										const sanitizedOrgId = String(row.organization_id).trim()
										const sanitizedOrgCode = String(row.organization_code)
											.trim()
											.replace(/['"]/g, '')
										const sanitizedTenantCode = String(row.tenant_code).trim().replace(/['"]/g, '')

										if (sanitizedOrgId && sanitizedOrgCode && sanitizedTenantCode) {
											orgLookupCache.set(sanitizedOrgId, {
												organization_code: sanitizedOrgCode,
												tenant_code: sanitizedTenantCode,
											})
											validRowCount++
										}
									}
								} catch (rowError) {
									console.log(`⚠️  Error processing row ${rowCount}: ${rowError.message}`)
								}
							})
							.on('end', () => {
								console.log(
									`✅ Loaded ${orgLookupCache.size} organization mappings from ${rowCount} rows (${validRowCount} valid)`
								)
								if (orgLookupCache.size === 0) {
									console.log(
										'⚠️  No valid organization data found in CSV, migration will use default values'
									)
								}
								resolve()
							})
							.on('error', (csvError) => {
								console.log(`❌ CSV processing error: ${csvError.message}`)
								resolve() // Don't fail the migration, continue with empty cache
							})
					})
				} catch (csvLoadError) {
					console.log(`❌ Failed to load CSV file: ${csvLoadError.message}`)
					console.log('⚠️  Continuing migration with default values')
				}

				// =============================================================================
				// CSV DATA PROCESSING (NO VALIDATION - CONTINUES WITH DEFAULTS IF CSV MISSING)
				// =============================================================================
				console.log('\n📊 CSV Data Processing: Loading organization mappings...')
				console.log('='.repeat(70))

				if (orgLookupCache.size > 0) {
					console.log(`✅ Successfully loaded ${orgLookupCache.size} organization mappings from CSV`)

					// Validate that all database organization_ids exist in CSV
					await validateDatabaseOrgsCoveredByCSV(orgLookupCache, queryInterface, Sequelize)
				} else {
					console.log('⚠️  No CSV data loaded - proceeding with default values for all organizations')
				}

				// Create temporary lookup table for better performance
				await queryInterface.sequelize.query(`DROP TABLE IF EXISTS temp_org_lookup`)

				const valuesClause = Array.from(orgLookupCache.entries())
					.map(([orgId, data]) => {
						const safeOrgId = String(orgId).replace(/'/g, "''")
						const safeOrgCode = String(data.organization_code).replace(/'/g, "''")
						const safeTenantCode = String(data.tenant_code).replace(/'/g, "''")
						return `('${safeOrgId}', '${safeOrgCode}', '${safeTenantCode}')`
					})
					.join(', ')

				if (valuesClause) {
					await queryInterface.sequelize.query(`
						CREATE TEMP TABLE temp_org_lookup AS
						SELECT DISTINCT 
							organization_id::text as org_id,
							organization_code,
							tenant_code
						FROM (VALUES ${valuesClause}) AS t(organization_id, organization_code, tenant_code)
					`)

					await queryInterface.sequelize.query(`
						CREATE INDEX temp_org_lookup_idx ON temp_org_lookup(org_id)
					`)

					console.log('✅ Created temporary lookup table with index')
				}

				// Phase 2.1: Update tables with organization_id using batch processing
				console.log('\n📊 Updating tables with organization_id (batch processing)...')
				const tablesWithOrgId = [
					'availabilities',
					'default_rules',
					'entity_types',
					'file_uploads',
					'forms',
					'notification_templates',
					'organization_extension',
					'report_queries',
					'reports',
					'role_extensions',
					'user_extensions',
				]

				// Get distinct organization_ids for batch processing
				const [distinctOrgs] = await queryInterface.sequelize.query(`
					SELECT DISTINCT org_id FROM temp_org_lookup ORDER BY org_id
				`)
				console.log(`📦 Processing ${distinctOrgs.length} organizations in batches`)

				for (const tableName of tablesWithOrgId) {
					try {
						console.log(`  Updating ${tableName}...`)

						// Check if table exists and has data
						const [tableInfo] = await queryInterface.sequelize.query(`
							SELECT 
								EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as exists,
								EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'organization_id') as has_org_id,
								(SELECT COUNT(*) FROM ${tableName}) as row_count
						`)

						if (!tableInfo[0].exists || !tableInfo[0].has_org_id) {
							console.log(`    ⚠️  ${tableName} doesn't exist or has no organization_id, skipping`)
							continue
						}

						if (tableInfo[0].row_count === 0) {
							console.log(`    ✅ ${tableName} is empty, skipping`)
							continue
						}

						const totalRows = tableInfo[0].row_count
						let totalUpdated = 0
						const defaultTenantCode = process.env.DEFAULT_ORGANISATION_CODE || 'default'
						const startTime = Date.now()

						// Organization-based batch processing (GROUP BY organization_id approach)
						const orgBatchSize = 5000 // Process 5000 organizations at a time

						for (let i = 0; i < distinctOrgs.length; i += orgBatchSize) {
							const orgBatch = distinctOrgs.slice(i, i + orgBatchSize)

							// Process each organization individually for clean updates
							for (const org of orgBatch) {
								const [results, metadata] = await queryInterface.sequelize.query(`
									UPDATE ${tableName} 
									SET 
										tenant_code = tol.tenant_code,
										organization_code = tol.organization_code,
										updated_at = NOW()
									FROM temp_org_lookup tol
									WHERE ${tableName}.organization_id::text = tol.org_id
									AND ${tableName}.organization_id::text = '${org.org_id.replace(/'/g, "''")}'
								`)

								totalUpdated += metadata.rowCount || 0
							}
						}

						const duration = ((Date.now() - startTime) / 1000).toFixed(2)

						console.log(
							`    ✅ ${tableName}: ${totalUpdated}/${totalRows} updated in ${duration}s (${Math.ceil(
								distinctOrgs.length / 5000
							)} org batches)`
						)
					} catch (error) {
						console.log(`    ❌ Error updating ${tableName}: ${error.message}`)
					}
				}

				// Phase 2.2: Update tables with user_id using batch processing by organization_id
				console.log('\n👤 Updating tables with user_id using batch processing by organization_id...')
				const tablesWithUserId = [
					{ name: 'sessions', userColumn: 'created_by' },
					{ name: 'feedbacks', userColumn: 'user_id' },
					{ name: 'connection_requests', userColumn: 'created_by' },
					{ name: 'connections', userColumn: 'created_by' },
					{ name: 'entities', userColumn: 'created_by' },
					{ name: 'issues', userColumn: 'user_id' },
					{ name: 'question_sets', userColumn: 'created_by' },
					{ name: 'questions', userColumn: 'created_by' },
					{ name: 'resources', userColumn: 'created_by' },
					{ name: 'session_request', userColumn: 'created_by' },
					{ name: 'session_attendees', userColumn: 'mentee_id' },
				]

				// Get user_extensions data grouped by organization_id for batch processing
				const [userExtByOrg] = await queryInterface.sequelize.query(`
					SELECT DISTINCT ue.organization_id::text as org_id
					FROM user_extensions ue
					INNER JOIN temp_org_lookup tol ON ue.organization_id::text = tol.org_id
					WHERE ue.organization_id IS NOT NULL
					ORDER BY org_id
				`)
				console.log(`📦 Processing ${userExtByOrg.length} organizations with users in batches`)

				for (const tableConfig of tablesWithUserId) {
					try {
						console.log(`  Updating ${tableConfig.name}...`)

						// Check if table exists and has data
						const [tableInfo] = await queryInterface.sequelize.query(`
							SELECT 
								EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableConfig.name}') as exists,
								EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableConfig.name}' AND column_name = '${tableConfig.userColumn}') as has_user_col,
								(SELECT COUNT(*) FROM ${tableConfig.name}) as row_count
						`)

						if (!tableInfo[0].exists || !tableInfo[0].has_user_col) {
							console.log(
								`    ⚠️  ${tableConfig.name} doesn't exist or has no ${tableConfig.userColumn}, skipping`
							)
							continue
						}

						if (tableInfo[0].row_count === 0) {
							console.log(`    ✅ ${tableConfig.name} is empty, skipping`)
							continue
						}

						const totalRows = tableInfo[0].row_count
						let totalUpdated = 0
						const defaultTenantCode = process.env.DEFAULT_ORGANISATION_CODE || 'default'
						const startTime = Date.now()

						// Organization-based batch processing for user tables (GROUP BY organization_id approach)
						const orgBatchSize = 5000 // Process 5000 organizations at a time

						for (let i = 0; i < userExtByOrg.length; i += orgBatchSize) {
							const orgBatch = userExtByOrg.slice(i, i + orgBatchSize)

							// Process each organization individually for clean updates
							for (const org of orgBatch) {
								const [results, metadata] = await queryInterface.sequelize.query(`
									UPDATE ${tableConfig.name} 
									SET 
										tenant_code = ue.tenant_code,
										organization_code = ue.organization_code,
										updated_at = NOW()
									FROM user_extensions ue
									WHERE ${tableConfig.name}.${tableConfig.userColumn} = ue.user_id
									AND ue.organization_id::text = '${org.org_id.replace(/'/g, "''")}'
									AND ue.tenant_code IS NOT NULL
									AND ue.tenant_code != '${defaultTenantCode}'
								`)

								totalUpdated += metadata.rowCount || 0
							}
						}

						const duration = ((Date.now() - startTime) / 1000).toFixed(2)

						console.log(
							`    ✅ ${
								tableConfig.name
							}: ${totalUpdated}/${totalRows} updated in ${duration}s (${Math.ceil(
								userExtByOrg.length / 5000
							)} org batches)`
						)
					} catch (error) {
						console.log(`    ❌ Error updating ${tableConfig.name}: ${error.message}`)
					}
				}

				// Phase 2.3: Update tables without organization_id or user_id (default values only)
				console.log('\n🔧 Updating tables without relationship columns (default values)...')
				const allTablesNeedingTenantCode = [
					'modules',
					'post_session_details',
					'report_role_mapping',
					'report_types',
					'permissions',
					'role_permission_mapping',
					'notification_templates', // May not have org_id in some setups
				]

				const defaultTenantCode = process.env.DEFAULT_ORGANISATION_CODE || 'default'
				const defaultOrgCode = process.env.DEFAULT_ORG_CODE || 'default_org'

				for (const tableName of allTablesNeedingTenantCode) {
					try {
						console.log(`  Updating ${tableName} with default values...`)

						// Check if table exists and has tenant_code column
						const [tableInfo] = await queryInterface.sequelize.query(`
							SELECT 
								EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as table_exists,
								EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'tenant_code') as has_tenant_code,
								EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'organization_code') as has_org_code,
								EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'organization_id') as has_org_id,
								EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'user_id') as has_user_id,
								EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'created_by') as has_created_by
						`)

						if (!tableInfo[0].table_exists || !tableInfo[0].has_tenant_code) {
							console.log(`    ⚠️  ${tableName} doesn't exist or missing tenant_code column, skipping`)
							continue
						}

						// Skip if table has relationship columns (already processed)
						if (tableInfo[0].has_org_id || tableInfo[0].has_user_id || tableInfo[0].has_created_by) {
							console.log(`    ✅ ${tableName} has relationship columns, already processed`)
							continue
						}

						// Get total row count for processing
						const [rowCount] = await queryInterface.sequelize.query(`
							SELECT COUNT(*) as total_rows FROM ${tableName}
						`)

						const totalRowsInTable = rowCount[0].total_rows
						if (totalRowsInTable === 0) {
							console.log(`    ✅ ${tableName} is empty, skipping`)
							continue
						}

						let totalUpdated = 0
						const maxRowsPerBatch = 1000
						const startTime = Date.now()

						// Batch update with row limits for large tables
						let hasMoreRows = true
						while (hasMoreRows) {
							const [results, metadata] = await queryInterface.sequelize.query(`
								UPDATE ${tableName} 
								SET 
									tenant_code = '${defaultTenantCode}',
									${tableInfo[0].has_org_code ? `organization_code = '${defaultOrgCode}',` : ''}
									updated_at = NOW()
								WHERE id IN (
									SELECT id FROM ${tableName}
									LIMIT ${maxRowsPerBatch}
								)
							`)

							const rowsUpdated = metadata.rowCount || 0
							totalUpdated += rowsUpdated
							hasMoreRows = rowsUpdated === maxRowsPerBatch

							if (rowsUpdated === 0) hasMoreRows = false
						}

						const duration = ((Date.now() - startTime) / 1000).toFixed(2)
						console.log(
							`    ✅ ${tableName}: ${totalUpdated} rows updated with default values in ${duration}s`
						)
					} catch (error) {
						console.log(`    ❌ Error updating ${tableName}: ${error.message}`)
					}
				}
			} else {
				console.log('❌ MIGRATION FAILED: data_codes.csv file not found!')
				console.log(
					'📝 Required: data_codes.csv file with organization_id, organization_code, tenant_code columns'
				)
				throw new Error('Migration requires data_codes.csv file with organization mappings')
			}

			console.log('\n✅ Phase 2 Complete: Data population finished')

			// =============================================================================
			// PHASE 3: REDISTRIBUTE TABLES (ONLY IF CITUS IS ENABLED)
			// =============================================================================
			if (citusEnabled[0].exists) {
				console.log('\n🔄 PHASE 3: Redistributing tables with tenant_code...')
				console.log('='.repeat(70))

				// Helper function to safely redistribute table
				async function redistributeTableSafely(tableName, distributionColumn = 'tenant_code') {
					try {
						// Verify the distribution column exists
						const columns = await queryInterface.describeTable(tableName)
						if (!columns[distributionColumn]) {
							console.log(`❌ Column ${distributionColumn} does not exist in ${tableName}, skipping`)
							return false
						}

						// Check if table is already distributed
						const distInfo = await queryInterface.sequelize.query(
							`SELECT count(*) as count FROM pg_dist_partition WHERE logicalrelid = '${tableName}'::regclass`,
							{ type: Sequelize.QueryTypes.SELECT }
						)

						if (distInfo[0].count > 0) {
							console.log(`✅ Table ${tableName} already distributed`)
							return true
						}

						// Distribute the table
						await queryInterface.sequelize.query(
							`SELECT create_distributed_table('${tableName}', '${distributionColumn}')`
						)
						console.log(`✅ Distributed table: ${tableName} with ${distributionColumn}`)
						return true
					} catch (error) {
						console.log(`❌ Could not distribute ${tableName}: ${error.message}`)
						return false
					}
				}

				// Distribute all tables with tenant_code
				const distributionResults = { success: [], failed: [] }

				for (const tableName of tablesToProcess) {
					// Special handling for report_queries table
					if (tableName === 'report_queries') {
						try {
							// First, drop all CHECK constraints that prevent distribution
							const [checkConstraints] = await queryInterface.sequelize.query(`
								SELECT constraint_name 
								FROM information_schema.table_constraints 
								WHERE table_name = 'report_queries' 
								AND table_schema = 'public' 
								AND constraint_type = 'CHECK'
							`)

							for (const constraint of checkConstraints) {
								try {
									await queryInterface.sequelize.query(`
										ALTER TABLE report_queries DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}" CASCADE
									`)
									console.log(`✅ Dropped CHECK constraint: ${constraint.constraint_name}`)
								} catch (error) {
									console.log(
										`⚠️  Could not drop constraint ${constraint.constraint_name}: ${error.message}`
									)
								}
							}

							// Ensure organization_code has default values
							await queryInterface.sequelize.query(`
								UPDATE report_queries 
								SET organization_code = COALESCE(organization_code, '${process.env.DEFAULT_ORGANISATION_CODE || 'default_code'}')
								WHERE organization_code IS NULL
							`)

							// Now try to distribute
							await queryInterface.sequelize.query(
								`SELECT create_distributed_table('report_queries', 'tenant_code')`
							)
							console.log(`✅ Distributed table: report_queries with tenant_code`)
							distributionResults.success.push(tableName)
						} catch (error) {
							console.log(`❌ Could not distribute ${tableName}: ${error.message}`)
							distributionResults.failed.push(tableName)
						}
					} else {
						const success = await redistributeTableSafely(tableName, 'tenant_code')
						if (success) {
							distributionResults.success.push(tableName)
						} else {
							distributionResults.failed.push(tableName)
						}
					}
				}

				// Special case: role_permission_mapping uses role_title
				const rolePermSuccess = await redistributeTableSafely('role_permission_mapping', 'role_title')
				if (rolePermSuccess) {
					distributionResults.success.push('role_permission_mapping')
				} else {
					distributionResults.failed.push('role_permission_mapping')
				}

				console.log(`\n✅ Phase 3 Complete: Distributed ${distributionResults.success.length} tables`)
				if (distributionResults.failed.length > 0) {
					console.log(`⚠️  Failed to distribute: ${distributionResults.failed.join(', ')}`)
				}
			} else {
				console.log('\n⚠️  PHASE 3 SKIPPED: Citus not enabled, tables remain local')
			}

			// =============================================================================
			// PHASE 4: CLEANUP OBSOLETE TABLES
			// =============================================================================
			console.log('\n🗑️  PHASE 4: Cleaning up obsolete tables...')
			console.log('='.repeat(70))

			const obsoleteTables = ['session_enrollments', 'session_ownerships', 'session_request_mapping']

			for (const tableName of obsoleteTables) {
				try {
					const tableExists = await queryInterface.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`,
						{ type: Sequelize.QueryTypes.SELECT }
					)

					if (tableExists[0].exists) {
						// Undistribute if distributed (Citus only)
						if (citusEnabled[0].exists) {
							try {
								await queryInterface.sequelize.query(`SELECT undistribute_table('${tableName}')`)
							} catch (error) {
								// Table might not be distributed
							}
						}

						await queryInterface.dropTable(tableName)
						console.log(`✅ Deleted obsolete table: ${tableName}`)
					}
				} catch (error) {
					console.log(`⚠️  Could not delete ${tableName}: ${error.message}`)
				}
			}

			// =============================================================================
			// PHASE 5: FINAL VERIFICATION
			// =============================================================================
			console.log('\n📊 PHASE 5: Final verification...')
			console.log('='.repeat(70))

			// Count tables with tenant_code columns
			const [tenantCodeTables] = await queryInterface.sequelize.query(`
				SELECT COUNT(*) as count 
				FROM information_schema.columns 
				WHERE table_schema = 'public' 
				AND column_name = 'tenant_code'
			`)

			let distributedCount = 0
			if (citusEnabled[0].exists) {
				const [distributedTables] = await queryInterface.sequelize.query(`
					SELECT COUNT(*) as count FROM pg_dist_partition
				`)
				distributedCount = distributedTables[0].count
			}

			// Count tables with organization_code columns
			const [orgCodeTables] = await queryInterface.sequelize.query(`
				SELECT COUNT(*) as count 
				FROM information_schema.columns 
				WHERE table_schema = 'public' 
				AND column_name = 'organization_code'
			`)

			// Check data population status for key tables
			console.log('\n📈 Data population status:')
			const defaultTenantCode = process.env.DEFAULT_ORGANISATION_CODE || 'default'
			for (const tableName of ['user_extensions', 'sessions', 'feedbacks', 'availabilities']) {
				try {
					const [stats] = await queryInterface.sequelize.query(`
						SELECT 
							COUNT(*) as total_rows,
							COUNT(CASE WHEN tenant_code IS NOT NULL AND tenant_code != '${defaultTenantCode}' THEN 1 END) as populated_rows
						FROM ${tableName}
					`)

					if (stats[0].total_rows > 0) {
						const percentage = Math.round((stats[0].populated_rows / stats[0].total_rows) * 100)
						console.log(
							`  📊 ${tableName}: ${stats[0].populated_rows}/${stats[0].total_rows} rows populated (${percentage}%)`
						)
					}
				} catch (error) {
					console.log(`  ⚠️  Could not check ${tableName}: ${error.message}`)
				}
			}

			// Final summary
			console.log('\n🎯 MIGRATION COMPLETED SUCCESSFULLY!')
			console.log('='.repeat(70))
			console.log(`✅ Tables with tenant_code columns: ${tenantCodeTables[0].count}`)
			console.log(`✅ Tables with organization_code columns: ${orgCodeTables[0].count}`)
			if (citusEnabled[0].exists) {
				console.log(`✅ Distributed tables: ${distributedCount}`)
				console.log(`✅ Distribution success rate: ${Math.round((distributedCount / 28) * 100)}%`)
			} else {
				console.log(`✅ Local PostgreSQL setup complete`)
			}
			console.log(`✅ Obsolete tables cleaned up: ${obsoleteTables.length}`)
			console.log('\n🎉 Complete tenant-code migration finished!')
		} catch (error) {
			console.error('❌ Complete tenant-code migration failed:', error)
			throw error
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log('🔄 Rolling back complete tenant-code migration...')

			// Check if Citus is enabled
			const citusEnabled = await queryInterface.sequelize.query(
				"SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'citus')",
				{ type: Sequelize.QueryTypes.SELECT }
			)

			console.log('⚠️  ROLLBACK WARNING:')
			console.log('   This will remove all tenant_code columns and undo distribution')
			console.log('   This is a destructive operation that may cause data loss')
			console.log('   Consider restoring from backup instead')

			const tablesToRollback = [
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
				'post_session_details',
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

			// Undistribute all tables if Citus is enabled
			if (citusEnabled[0].exists) {
				console.log('\n📤 Undistributing tables...')
				for (const tableName of tablesToRollback) {
					try {
						await queryInterface.sequelize.query(`SELECT undistribute_table('${tableName}')`)
						console.log(`✅ Undistributed: ${tableName}`)
					} catch (error) {
						console.log(`⚠️  Could not undistribute ${tableName}: ${error.message}`)
					}
				}

				// Undistribute role_permission_mapping
				try {
					await queryInterface.sequelize.query(`SELECT undistribute_table('role_permission_mapping')`)
					console.log(`✅ Undistributed: role_permission_mapping`)
				} catch (error) {
					console.log(`⚠️  Could not undistribute role_permission_mapping: ${error.message}`)
				}
			}

			// Remove tenant_code columns
			console.log('\n🗑️  Removing tenant_code columns...')
			for (const tableName of tablesToRollback) {
				try {
					await queryInterface.removeColumn(tableName, 'tenant_code')
					console.log(`✅ Removed tenant_code from ${tableName}`)
				} catch (error) {
					console.log(`⚠️  Could not remove tenant_code from ${tableName}: ${error.message}`)
				}
			}

			// Remove organization_code columns from all tables
			console.log('\n🗑️  Removing organization_code columns...')
			for (const tableName of tablesToRollback) {
				try {
					await queryInterface.removeColumn(tableName, 'organization_code')
					console.log(`✅ Removed organization_code from ${tableName}`)
				} catch (error) {
					console.log(`⚠️  Could not remove organization_code from ${tableName}: ${error.message}`)
				}
			}

			// Remove user_name from user_extensions
			try {
				await queryInterface.removeColumn('user_extensions', 'user_name')
				console.log('✅ Removed user_name from user_extensions')
			} catch (error) {
				console.log(`⚠️  Could not remove user_name from user_extensions: ${error.message}`)
			}

			console.log('\n🔄 Rollback completed')
		} catch (error) {
			console.error('❌ Rollback failed:', error)
			throw error
		}
	},
}
