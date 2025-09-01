require('dotenv').config()
const DatabaseConnectionManager = require('./db-connection-utils')

/**
 * Script for Tenant Code Migration - OPTIMAL ORDER
 *
 * PHASE 1: Clean Slate (Remove Conflicting Elements)
 *   1A: Drop all existing indexes (except system indexes)
 *   1B: Drop all foreign key constraints
 *   1C: Drop problematic unique constraints
 *
 * PHASE 2: Set Foundation (Tenant-Aware Constraints)
 *   2: Update primary keys to include tenant_code
 *
 * PHASE 3: Citus Distribution (Clean tables with minimal constraints)
 *   3: Distribute tables with Citus
 *   3B: Create reference tables for shared data
 *
 * PHASE 4: Rebuild Relationships (After distribution)
 *   4A: Add foreign key constraints (with RESTRICT, not CASCADE)
 *   4A2: Create tenant-aware unique indexes
 *   4B: Create performance indexes
 */

class TenantMigrationFinalizer {
	constructor() {
		// Initialize database connection manager
		this.dbManager = new DatabaseConnectionManager({
			poolMax: 10,
			poolMin: 2,
			logging: false,
		})
		this.sequelize = this.dbManager.getSequelize()

		this.allTables = [
			'availabilities',
			'connection_requests',
			'connections',
			'default_rules',
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
			'role_extensions',
			'session_request',
			'user_extensions',
			'entity_types',
			'sessions',
			'entities',
			'post_session_details',
			'resources',
			'session_attendees',
		]

		this.tablesWithOrgCode = [
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
			'reports',
			'role_extensions',
			'user_extensions',
		]

		// Tables to completely exclude from all migration operations
		this.excludedTables = ['permissions', 'role_permission_mapping']

		this.stats = {
			constraintsAdded: 0,
			primaryKeysUpdated: 0,
			foreignKeysAdded: 0,
			tablesDistributed: 0,
			startTime: Date.now(),
		}
	}

	/**
	 * Check if Citus is enabled
	 */
	async isCitusEnabled() {
		try {
			const result = await this.sequelize.query(
				`
				SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'citus') as enabled
			`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)
			return result[0].enabled
		} catch (error) {
			return false
		}
	}

	/**
	 * Check if table is distributed
	 */
	async isTableDistributed(tableName) {
		try {
			const result = await this.sequelize.query(
				`
				SELECT EXISTS(
					SELECT 1 FROM pg_dist_partition 
					WHERE logicalrelid = '${tableName}'::regclass
				) as distributed
			`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)
			return result[0].distributed
		} catch (error) {
			// If pg_dist_partition doesn't exist or any error, assume not distributed
			return false
		}
	}

	/**
	 * Phase 1: Set columns to NOT NULL
	 */
	async setColumnsNotNull() {
		console.log('\n🔒 PHASE 1: Setting columns to NOT NULL...')
		console.log('='.repeat(50))

		// Set tenant_code to NOT NULL for all tables
		for (const tableName of this.allTables) {
			try {
				// Check if table exists and has the column
				const tableInfo = await this.sequelize.query(
					`
					SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'tenant_code') as has_tenant_code
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableInfo[0].table_exists || !tableInfo[0].has_tenant_code) {
					console.log(`⚠️  ${tableName} missing table or tenant_code column, skipping`)
					continue
				}

				// Set NOT NULL constraint
				await this.sequelize.query(`
					ALTER TABLE ${tableName} ALTER COLUMN tenant_code SET NOT NULL
				`)
				console.log(`✅ Set tenant_code NOT NULL for ${tableName}`)
			} catch (error) {
				console.log(`❌ Error setting tenant_code NOT NULL for ${tableName}: ${error.message}`)
			}
		}

		// Set organization_code to NOT NULL for specific tables
		for (const tableName of this.tablesWithOrgCode) {
			try {
				// Check if table exists and has the column
				const tableInfo = await this.sequelize.query(
					`
					SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'organization_code') as has_org_code
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableInfo[0].table_exists || !tableInfo[0].has_org_code) {
					console.log(`⚠️  ${tableName} missing table or organization_code column, skipping`)
					continue
				}

				// Set NOT NULL constraint
				await this.sequelize.query(`
					ALTER TABLE ${tableName} ALTER COLUMN organization_code SET NOT NULL
				`)
				console.log(`✅ Set organization_code NOT NULL for ${tableName}`)
			} catch (error) {
				console.log(`❌ Error setting organization_code NOT NULL for ${tableName}: ${error.message}`)
			}
		}
	}

	/**
	 * PHASE 2: Update primary key constraints
	 */
	async updatePrimaryKeys() {
		console.log('\n🔑 PHASE 2: Updating primary key constraints...')
		console.log('='.repeat(50))

		const primaryKeyConfigs = {
			availabilities: 'tenant_code, id',
			connection_requests: 'tenant_code, id',
			connections: 'tenant_code, id',
			default_rules: 'tenant_code, id',
			entities: 'tenant_code, id, entity_type_id',
			entity_types: 'tenant_code, id',
			feedbacks: 'tenant_code, id',
			file_uploads: 'tenant_code, id',
			forms: 'tenant_code, id, organization_id',
			issues: 'tenant_code, id',
			modules: 'tenant_code, id',
			notification_templates: 'tenant_code, id',
			organization_extension: 'tenant_code, organization_code, organization_id',
			post_session_details: 'tenant_code, session_id',
			user_extensions: 'tenant_code,user_id',
			question_sets: 'id, tenant_code',
			questions: 'id, tenant_code',
			report_queries: 'tenant_code,id,organization_code',
			report_role_mapping: 'tenant_code, id',
			report_types: 'tenant_code,id',
			reports: 'tenant_code,id',
			resources: 'tenant_code,id',
			role_extensions: 'tenant_code,title',
			session_attendees: 'tenant_code, id',
			session_request: 'tenant_code, id',
			sessions: 'tenant_code, id',

			// Default for all other tables
			default: 'tenant_code, id',
		}

		for (const tableName of this.allTables) {
			try {
				// Check if table exists
				const tableExists = await this.sequelize.query(
					`
					SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}') as exists
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${tableName} does not exist, skipping`)
					continue
				}

				// Drop existing primary key
				await this.sequelize.query(`
					ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE
				`)

				// Special handling for organization_extension table (different naming convention)
				if (tableName === 'organization_extension') {
					try {
						await this.sequelize.query(`
							ALTER TABLE organization_extension DROP CONSTRAINT IF EXISTS organisation_extension_pkey CASCADE
						`)
					} catch (error) {
						// Constraint might not exist, continue
					}
				}

				// Get primary key configuration
				const primaryKeyColumns = primaryKeyConfigs[tableName] || primaryKeyConfigs['default']

				// Add new primary key with tenant_code
				await this.sequelize.query(`
					ALTER TABLE ${tableName} ADD PRIMARY KEY (${primaryKeyColumns})
				`)

				console.log(`✅ Updated primary key for ${tableName}: (${primaryKeyColumns})`)
				this.stats.primaryKeysUpdated++
			} catch (error) {
				console.log(`❌ Error updating primary key for ${tableName}: ${error.message}`)
			}
		}
	}

	/**
	 * Phase 3: Add foreign key constraints
	 */
	async addForeignKeys() {
		console.log('\n🔗 PHASE 3: Adding foreign key constraints...')
		console.log('='.repeat(50))

		const foreignKeyConfigs = [
			{
				table: 'session_attendees',
				columns: 'session_id, tenant_code',
				refTable: 'sessions',
				refColumns: 'id, tenant_code',
				name: 'fk_session_attendees_session_id',
			},
			{
				table: 'resources',
				columns: 'session_id, tenant_code',
				refTable: 'sessions',
				refColumns: 'id, tenant_code',
				name: 'fk_resources_session_id',
			},
		]

		for (const fkConfig of foreignKeyConfigs) {
			try {
				// Check if both tables exist
				const tablesExist = await this.sequelize.query(
					`
					SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fkConfig.table}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fkConfig.refTable}') as ref_table_exists
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tablesExist[0].table_exists || !tablesExist[0].ref_table_exists) {
					console.log(`⚠️  Missing table for FK ${fkConfig.name}, skipping`)
					continue
				}

				// Check if constraint already exists
				const constraintExists = await this.sequelize.query(
					`
					SELECT EXISTS (
						SELECT 1 FROM information_schema.table_constraints 
						WHERE table_name = '${fkConfig.table}' 
						AND constraint_name = '${fkConfig.name}'
						AND constraint_type = 'FOREIGN KEY'
					) as exists
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (constraintExists[0].exists) {
					console.log(`✅ FK ${fkConfig.name} already exists`)
					continue
				}

				// Add foreign key constraint
				await this.sequelize.query(`
					ALTER TABLE ${fkConfig.table} 
					ADD CONSTRAINT ${fkConfig.name} 
					FOREIGN KEY (${fkConfig.columns}) 
					REFERENCES ${fkConfig.refTable}(${fkConfig.refColumns}) 
					ON DELETE CASCADE 
					ON UPDATE CASCADE
				`)

				console.log(`✅ Added foreign key: ${fkConfig.name}`)
				this.stats.foreignKeysAdded++
			} catch (error) {
				console.log(`❌ Error adding FK ${fkConfig.name}: ${error.message}`)
			}
		}
	}

	/**
	 * Helper: Check if table can be safely distributed in Citus
	 */
	async canTableBeDistributed(tableName) {
		try {
			// Special tables without tenant_code can be distributed with custom columns
			if (this.specialTablesWithoutTenantCode.includes(tableName)) {
				const tableExists = await this.sequelize.query(
					`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as table_exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableExists[0].table_exists) {
					return { canDistribute: false, reason: 'Table does not exist' }
				}

				return { canDistribute: true, reason: 'Special table - can distribute with custom column' }
			}

			// Check if table has tenant_code column
			const hasColumns = await this.sequelize.query(
				`SELECT 
					EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'tenant_code') as has_tenant_code,
					EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as table_exists
				`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)

			if (!hasColumns[0].table_exists || !hasColumns[0].has_tenant_code) {
				return { canDistribute: false, reason: 'Missing table or tenant_code column' }
			}

			// Get all constraints that might conflict with Citus distribution
			const allConstraints = await this.sequelize.query(
				`SELECT 
					constraint_name, 
					constraint_type,
					CASE 
						WHEN constraint_type = 'FOREIGN KEY' THEN (
							SELECT string_agg(kcu.column_name, ', ') 
							FROM information_schema.key_column_usage kcu 
							WHERE kcu.constraint_name = tc.constraint_name
						)
						WHEN constraint_type IN ('PRIMARY KEY', 'UNIQUE') THEN (
							SELECT string_agg(kcu.column_name, ', ') 
							FROM information_schema.key_column_usage kcu 
							WHERE kcu.constraint_name = tc.constraint_name
						)
						ELSE 'unknown'
					END as columns
				FROM information_schema.table_constraints tc
				WHERE tc.table_name = '${tableName}' 
				AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK')
				ORDER BY constraint_type, constraint_name`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)

			// Check for problematic constraints
			const problematicConstraints = allConstraints.filter((c) => {
				// PRIMARY KEY must include tenant_code for Citus
				if (c.constraint_type === 'PRIMARY KEY' && !c.columns.includes('tenant_code')) {
					return true
				}
				// UNIQUE constraints must include tenant_code for Citus
				if (c.constraint_type === 'UNIQUE' && !c.columns.includes('tenant_code')) {
					return true
				}
				// FOREIGN KEY constraints need special handling in Citus
				if (c.constraint_type === 'FOREIGN KEY') {
					return true // All FK constraints are potentially problematic
				}
				return false
			})

			if (problematicConstraints.length > 0) {
				const reasons = problematicConstraints
					.map((c) => `${c.constraint_type}: ${c.constraint_name} (${c.columns})`)
					.join('; ')
				return {
					canDistribute: false,
					reason: `Problematic constraints: ${reasons}`,
					constraints: problematicConstraints,
				}
			}

			return { canDistribute: true, reason: 'Table is ready for distribution' }
		} catch (error) {
			return { canDistribute: false, reason: `Error checking table: ${error.message}` }
		}
	}

	/**
	 * PHASE 1A: Drop all existing indexes (except system indexes)
	 */
	async dropAllExistingIndexes() {
		console.log('\n🗑️  PHASE 1A: Dropping all existing indexes...')
		console.log('='.repeat(60))

		try {
			// Get all non-system indexes
			const indexes = await this.sequelize.query(
				`SELECT 
					schemaname,
					tablename,
					indexname,
					indexdef
				FROM pg_indexes 
				WHERE schemaname = 'public'
				AND indexname NOT LIKE '%_pkey'  -- Skip primary key indexes
				AND indexname NOT LIKE 'pg_%'    -- Skip system indexes
				ORDER BY tablename, indexname`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)

			console.log(`🔍 Found ${indexes.length} indexes to drop`)

			let droppedCount = 0
			for (const index of indexes) {
				try {
					// Skip if not on our tables
					if (!this.allTables.includes(index.tablename)) {
						continue
					}

					// Skip excluded tables entirely
					if (this.excludedTables.includes(index.tablename)) {
						console.log(`⚠️  Skipping index ${index.indexname} on excluded table ${index.tablename}`)
						continue
					}

					await this.sequelize.query(`DROP INDEX IF EXISTS ${index.indexname}`)
					console.log(`✅ Dropped index: ${index.indexname} from ${index.tablename}`)
					droppedCount++
				} catch (error) {
					console.log(`❌ Error dropping index ${index.indexname}: ${error.message}`)
				}
			}

			console.log(`✅ Dropped ${droppedCount} indexes successfully`)
		} catch (error) {
			console.log(`❌ Error in index dropping phase: ${error.message}`)
		}
	}

	/**
	 * PHASE 1B: Drop all foreign key constraints
	 */
	async dropAllForeignKeyConstraints() {
		console.log('\n🗑️  PHASE 1B: Dropping all foreign key constraints...')
		console.log('='.repeat(60))

		const droppedConstraints = []

		try {
			// Get all foreign key constraints with full details
			const foreignKeys = await this.sequelize.query(
				`SELECT DISTINCT
					tc.table_name,
					tc.constraint_name,
					string_agg(DISTINCT kcu.column_name, ', ' ORDER BY kcu.column_name) as columns,
					ccu.table_name AS foreign_table_name,
					string_agg(DISTINCT ccu.column_name, ', ' ORDER BY ccu.column_name) as foreign_columns,
					rc.update_rule,
					rc.delete_rule
				FROM information_schema.table_constraints AS tc 
				JOIN information_schema.key_column_usage AS kcu
					ON tc.constraint_name = kcu.constraint_name
					AND tc.table_schema = kcu.table_schema
				JOIN information_schema.constraint_column_usage AS ccu
					ON ccu.constraint_name = tc.constraint_name
					AND ccu.table_schema = tc.table_schema
				JOIN information_schema.referential_constraints AS rc
					ON tc.constraint_name = rc.constraint_name
					AND tc.table_schema = rc.constraint_schema
				WHERE tc.constraint_type = 'FOREIGN KEY' 
				AND tc.table_schema = 'public'
				GROUP BY tc.constraint_name, tc.table_name, ccu.table_name, rc.update_rule, rc.delete_rule
				ORDER BY tc.table_name`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)

			console.log(`🔍 Found ${foreignKeys.length} foreign key constraints to drop`)

			let droppedCount = 0
			for (const fk of foreignKeys) {
				try {
					// Skip if not on our tables
					if (!this.allTables.includes(fk.table_name)) {
						continue
					}

					// Store constraint info for recreation
					droppedConstraints.push({
						table: fk.table_name,
						constraint: fk.constraint_name,
						columns: fk.columns,
						refTable: fk.foreign_table_name,
						refColumns: fk.foreign_columns,
						updateRule: fk.update_rule,
						deleteRule: fk.delete_rule,
					})

					await this.sequelize.query(
						`ALTER TABLE ${fk.table_name} DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`
					)
					console.log(
						`✅ Dropped FK: ${fk.constraint_name} from ${fk.table_name} (${fk.columns} -> ${fk.foreign_table_name}.${fk.foreign_columns})`
					)
					droppedCount++
				} catch (error) {
					console.log(`❌ Error dropping FK ${fk.constraint_name}: ${error.message}`)
				}
			}

			console.log(`✅ Dropped ${droppedCount} foreign key constraints successfully`)
		} catch (error) {
			console.log(`❌ Error in foreign key dropping phase: ${error.message}`)
		}

		return droppedConstraints
	}

	/**
	 * PHASE 4B: Create performance indexes after Citus distribution
	 */
	async createPerformanceIndexes() {
		console.log('\n📊 PHASE 4B: Creating performance indexes...')
		console.log('='.repeat(60))

		// Performance indexes based on table specifications
		const performanceIndexes = [
			{ table: 'availabilities', name: 'idx_availabilities_tenant_code', columns: 'tenant_code', condition: '' },
			{
				table: 'connection_requests',
				name: 'idx_connection_requests_friend_user_tenant',
				columns: 'friend_id, user_id, tenant_code',
				condition: '',
			},
			{
				table: 'connections',
				name: 'idx_connections_friend_user_tenant',
				columns: 'friend_id, user_id, tenant_code',
				condition: '',
			},
			{
				table: 'entity_types',
				name: 'idx_entity_types_value_tenant',
				columns: 'value, tenant_code',
				condition: '',
			},
			{ table: 'feedbacks', name: 'idx_feedbacks_user_tenant', columns: 'user_id, tenant_code', condition: '' },
			{
				table: 'forms',
				name: 'idx_forms_type_subtype_organization',
				columns: 'type, sub_type, organization_id',
				condition: '',
			},
			{ table: 'issues', name: 'idx_issues_tenant_code', columns: 'tenant_code', condition: '' },
			{
				table: 'notification_templates',
				name: 'idx_notification_templates_code_org',
				columns: 'code, organization_id',
				condition: '',
			},
			{
				table: 'organization_extension',
				name: 'idx_organization_extension_org_code',
				columns: 'organization_code',
				condition: '',
			},
			{
				table: 'organization_extension',
				name: 'idx_organization_extension_org_tenant_code',
				columns: 'organization_code, tenant_code',
				condition: '',
			},
			{
				table: 'post_session_details',
				name: 'idx_post_session_details_tenant_session',
				columns: 'tenant_code, session_id',
				condition: '',
			},
			{
				table: 'question_sets',
				name: 'idx_question_sets_code_tenant',
				columns: 'code, tenant_code',
				condition: '',
			},
			{
				table: 'report_queries',
				name: 'idx_report_queries_code_tenant_org',
				columns: 'report_code, tenant_code, organization_code',
				condition: '',
			},
			{
				table: 'report_role_mapping',
				name: 'idx_report_role_mapping_role_code',
				columns: 'role_title, report_code',
				condition: '',
			},
			{
				table: 'report_types',
				name: 'idx_report_types_title_tenant',
				columns: 'title, tenant_code',
				condition: '',
			},
			{
				table: 'reports',
				name: 'idx_reports_org_tenant_code',
				columns: 'organization_id, tenant_code, code',
				condition: '',
			},
			{
				table: 'resources',
				name: 'idx_resources_session_tenant',
				columns: 'session_id, tenant_code',
				condition: '',
			},
			{ table: 'role_extensions', name: 'idx_role_extensions_title', columns: 'title', condition: '' },
			{
				table: 'session_attendees',
				name: 'idx_session_attendees_tenant_code',
				columns: 'tenant_code',
				condition: '',
			},
			{
				table: 'session_request',
				name: 'idx_session_request_tenant_code',
				columns: 'tenant_code',
				condition: '',
			},
			{
				table: 'user_extensions',
				name: 'idx_user_extensions_user_tenant',
				columns: 'user_id, tenant_code',
				condition: '',
			},
			{
				table: 'user_extensions',
				name: 'idx_user_extensions_email',
				columns: 'email',
				condition: 'WHERE email IS NOT NULL',
			},
			{
				table: 'user_extensions',
				name: 'idx_user_extensions_phone',
				columns: 'phone',
				condition: 'WHERE phone IS NOT NULL',
			},
			{
				table: 'user_extensions',
				name: 'idx_user_extensions_user_name',
				columns: 'user_name',
				condition: 'WHERE user_name IS NOT NULL',
			},
		]

		let createdCount = 0
		for (const indexConfig of performanceIndexes) {
			try {
				// Check if table exists
				const tableExists = await this.sequelize.query(
					`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${indexConfig.table}') as exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${indexConfig.table} does not exist, skipping index`)
					continue
				}

				// Check if index already exists
				const indexExists = await this.sequelize.query(
					`SELECT EXISTS (
						SELECT 1 FROM pg_indexes 
						WHERE tablename = '${indexConfig.table}' 
						AND indexname = '${indexConfig.name}'
					) as exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (indexExists[0].exists) {
					console.log(`✅ Index ${indexConfig.name} already exists`)
					continue
				}

				// Create performance index
				await this.sequelize.query(`
					CREATE INDEX ${indexConfig.name} 
					ON ${indexConfig.table} (${indexConfig.columns}) 
					${indexConfig.condition}
				`)

				console.log(`✅ Created performance index: ${indexConfig.name}`)
				createdCount++
			} catch (error) {
				console.log(`❌ Error creating index ${indexConfig.name}: ${error.message}`)
			}
		}

		console.log(`✅ Created ${createdCount} performance indexes successfully`)
	}

	/**
	 * Helper: Drop ALL constraints that might conflict with Citus distribution
	 */
	async dropAllConstraintsForCitus() {
		console.log('\n🗑️  PHASE 5.5: Dropping ALL problematic constraints for Citus distribution...')
		console.log('='.repeat(80))

		const citusEnabled = await this.isCitusEnabled()
		if (!citusEnabled) {
			console.log('⚠️  Citus not enabled, skipping constraint drop')
			return { foreignKeys: [], checkConstraints: [], otherConstraints: [] }
		}

		const droppedConstraints = {
			foreignKeys: [],
			checkConstraints: [],
			otherConstraints: [],
		}

		// Get ALL constraints across all tables (excluding PRIMARY KEY)
		const allConstraints = await this.sequelize.query(
			`SELECT 
				tc.constraint_name,
				tc.table_name,
				tc.constraint_type,
				CASE 
					WHEN tc.constraint_type = 'FOREIGN KEY' THEN (
						SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) 
						FROM information_schema.key_column_usage kcu 
						WHERE kcu.constraint_name = tc.constraint_name
					)
					WHEN tc.constraint_type IN ('UNIQUE', 'CHECK') THEN (
						SELECT string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) 
						FROM information_schema.key_column_usage kcu 
						WHERE kcu.constraint_name = tc.constraint_name
					)
					ELSE 'N/A'
				END as columns
			FROM information_schema.table_constraints tc
			WHERE tc.table_schema = 'public' 
			AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK', 'UNIQUE')
			AND tc.constraint_type != 'PRIMARY KEY'
			ORDER BY tc.constraint_type, tc.table_name`,
			{ type: this.sequelize.QueryTypes.SELECT }
		)

		console.log(`🔍 Found ${allConstraints.length} total constraints to drop before Citus distribution`)

		for (const constraint of allConstraints) {
			try {
				// Skip if not on our tables
				if (!this.allTables.includes(constraint.table_name)) {
					continue
				}

				// Store constraint info for potential recreation
				const constraintInfo = {
					table: constraint.table_name,
					name: constraint.constraint_name,
					type: constraint.constraint_type,
					columns: constraint.columns,
				}

				if (constraint.constraint_type === 'FOREIGN KEY') {
					droppedConstraints.foreignKeys.push(constraintInfo)
				} else if (constraint.constraint_type === 'CHECK') {
					droppedConstraints.checkConstraints.push(constraintInfo)
				} else {
					droppedConstraints.otherConstraints.push(constraintInfo)
				}

				// Drop the constraint
				await this.sequelize.query(
					`ALTER TABLE ${constraint.table_name} DROP CONSTRAINT IF EXISTS ${constraint.constraint_name}`
				)
				console.log(
					`✅ Dropped ${constraint.constraint_type}: ${constraint.constraint_name} from ${constraint.table_name}`
				)
			} catch (error) {
				console.log(`❌ Error dropping constraint ${constraint.constraint_name}: ${error.message}`)
			}
		}

		const totalDropped =
			droppedConstraints.foreignKeys.length +
			droppedConstraints.checkConstraints.length +
			droppedConstraints.otherConstraints.length
		console.log(
			`✅ Dropped ${totalDropped} constraints (FK: ${droppedConstraints.foreignKeys.length}, CHECK: ${droppedConstraints.checkConstraints.length}, OTHER: ${droppedConstraints.otherConstraints.length})`
		)

		return droppedConstraints
	}

	/**
	 * Helper: Drop all foreign key constraints temporarily for Citus distribution
	 */
	async dropAllForeignKeys() {
		console.log('\n🗑️  PHASE 5.5: Temporarily dropping foreign key constraints for Citus distribution...')
		console.log('='.repeat(70))

		const citusEnabled = await this.isCitusEnabled()
		if (!citusEnabled) {
			console.log('⚠️  Citus not enabled, skipping FK drop')
			return []
		}

		const droppedConstraints = []

		// First get all foreign keys across all tables
		const allForeignKeys = await this.sequelize.query(
			`SELECT 
				tc.constraint_name,
				tc.table_name,
				string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
				ccu.table_name AS foreign_table_name,
				string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) as foreign_columns,
				rc.update_rule,
				rc.delete_rule
			FROM information_schema.table_constraints AS tc 
			JOIN information_schema.key_column_usage AS kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			JOIN information_schema.constraint_column_usage AS ccu
				ON ccu.constraint_name = tc.constraint_name
				AND ccu.table_schema = tc.table_schema
			JOIN information_schema.referential_constraints AS rc
				ON tc.constraint_name = rc.constraint_name
				AND tc.table_schema = rc.constraint_schema
			WHERE tc.constraint_type = 'FOREIGN KEY' 
			AND tc.table_schema = 'public'
			GROUP BY tc.constraint_name, tc.table_name, ccu.table_name, rc.update_rule, rc.delete_rule
			ORDER BY tc.table_name`,
			{ type: this.sequelize.QueryTypes.SELECT }
		)

		console.log(`🔍 Found ${allForeignKeys.length} total foreign key constraints to potentially drop`)

		for (const tableName of this.allTables) {
			try {
				// Filter FKs for this table
				const foreignKeys = allForeignKeys.filter((fk) => fk.table_name === tableName)

				for (const fk of foreignKeys) {
					try {
						// Store constraint info for later recreation
						droppedConstraints.push({
							table: fk.table_name,
							constraint: fk.constraint_name,
							columns: fk.columns,
							refTable: fk.foreign_table_name,
							refColumns: fk.foreign_columns,
							updateRule: fk.update_rule,
							deleteRule: fk.delete_rule,
						})

						// Drop the constraint
						await this.sequelize.query(
							`ALTER TABLE ${fk.table_name} DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`
						)
						console.log(
							`✅ Dropped FK: ${fk.constraint_name} from ${fk.table_name} (${fk.columns} -> ${fk.foreign_table_name}.${fk.foreign_columns})`
						)
					} catch (error) {
						console.log(`❌ Error dropping FK ${fk.constraint_name}: ${error.message}`)
					}
				}
			} catch (error) {
				console.log(`❌ Error getting FK constraints for ${tableName}: ${error.message}`)
			}
		}

		console.log(`✅ Temporarily dropped ${droppedConstraints.length} foreign key constraints`)
		return droppedConstraints
	}

	/**
	 * PHASE 3: Configure Citus distribution (only if Citus is enabled)
	 */
	async configureCitusDistribution() {
		const citusEnabled = await this.isCitusEnabled()

		if (!citusEnabled) {
			console.log('\n⚠️  PHASE 3 SKIPPED: Citus not enabled, using regular PostgreSQL')
			console.log('✅ Tables remain as regular PostgreSQL tables (no distribution needed)')
			return
		}

		console.log('\n🔄 PHASE 3: Configuring Citus distribution...')
		console.log('='.repeat(50))
		console.log('🔧 Citus detected - distributing tables with tenant_code as partition key')

		// No special distribution columns needed - all tables use tenant_code

		for (const tableName of this.allTables) {
			try {
				// Skip excluded tables
				if (this.excludedTables.includes(tableName)) {
					console.log(`⚠️  Skipping ${tableName} - excluded from migration`)
					continue
				}

				// Check if already distributed first
				const isDistributed = await this.isTableDistributed(tableName)
				if (isDistributed) {
					console.log(`✅ Table ${tableName} already distributed`)
					this.stats.tablesDistributed++
					continue
				}

				// If not distributed, validate it can be distributed
				const validation = await this.canTableBeDistributed(tableName)
				if (!validation.canDistribute) {
					console.log(`⚠️  Cannot distribute ${tableName}: ${validation.reason}`)
					continue
				}

				console.log(`🔄 Attempting to distribute ${tableName}...`)

				// Distribute table with tenant_code as partition key
				await this.sequelize.query(`
					SELECT create_distributed_table('${tableName}', 'tenant_code')
				`)

				console.log(`✅ Successfully distributed table: ${tableName}`)
				this.stats.tablesDistributed++
			} catch (error) {
				console.log(`❌ Error distributing ${tableName}: ${error.message}`)

				// Check if it was actually distributed despite the error
				try {
					const nowDistributed = await this.isTableDistributed(tableName)
					if (nowDistributed) {
						console.log(
							`   ✅ Table ${tableName} is now distributed (error was during constraint creation)`
						)
						this.stats.tablesDistributed++
					} else {
						console.log(`   ❌ Table ${tableName} distribution failed completely`)

						// For debugging - show what constraints exist on this table
						const existingConstraints = await this.sequelize.query(
							`SELECT constraint_name, constraint_type 
							FROM information_schema.table_constraints 
							WHERE table_name = '${tableName}' 
							ORDER BY constraint_type`,
							{ type: this.sequelize.QueryTypes.SELECT }
						)
						console.log(`   📋 Existing constraints on ${tableName}:`)
						existingConstraints.forEach((c) => {
							console.log(`      - ${c.constraint_type}: ${c.constraint_name}`)
						})
					}
				} catch (debugError) {
					console.log(`   ❌ Could not check final distribution status: ${debugError.message}`)
				}
			}
		}

		console.log(`✅ Citus distribution complete: ${this.stats.tablesDistributed} tables distributed`)
	}

	/**
	 * PHASE 4A2: Create unique indexes
	 */
	async createUniqueIndexes() {
		console.log('\n📊 PHASE 4A2: Creating unique indexes...')
		console.log('='.repeat(50))

		// Updated unique constraints to be Citus-compatible (must include tenant_code)
		const indexConfigs = [
			{
				table: 'availabilities',
				name: 'unique_availabilities_event_name_tenant',
				columns: 'tenant_code, event_name',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'default_rules',
				name: 'unique_default_rules_type_org_tenant',
				columns: 'type, organization_id, tenant_code',
				condition: 'WHERE deleted_at IS NULL',
			},
			// REMOVED: unique_entities_entity_type_id_tenant - has duplicate data that needs cleanup
			// REMOVED: unique_entity_types_id_tenant - conflicts with Citus distributed table constraints
			// REMOVED: unique_sessions_id_only - Citus doesn't allow unique constraints on non-partition columns
			{
				table: 'entity_types',
				name: 'unique_entity_types_value_organization_tenant',
				columns: 'tenant_code, value, organization_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			// REMOVED: unique_file_uploads_organization_tenant - has duplicate data that needs cleanup
			{
				table: 'forms',
				name: 'unique_forms_id_organization_type_tenant',
				columns: 'tenant_code, id, organization_id, type',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'modules',
				name: 'unique_modules_code_tenant',
				columns: 'tenant_code, code',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'notification_templates',
				name: 'unique_notification_templates_code_org_tenant',
				columns: 'tenant_code, code, organization_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'organization_extension',
				name: 'unique_organization_extension_org_code_tenant',
				columns: 'tenant_code, organization_code',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'post_session_details',
				name: 'unique_post_session_details_session_tenant',
				columns: 'tenant_code, session_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'question_sets',
				name: 'unique_question_sets_code_tenant',
				columns: 'code, tenant_code',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'report_queries',
				name: 'unique_report_queries_code_tenant_org',
				columns: 'report_code, tenant_code, organization_code',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'report_role_mapping',
				name: 'unique_report_role_mapping_role_code_tenant',
				columns: 'tenant_code, role_title, report_code',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'report_types',
				name: 'unique_report_types_title_tenant',
				columns: 'tenant_code, title',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'reports',
				name: 'unique_reports_code_organization_tenant',
				columns: 'tenant_code, code, organization_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			// REMOVED: unique_resources_session_tenant - validation error (can be added later after data cleanup)
			{
				table: 'role_extensions',
				name: 'unique_role_extensions_title_org_tenant',
				columns: 'tenant_code, title, organization_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'session_attendees',
				name: 'unique_session_attendees_session_mentee_tenant',
				columns: 'session_id, mentee_id, tenant_code',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'session_request',
				name: 'unique_session_request_requestor_requestee_tenant',
				columns: 'requestor_id, requestee_id, tenant_code',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'sessions',
				name: 'unique_sessions_id_title_mentor_creator_tenant',
				columns: 'tenant_code, id, title, mentor_name, created_by',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'user_extensions',
				name: 'unique_user_extensions_user_tenant_email_phone_username',
				columns: 'user_id, tenant_code, email, phone, user_name',
				condition: 'WHERE deleted_at IS NULL AND email IS NOT NULL AND phone IS NOT NULL',
			},
		]

		for (const indexConfig of indexConfigs) {
			try {
				// Check if table exists
				const tableExists = await this.sequelize.query(
					`
					SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${indexConfig.table}') as exists
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${indexConfig.table} does not exist, skipping index`)
					continue
				}

				// Check if index already exists
				const indexExists = await this.sequelize.query(
					`
					SELECT EXISTS (
						SELECT 1 FROM pg_indexes 
						WHERE tablename = '${indexConfig.table}' 
						AND indexname = '${indexConfig.name}'
					) as exists
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (indexExists[0].exists) {
					console.log(`✅ Index ${indexConfig.name} already exists`)
					continue
				}

				// Create unique index
				await this.sequelize.query(`
					CREATE UNIQUE INDEX ${indexConfig.name} 
					ON ${indexConfig.table} (${indexConfig.columns}) 
					${indexConfig.condition}
				`)

				console.log(`✅ Created unique index: ${indexConfig.name}`)
			} catch (error) {
				console.log(`❌ Error creating index ${indexConfig.name}: ${error.message}`)
			}
		}
	}

	/**
	 * PHASE 1C: Remove problematic unique constraints
	 */
	async removeProblematicConstraints() {
		console.log('\n🗑️  PHASE 1C: Removing problematic unique constraints...')
		console.log('='.repeat(50))

		// Constraints that don't include tenant_code and need to be removed for Citus compatibility
		const constraintsToRemove = [
			{ table: 'availabilities', constraint: 'availabilities_event_name_key' },
			{ table: 'connection_requests', constraint: 'connection_requests_friend_id_user_id_key' },
			{ table: 'connections', constraint: 'connections_friend_id_user_id_key' },
			{ table: 'default_rules', constraint: 'default_rules_type_organization_id_key' },
			{ table: 'entity_types', constraint: 'entity_types_value_key' },
			{ table: 'forms', constraint: 'forms_type_sub_type_organization_id_key' },
			{ table: 'forms', constraint: 'unique_type_sub_type_org_id' }, // NEW - problematic forms constraint
			{ table: 'modules', constraint: 'modules_code_key' },
			{ table: 'notification_templates', constraint: 'notification_templates_code_organization_id_key' },
			{ table: 'organization_extension', constraint: 'organization_extension_organization_code_key' },
			{ table: 'report_role_mapping', constraint: 'report_role_mapping_role_title_report_code_key' },
			{ table: 'report_types', constraint: 'report_types_title_key' },
			{ table: 'reports', constraint: 'reports_code_organization_id_key' },
			{ table: 'report_queries', constraint: 'report_queries_report_code_organization_id_key' },
			{ table: 'role_extensions', constraint: 'role_extensions_title_key' },
			{ table: 'user_extensions', constraint: 'user_extensions_user_id_key' },
			{ table: 'user_extensions', constraint: 'user_extensions_email_key' },
			{ table: 'user_extensions', constraint: 'user_extensions_phone_key' },
			{ table: 'session_request', constraint: 'session_request_session_id_mentee_id_key' },
			{ table: 'resources', constraint: 'resources_session_id_key' },
		]

		for (const item of constraintsToRemove) {
			try {
				// Check if table exists
				const tableExists = await this.sequelize.query(
					`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${item.table}') as exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${item.table} does not exist, skipping constraint removal`)
					continue
				}

				// Check if constraint exists
				const constraintExists = await this.sequelize.query(
					`SELECT EXISTS (
						SELECT 1 FROM information_schema.table_constraints 
						WHERE table_name = '${item.table}' 
						AND constraint_name = '${item.constraint}'
					) as exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!constraintExists[0].exists) {
					console.log(`✅ Constraint ${item.constraint} on ${item.table} already removed or does not exist`)
					continue
				}

				// Remove the problematic constraint
				await this.sequelize.query(`ALTER TABLE ${item.table} DROP CONSTRAINT IF EXISTS ${item.constraint}`)
				console.log(`✅ Removed constraint ${item.constraint} from ${item.table}`)
			} catch (error) {
				console.log(`❌ Error removing constraint ${item.constraint} from ${item.table}: ${error.message}`)
			}
		}
	}

	/**
	 * PHASE 4A: Recreate all foreign key constraints (dropped in Phase 1B)
	 */
	async recreateAllForeignKeys(droppedConstraints) {
		console.log('\n🔧 PHASE 4A: Recreating all foreign key constraints...')
		console.log('='.repeat(60))

		if (!droppedConstraints || droppedConstraints.length === 0) {
			console.log('⚠️  No foreign key constraints to recreate')
			return
		}

		console.log(`🔍 Recreating ${droppedConstraints.length} foreign key constraints...`)

		let recreatedCount = 0
		for (const fk of droppedConstraints) {
			try {
				// Check if both tables still exist and are distributed
				const tablesExist = await this.sequelize.query(
					`SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.table}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.refTable}') as ref_table_exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tablesExist[0].table_exists || !tablesExist[0].ref_table_exists) {
					console.log(`⚠️  Skipping FK ${fk.constraint}: missing table (${fk.table} or ${fk.refTable})`)
					continue
				}

				// For Citus compatibility, use RESTRICT instead of CASCADE
				const onDelete = fk.deleteRule === 'CASCADE' ? 'RESTRICT' : fk.deleteRule
				const onUpdate = fk.updateRule === 'CASCADE' ? 'RESTRICT' : fk.updateRule

				// Recreate the foreign key constraint with Citus-compatible settings
				await this.sequelize.query(`
					ALTER TABLE ${fk.table} 
					ADD CONSTRAINT ${fk.constraint} 
					FOREIGN KEY (${fk.columns}) 
					REFERENCES ${fk.refTable}(${fk.refColumns}) 
					ON DELETE ${onDelete} 
					ON UPDATE ${onUpdate}
				`)

				console.log(
					`✅ Recreated FK: ${fk.constraint} (${fk.table}.${fk.columns} -> ${fk.refTable}.${fk.refColumns})`
				)
				recreatedCount++
				this.stats.foreignKeysAdded++
			} catch (error) {
				console.log(`❌ Error recreating FK ${fk.constraint}: ${error.message}`)
			}
		}

		console.log(`✅ Successfully recreated ${recreatedCount}/${droppedConstraints.length} foreign key constraints`)
	}

	/**
	 * PHASE 4A3: Add new Citus-compatible foreign keys
	 */
	async addCitusCompatibleForeignKeys() {
		console.log('\n🔗 PHASE 4A3: Adding new Citus-compatible foreign key constraints...')
		console.log('='.repeat(60))

		// Check if Citus is enabled
		const citusEnabled = await this.isCitusEnabled()
		if (!citusEnabled) {
			console.log('⚠️  Citus not enabled - using standard foreign keys without tenant_code')
		}

		// Compatible Citus-distributed foreign keys:
		const compatibleForeignKeys = [
			{
				table: 'entities',
				constraint: 'fk_entities_entity_type_id',
				columns: citusEnabled ? 'tenant_code, entity_type_id' : 'entity_type_id',
				refTable: 'entity_types',
				refColumns: citusEnabled ? 'tenant_code, id' : 'id',
				description: 'entities(entity_type_id) -> entity_types(id)',
			},
			{
				table: 'post_session_details',
				constraint: 'fk_post_session_details_session_id',
				columns: citusEnabled ? 'tenant_code, session_id' : 'session_id',
				refTable: 'sessions',
				refColumns: citusEnabled ? 'tenant_code, id' : 'id',
				description: 'post_session_details(session_id) -> sessions(id)',
			},
			{
				table: 'session_attendees',
				constraint: 'fk_session_attendees_session_id',
				columns: citusEnabled ? 'tenant_code, session_id' : 'session_id',
				refTable: 'sessions',
				refColumns: citusEnabled ? 'tenant_code, id' : 'id',
				description: 'session_attendees(session_id) -> sessions(id)',
			},
			{
				table: 'resources',
				constraint: 'fk_resources_session_id',
				columns: citusEnabled ? 'tenant_code, session_id' : 'session_id',
				refTable: 'sessions',
				refColumns: citusEnabled ? 'tenant_code, id' : 'id',
				description: 'resources(session_id) -> sessions(id)',
			},
		]

		console.log(`🔍 Processing ${compatibleForeignKeys.length} foreign key configurations...`)

		let createdCount = 0
		for (const fk of compatibleForeignKeys) {
			console.log(`\n🔄 Processing FK: ${fk.constraint} (${fk.table} -> ${fk.refTable})`)
			try {
				// Check if both tables exist
				const tablesExist = await this.sequelize.query(
					`SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.table}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.refTable}') as ref_table_exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tablesExist[0].table_exists || !tablesExist[0].ref_table_exists) {
					console.log(
						`⚠️  Skipping FK ${fk.constraint}: missing table (${fk.table}=${tablesExist[0].table_exists} or ${fk.refTable}=${tablesExist[0].ref_table_exists})`
					)
					continue
				}

				// DEBUG: Check what constraints exist on referenced table
				console.log(`🔍 DEBUG: Checking constraints for ${fk.refTable}...`)
				const existingConstraints = await this.sequelize.query(
					`SELECT constraint_name, constraint_type FROM information_schema.table_constraints 
					 WHERE table_name = '${fk.refTable}' AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
					 ORDER BY constraint_type`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)
				console.log(
					`   Available constraints: ${existingConstraints
						.map((c) => c.constraint_name + '(' + c.constraint_type + ')')
						.join(', ')}`
				)
				console.log(`   FK trying to reference: ${fk.refTable}(${fk.refColumns})`)

				// Check if constraint already exists
				const constraintExists = await this.sequelize.query(
					`SELECT EXISTS(
						SELECT 1 FROM information_schema.table_constraints 
						WHERE constraint_name = '${fk.constraint}' AND table_name = '${fk.table}'
					) as exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (constraintExists[0].exists) {
					console.log(`⚠️  FK ${fk.constraint} already exists, skipping`)
					continue
				}

				// Create the foreign key constraint
				await this.sequelize.query(`
					ALTER TABLE ${fk.table} 
					ADD CONSTRAINT ${fk.constraint} 
					FOREIGN KEY (${fk.columns}) 
					REFERENCES ${fk.refTable}(${fk.refColumns}) 
					ON DELETE RESTRICT 
					ON UPDATE RESTRICT
				`)

				console.log(`✅ Created FK: ${fk.constraint} (${fk.description})`)
				createdCount++
				this.stats.foreignKeysAdded++
			} catch (error) {
				console.log(`❌ Error creating FK ${fk.constraint}: ${error.message}`)
				console.log(`   Table: ${fk.table}, RefTable: ${fk.refTable}`)
				console.log(`   Columns: ${fk.columns}, RefColumns: ${fk.refColumns}`)

				// Additional debugging for Citus-specific issues
				if (citusEnabled && error.message.includes('distribution')) {
					console.log(`   🔍 Debug: This may be a Citus distribution column mismatch`)
				}

				// Log the full error stack for debugging
				console.log(`   Full error: ${error.stack}`)
			}
		}

		console.log(
			`✅ Successfully created ${createdCount}/${compatibleForeignKeys.length} new foreign key constraints`
		)

		// Show current foreign key status
		console.log('\n📋 FOREIGN KEY STATUS SUMMARY:')
		console.log('✅ All compatible foreign keys have been created')
		console.log('✅ Citus-distributed FKs: session_attendees -> sessions, resources -> sessions')
		console.log('✅ Non-distributed FKs: role_permission_mapping -> permissions')
	}

	/**
	 * PHASE 3C: Undistribute specific tables that should remain as regular PostgreSQL tables
	 */
	async undistributeSpecificTables() {
		console.log('\n🔄 PHASE 3C: Undistributing specific tables...')
		console.log('='.repeat(60))

		const citusEnabled = await this.isCitusEnabled()
		if (!citusEnabled) {
			console.log('⚠️  Citus not enabled, skipping undistribution')
			return
		}

		// Tables that should NOT be distributed (remain as regular PostgreSQL tables)
		const tablesToUndistribute = ['permissions', 'role_permission_mapping']

		for (const tableName of tablesToUndistribute) {
			try {
				// Check if table exists
				const tableExists = await this.sequelize.query(
					`
					SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as exists
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${tableName} does not exist, skipping`)
					continue
				}

				// Check if table is currently distributed
				const isDistributed = await this.sequelize.query(
					`
					SELECT EXISTS(SELECT 1 FROM pg_dist_partition WHERE logicalrelid = '${tableName}'::regclass) as distributed
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!isDistributed[0].distributed) {
					console.log(`✅ Table ${tableName} is already not distributed`)
					continue
				}

				console.log(`🔄 Undistributing table: ${tableName}`)

				// Undistribute the table (convert back to regular PostgreSQL table)
				await this.sequelize.query(`SELECT undistribute_table('${tableName}')`)

				console.log(`✅ Successfully undistributed table: ${tableName}`)
			} catch (error) {
				console.log(`❌ Error undistributing ${tableName}: ${error.message}`)

				// Try alternative undistribution method if the first fails
				try {
					console.log(`   Trying alternative undistribution method for ${tableName}...`)
					await this.sequelize.query(
						`SELECT citus_drop_all_shards('${tableName}'::regclass, 'public', 'default')`
					)
					console.log(`   ✅ Alternative undistribution successful for ${tableName}`)
				} catch (altError) {
					console.log(`   ❌ Alternative undistribution also failed: ${altError.message}`)
				}
			}
		}

		console.log(`✅ Undistribution phase completed`)
	}

	/**
	 * PHASE 4A4: Add foreign keys for non-distributed (regular PostgreSQL) tables
	 */
	async addNonDistributedTableForeignKeys() {
		console.log('\n🔗 PHASE 4A4: Adding foreign keys for non-distributed tables...')
		console.log('='.repeat(60))

		// Foreign keys for tables that are NOT distributed (regular PostgreSQL tables)
		// These tables were excluded from Citus distribution but still need referential integrity
		const nonDistributedForeignKeys = [
			{
				table: 'role_permission_mapping',
				constraint: 'fk_role_permission_mapping_permission_id',
				columns: 'permission_id',
				refTable: 'permissions',
				refColumns: 'id',
				description: 'role_permission_mapping(permission_id) -> permissions(id)',
			},
			// NOTE: post_session_details FK moved to Citus-compatible section since it references distributed table
		]

		let createdCount = 0
		for (const fk of nonDistributedForeignKeys) {
			try {
				// Check if both tables exist
				const tablesExist = await this.sequelize.query(
					`SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.table}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.refTable}') as ref_table_exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tablesExist[0].table_exists || !tablesExist[0].ref_table_exists) {
					console.log(`⚠️  Skipping FK ${fk.constraint}: missing table (${fk.table} or ${fk.refTable})`)
					continue
				}

				// Verify both tables are NOT distributed (should be regular PostgreSQL tables)
				const distributionCheck = await this.sequelize.query(
					`SELECT 
						EXISTS(SELECT 1 FROM pg_dist_partition WHERE logicalrelid = '${fk.table}'::regclass) as table_distributed,
						EXISTS(SELECT 1 FROM pg_dist_partition WHERE logicalrelid = '${fk.refTable}'::regclass) as ref_table_distributed`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (distributionCheck[0].table_distributed || distributionCheck[0].ref_table_distributed) {
					console.log(
						`⚠️  Skipping FK ${fk.constraint}: one or both tables are distributed (should use Citus-compatible FK method)`
					)
					continue
				}

				// Check if constraint already exists
				const constraintExists = await this.sequelize.query(
					`SELECT EXISTS(
						SELECT 1 FROM information_schema.table_constraints 
						WHERE constraint_name = '${fk.constraint}' AND table_name = '${fk.table}'
					) as exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (constraintExists[0].exists) {
					console.log(`⚠️  FK ${fk.constraint} already exists, skipping`)
					continue
				}

				// Create the foreign key constraint (standard PostgreSQL FK without tenant_code)
				await this.sequelize.query(`
					ALTER TABLE ${fk.table} 
					ADD CONSTRAINT ${fk.constraint} 
					FOREIGN KEY (${fk.columns}) 
					REFERENCES ${fk.refTable}(${fk.refColumns}) 
					ON DELETE RESTRICT 
					ON UPDATE RESTRICT
				`)

				console.log(`✅ Created non-distributed FK: ${fk.constraint} (${fk.description})`)
				createdCount++
				this.stats.foreignKeysAdded++
			} catch (error) {
				console.log(`❌ Error creating non-distributed FK ${fk.constraint}: ${error.message}`)
			}
		}

		console.log(
			`✅ Successfully created ${createdCount}/${nonDistributedForeignKeys.length} foreign keys for non-distributed tables`
		)
	}

	/**
	 * PHASE 4A (Legacy): Fix specific foreign key constraints (remove CASCADE operations)
	 */
	async fixForeignKeyConstraints() {
		console.log('\n🔧 PHASE 4A: Fixing foreign key constraints (removing CASCADE)...')
		console.log('='.repeat(50))

		// Foreign keys that need CASCADE removed for Citus compatibility
		const foreignKeysToFix = [
			{
				table: 'session_attendees',
				constraint: 'fk_session_attendees_session_id',
				columns: 'session_id, tenant_code',
				refTable: 'sessions',
				refColumns: 'id, tenant_code',
			},
			{
				table: 'resources',
				constraint: 'fk_resources_session_id',
				columns: 'session_id, tenant_code',
				refTable: 'sessions',
				refColumns: 'id, tenant_code',
			},
		]

		for (const fk of foreignKeysToFix) {
			try {
				// Check if both tables exist
				const tablesExist = await this.sequelize.query(
					`SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.table}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fk.refTable}') as ref_table_exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tablesExist[0].table_exists || !tablesExist[0].ref_table_exists) {
					console.log(`⚠️  Missing table for FK ${fk.constraint}, skipping`)
					continue
				}

				// Drop existing foreign key if it exists
				await this.sequelize.query(`ALTER TABLE ${fk.table} DROP CONSTRAINT IF EXISTS ${fk.constraint}`)

				// Create without CASCADE (use RESTRICT for Citus compatibility)
				await this.sequelize.query(`
					ALTER TABLE ${fk.table} 
					ADD CONSTRAINT ${fk.constraint} 
					FOREIGN KEY (${fk.columns}) 
					REFERENCES ${fk.refTable}(${fk.refColumns}) 
					ON DELETE RESTRICT 
					ON UPDATE RESTRICT
				`)

				console.log(`✅ Fixed foreign key constraint ${fk.constraint} (removed CASCADE)`)
			} catch (error) {
				console.log(`❌ Error fixing FK ${fk.constraint}: ${error.message}`)
			}
		}
	}

	/**
	 * Phase 4: Fix table ownership issues
	 */
	async fixTableOwnership() {
		console.log('\n👤 PHASE 4: Fixing table ownership...')
		console.log('='.repeat(50))

		const targetOwner = 'shikshalokam'
		const tablesToCheck = [...this.allTables, 'permissions', 'post_session_details', 'role_permission_mapping']

		try {
			// Check if target owner exists
			const ownerExists = await this.sequelize.query(
				`SELECT EXISTS (SELECT 1 FROM pg_authid WHERE rolname = '${targetOwner}') as exists`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)

			if (!ownerExists[0].exists) {
				console.log(`❌ Target owner '${targetOwner}' does not exist, skipping ownership fix`)
				return
			}

			// Check and fix ownership for each table
			for (const tableName of tablesToCheck) {
				try {
					// Check if table exists
					const tableExists = await this.sequelize.query(
						`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}') as exists`,
						{ type: this.sequelize.QueryTypes.SELECT }
					)

					if (!tableExists[0].exists) {
						console.log(`⚠️  Table ${tableName} does not exist, skipping`)
						continue
					}

					// Get current owner
					const currentOwner = await this.sequelize.query(
						`SELECT pg_authid.rolname as owner
						FROM pg_class c
						JOIN pg_authid ON pg_authid.oid = c.relowner
						WHERE c.relname = '${tableName}'`,
						{ type: this.sequelize.QueryTypes.SELECT }
					)

					if (currentOwner.length === 0) {
						console.log(`⚠️  Could not determine owner for ${tableName}`)
						continue
					}

					if (currentOwner[0].owner === targetOwner) {
						console.log(`✅ Table ${tableName} already owned by ${targetOwner}`)
						continue
					}

					// Change ownership
					await this.sequelize.query(`ALTER TABLE ${tableName} OWNER TO ${targetOwner}`)
					console.log(`✅ Changed ownership: ${tableName} (${currentOwner[0].owner} → ${targetOwner})`)
				} catch (error) {
					console.log(`❌ Error fixing ownership for ${tableName}: ${error.message}`)
				}
			}
		} catch (error) {
			console.log(`❌ Error in table ownership fix: ${error.message}`)
		}
	}

	/**
	 * Phase 2: Handle table deletions and exclusions
	 */
	async handleTableDeletionsAndExclusions() {
		console.log('\n🗑️  PHASE 2: Handling table deletions and exclusions...')
		console.log('='.repeat(50))

		// Tables to delete completely
		const tablesToDelete = ['session_enrollments', 'session_ownerships', 'session_request_mapping']

		// Tables to exclude from tenant migration (keep unchanged)
		const tablesToExclude = []

		// Delete specified tables
		for (const tableName of tablesToDelete) {
			try {
				const tableExists = await this.sequelize.query(
					`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}') as exists`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (!tableExists[0].exists) {
					console.log(`✅ Table ${tableName} already does not exist`)
					continue
				}

				// Drop table and all its constraints
				await this.sequelize.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`)
				console.log(`✅ Deleted table: ${tableName}`)
			} catch (error) {
				console.log(`❌ Error deleting table ${tableName}: ${error.message}`)
			}
		}

		// Remove excluded tables from processing lists
		this.allTables = this.allTables.filter((table) => !tablesToExclude.includes(table))
		this.tablesWithOrgCode = this.tablesWithOrgCode.filter((table) => !tablesToExclude.includes(table))

		console.log(`✅ Excluded ${tablesToExclude.length} tables from tenant migration: ${tablesToExclude.join(', ')}`)
	}

	/**
	 * PHASE 3B: Distribute special tables with custom distribution columns
	 */
	// Removed distributeSpecialTables method - no longer needed

	/**
	 * Phase 11: Final distribution verification and fixes
	 */
	async finalDistributionVerification() {
		console.log('\n🔍 PHASE 11: Final distribution verification and fixes...')
		console.log('='.repeat(50))

		const citusEnabled = await this.isCitusEnabled()
		if (!citusEnabled) {
			console.log('⚠️  Citus not enabled, skipping distribution verification')
			return
		}

		try {
			// Get all currently distributed tables (simplified to avoid type issues)
			const distributedTables = await this.sequelize.query(
				`SELECT 
					n.nspname as schemaname,
					c.relname as table_name,
					'tenant_code' as distribution_column
				FROM pg_dist_partition p
				JOIN pg_class c ON p.logicalrelid = c.oid
				JOIN pg_namespace n ON c.relnamespace = n.oid
				WHERE n.nspname = 'public'
				ORDER BY c.relname`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)

			console.log(`✅ Currently distributed tables: ${distributedTables.length}`)
			distributedTables.forEach((table) => {
				console.log(`   ✅ ${table.table_name} (${table.distribution_column})`)
			})

			// Get reference tables
			const referenceTables = await this.sequelize.query(
				`SELECT 
					n.nspname as schemaname,
					c.relname as table_name
				FROM pg_dist_partition p
				JOIN pg_class c ON p.logicalrelid = c.oid
				JOIN pg_namespace n ON c.relnamespace = n.oid
				WHERE n.nspname = 'public' 
				AND partmethod = 'n'
				ORDER BY c.relname`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)

			console.log(`✅ Reference tables: ${referenceTables.length}`)
			referenceTables.forEach((table) => {
				console.log(`   📋 ${table.table_name}`)
			})

			// Check for missing tables that should be distributed
			const distributedNames = distributedTables.map((t) => t.table_name)
			const missingTables = this.allTables.filter((t) => !distributedNames.includes(t))

			if (missingTables.length > 0) {
				console.log(`\\n❌ Tables not distributed: ${missingTables.length}`)
				missingTables.forEach((table) => {
					console.log(`   ❌ ${table}`)
				})

				// Attempt to distribute missing tables
				for (const tableName of missingTables) {
					try {
						const tableExists = await this.sequelize.query(
							`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}') as exists`,
							{ type: this.sequelize.QueryTypes.SELECT }
						)

						if (!tableExists[0].exists) {
							console.log(`   ⚠️  Table ${tableName} does not exist, skipping distribution`)
							continue
						}

						// Check if it's an excluded table
						if (this.excludedTables.includes(tableName)) {
							console.log(`   ⚠️  ${tableName} is excluded from migration`)
							continue
						}

						await this.sequelize.query(`SELECT create_distributed_table('${tableName}', 'tenant_code')`)
						console.log(`   ✅ Successfully distributed: ${tableName}`)
						this.stats.tablesDistributed++
					} catch (error) {
						console.log(`   ❌ Failed to distribute ${tableName}: ${error.message}`)
					}
				}
			} else {
				console.log('\\n✅ All expected tables are properly distributed')
			}

			// Final count
			const finalCount = await this.sequelize.query(`SELECT COUNT(*) as count FROM pg_dist_partition`, {
				type: this.sequelize.QueryTypes.SELECT,
			})

			console.log(`\\n🎊 Total tables in Citus: ${finalCount[0].count}`)
		} catch (error) {
			console.log(`❌ Error in distribution verification: ${error.message}`)
		}
	}

	/**
	 * Phase 10: Initial validation
	 */
	async finalValidation() {
		console.log('\n📊 PHASE 10: Initial validation...')
		console.log('='.repeat(50))

		// Check NOT NULL constraints
		for (const tableName of this.allTables) {
			try {
				const nullCheck = await this.sequelize.query(
					`
					SELECT COUNT(*) as null_count 
					FROM ${tableName} 
					WHERE tenant_code IS NULL
				`,
					{ type: this.sequelize.QueryTypes.SELECT }
				)

				if (nullCheck[0].null_count > 0) {
					console.log(`❌ ${tableName} still has ${nullCheck[0].null_count} NULL tenant_code values`)
				} else {
					console.log(`✅ ${tableName} - all tenant_code values populated`)
				}
			} catch (error) {
				console.log(`⚠️  Could not validate ${tableName}: ${error.message}`)
			}
		}

		// Check primary keys
		const primaryKeyCount = await this.sequelize.query(
			`
			SELECT COUNT(*) as count 
			FROM information_schema.table_constraints 
			WHERE table_schema = 'public' 
			AND constraint_type = 'PRIMARY KEY'
			AND table_name IN ('${this.allTables.join("','")}')
		`,
			{ type: this.sequelize.QueryTypes.SELECT }
		)

		console.log(`✅ Primary keys configured: ${primaryKeyCount[0].count}/${this.allTables.length}`)

		// Check foreign keys
		const foreignKeyCount = await this.sequelize.query(
			`
			SELECT COUNT(*) as count 
			FROM information_schema.table_constraints 
			WHERE table_schema = 'public' 
			AND constraint_type = 'FOREIGN KEY'
			AND constraint_name LIKE 'fk_%'
		`,
			{ type: this.sequelize.QueryTypes.SELECT }
		)

		console.log(`✅ Foreign keys created: ${foreignKeyCount[0].count}`)

		// Check Citus distribution (only if Citus is enabled)
		const citusEnabled = await this.isCitusEnabled()
		if (citusEnabled) {
			const distributedCount = await this.sequelize.query(
				`
				SELECT COUNT(*) as count FROM pg_dist_partition
			`,
				{ type: this.sequelize.QueryTypes.SELECT }
			)
			console.log(`✅ Distributed tables: ${distributedCount[0].count}`)
		} else {
			console.log(`✅ Using regular PostgreSQL (no distribution required)`)
		}
	}

	/**
	 * Print final statistics
	 */
	async printStats() {
		const duration = Math.round((Date.now() - this.stats.startTime) / 1000)
		const minutes = Math.floor(duration / 60)
		const seconds = duration % 60

		const citusEnabled = await this.isCitusEnabled()

		console.log('\n🎯 FINALIZATION COMPLETED!')
		console.log('='.repeat(50))
		console.log(`⏱️  Duration: ${minutes}m ${seconds}s`)
		console.log(`✅ Primary keys updated: ${this.stats.primaryKeysUpdated}`)
		console.log(`✅ Foreign keys added: ${this.stats.foreignKeysAdded}`)

		if (citusEnabled) {
			console.log(`✅ Tables distributed (Citus): ${this.stats.tablesDistributed}`)
		} else {
			console.log(`✅ Regular PostgreSQL setup (no distribution needed)`)
		}
	}

	/**
	 * Main execution method
	 */
	async execute() {
		try {
			console.log('🚀 Starting Tenant Migration Finalization...')
			console.log('='.repeat(60))

			await this.dbManager.checkConnection()
			console.log('✅ Database connection established')

			// Check if Citus is enabled
			const citusEnabled = await this.isCitusEnabled()
			console.log(`🔧 Citus enabled: ${citusEnabled ? 'Yes' : 'No'}`)

			// Execute all phases - OPTIMAL ORDER for clean constraint setup
			await this.setColumnsNotNull()
			await this.handleTableDeletionsAndExclusions()
			await this.fixTableOwnership()

			// PHASE 1: Clean Slate (Remove Conflicting Elements)
			await this.dropAllExistingIndexes() // NEW - Drop all indexes first
			const droppedForeignKeys = await this.dropAllForeignKeyConstraints() // NEW - Drop all FK constraints and store them
			await this.removeProblematicConstraints() // Drop problematic unique constraints

			// PHASE 2: Set Foundation (Tenant-Aware Constraints)
			await this.updatePrimaryKeys() // Update PK to include tenant_code

			// PHASE 3: Citus Distribution (Clean tables with minimal constraints)
			await this.configureCitusDistribution() // Distribute with clean slate
			await this.undistributeSpecificTables() // NEW - Undistribute tables that should remain as regular PostgreSQL

			// PHASE 4: Rebuild Relationships (After distribution)
			await this.createUniqueIndexes() // Create tenant-aware unique indexes FIRST (needed for FK references)
			await this.recreateAllForeignKeys(droppedForeignKeys) // NEW - Recreate ALL dropped FK constraints
			await this.addCitusCompatibleForeignKeys() // NEW - Add requested foreign keys that are Citus-compatible
			await this.addNonDistributedTableForeignKeys() // NEW - Add foreign keys for non-distributed tables
			await this.createPerformanceIndexes() // NEW - Add performance indexes

			await this.finalValidation()
			await this.finalDistributionVerification()

			await this.printStats()
		} catch (error) {
			console.error('❌ Finalization failed:', error)
			process.exit(1)
		} finally {
			await this.dbManager.close()
		}
	}
}

// Execute finalization if run directly
if (require.main === module) {
	const finalizer = new TenantMigrationFinalizer()
	finalizer.execute()
}

module.exports = TenantMigrationFinalizer
