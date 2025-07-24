const { Sequelize } = require('sequelize')
require('dotenv').config({ path: '.env' })

/**
 * Script for Tenant Code Migration
 * - Sets columns to NOT NULL
 * - Adds primary key constraints with tenant_code
 * - Adds foreign key relationships
 * - Configures Citus distribution
 */

class TenantMigrationFinalizer {
	constructor() {
		this.sequelize = new Sequelize(process.env.DEV_DATABASE_URL, {
			dialect: 'postgres',
			logging: false,
			pool: {
				max: 10,
				min: 2,
				acquire: 30000,
				idle: 10000,
			},
		})

		// Tables configuration from helper.js
		this.allTables = [
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
			'notification_templates',
			'organization_extension',
			'post_session_details',
			'question_sets',
			'questions',
			'report_queries',
			'reports',
			'resources',
			'role_extensions',
			'session_attendees',
			'session_request',
			'sessions',
			'user_extensions',
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
			const [result] = await this.sequelize.query(`
				SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'citus') as enabled
			`)
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
			const [result] = await this.sequelize.query(`
				SELECT COUNT(*) as count 
				FROM pg_dist_partition 
				WHERE logicalrelid = '${tableName}'::regclass
			`)
			return parseInt(result[0].count) > 0
		} catch (error) {
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
				const [tableInfo] = await this.sequelize.query(`
					SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'tenant_code') as has_tenant_code
				`)

				if (!tableInfo[0].table_exists || !tableInfo[0].has_tenant_code) {
					console.log(`⚠️  ${tableName} missing table or tenant_code column, skipping`)
					continue
				}

				// Check for NULL values
				const [nullCount] = await this.sequelize.query(`
					SELECT COUNT(*) as count FROM ${tableName} WHERE tenant_code IS NULL
				`)

				if (nullCount[0].count > 0) {
					console.log(`❌ ${tableName} has ${nullCount[0].count} NULL tenant_code values - backfill required`)
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
				const [tableInfo] = await this.sequelize.query(`
					SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'organization_code') as has_org_code
				`)

				if (!tableInfo[0].table_exists || !tableInfo[0].has_org_code) {
					console.log(`⚠️  ${tableName} missing table or organization_code column, skipping`)
					continue
				}

				// Check for NULL values
				const [nullCount] = await this.sequelize.query(`
					SELECT COUNT(*) as count FROM ${tableName} WHERE organization_code IS NULL
				`)

				if (nullCount[0].count > 0) {
					console.log(
						`❌ ${tableName} has ${nullCount[0].count} NULL organization_code values - backfill required`
					)
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
	 * Phase 2: Update primary key constraints
	 */
	async updatePrimaryKeys() {
		console.log('\n🔑 PHASE 2: Updating primary key constraints...')
		console.log('='.repeat(50))

		const primaryKeyConfigs = {
			connection_requests: 'tenant_code, user_id, friend_id',
			connections: 'tenant_code, user_id, friend_id',
			entities: 'tenant_code, id, entity_type_id',
			entity_types: 'tenant_code, id, organization_id',
			forms: 'tenant_code, id, organization_id',
			organization_extension: 'tenant_code, organization_id',
			user_extensions: 'tenant_code, user_id',
			question_sets: 'code, tenant_code',
			questions: 'id, tenant_code',
			report_queries: 'report_code, tenant_code',
			report_types: 'title, tenant_code',
			// Default for all other tables
			default: 'tenant_code, id',
		}

		for (const tableName of this.allTables) {
			try {
				// Check if table exists
				const [tableExists] = await this.sequelize.query(`
					SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}') as exists
				`)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${tableName} does not exist, skipping`)
					continue
				}

				// Drop existing primary key
				await this.sequelize.query(`
					ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${tableName}_pkey CASCADE
				`)

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
				table: 'entities',
				column: 'entity_type_id',
				refTable: 'entity_types',
				refColumn: 'id',
				name: 'fk_entities_entity_type_id',
			},
			{
				table: 'session_attendees',
				column: 'session_id',
				refTable: 'sessions',
				refColumn: 'id',
				name: 'fk_session_attendees_session_id',
			},
			{
				table: 'feedbacks',
				column: 'session_id',
				refTable: 'sessions',
				refColumn: 'id',
				name: 'fk_feedbacks_session_id',
			},
			{
				table: 'resources',
				column: 'session_id',
				refTable: 'sessions',
				refColumn: 'id',
				name: 'fk_resources_session_id',
			},
			{
				table: 'post_session_details',
				column: 'session_id',
				refTable: 'sessions',
				refColumn: 'id',
				name: 'fk_post_session_details_session_id',
			},
		]

		for (const fkConfig of foreignKeyConfigs) {
			try {
				// Check if both tables exist
				const [tablesExist] = await this.sequelize.query(`
					SELECT 
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fkConfig.table}') as table_exists,
						EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '${fkConfig.refTable}') as ref_table_exists,
						EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${fkConfig.table}' AND column_name = '${fkConfig.column}') as column_exists,
						EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = '${fkConfig.refTable}' AND column_name = '${fkConfig.refColumn}') as ref_column_exists
				`)

				if (
					!tablesExist[0].table_exists ||
					!tablesExist[0].ref_table_exists ||
					!tablesExist[0].column_exists ||
					!tablesExist[0].ref_column_exists
				) {
					console.log(`⚠️  Missing table/column for FK ${fkConfig.name}, skipping`)
					continue
				}

				// Check if constraint already exists
				const [constraintExists] = await this.sequelize.query(`
					SELECT EXISTS (
						SELECT 1 FROM information_schema.table_constraints 
						WHERE table_name = '${fkConfig.table}' 
						AND constraint_name = '${fkConfig.name}'
						AND constraint_type = 'FOREIGN KEY'
					) as exists
				`)

				if (constraintExists[0].exists) {
					console.log(`✅ FK ${fkConfig.name} already exists`)
					continue
				}

				// Add foreign key constraint
				await this.sequelize.query(`
					ALTER TABLE ${fkConfig.table} 
					ADD CONSTRAINT ${fkConfig.name} 
					FOREIGN KEY (${fkConfig.column}) 
					REFERENCES ${fkConfig.refTable}(${fkConfig.refColumn}) 
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
	 * Phase 4: Configure Citus distribution (only if Citus is enabled)
	 */
	async configureCitusDistribution() {
		const citusEnabled = await this.isCitusEnabled()

		if (!citusEnabled) {
			console.log('\n⚠️  PHASE 4 SKIPPED: Citus not enabled, using regular PostgreSQL')
			console.log('✅ Tables remain as regular PostgreSQL tables (no distribution needed)')
			return
		}

		console.log('\n🔄 PHASE 4: Configuring Citus distribution...')
		console.log('='.repeat(50))
		console.log('🔧 Citus detected - distributing tables with tenant_code as partition key')

		for (const tableName of this.allTables) {
			try {
				// Check if table exists
				const [tableExists] = await this.sequelize.query(`
					SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}') as exists
				`)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${tableName} does not exist, skipping`)
					continue
				}

				// Check if already distributed
				const isDistributed = await this.isTableDistributed(tableName)
				if (isDistributed) {
					console.log(`✅ Table ${tableName} already distributed`)
					this.stats.tablesDistributed++
					continue
				}

				// Distribute table with tenant_code as partition key
				await this.sequelize.query(`
					SELECT create_distributed_table('${tableName}', 'tenant_code')
				`)

				console.log(`✅ Distributed table: ${tableName}`)
				this.stats.tablesDistributed++
			} catch (error) {
				console.log(`❌ Error distributing ${tableName}: ${error.message}`)
				// Continue with other tables even if one fails
			}
		}

		console.log(`✅ Citus distribution complete: ${this.stats.tablesDistributed} tables distributed`)
	}

	/**
	 * Phase 5: Create unique indexes
	 */
	async createUniqueIndexes() {
		console.log('\n📊 PHASE 5: Creating unique indexes...')
		console.log('='.repeat(50))

		const indexConfigs = [
			{
				table: 'connections',
				name: 'unique_user_friend_tenant_connections',
				columns: 'tenant_code, user_id, friend_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'connection_requests',
				name: 'unique_user_friend_tenant_connection_requests',
				columns: 'tenant_code, user_id, friend_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'entities',
				name: 'unique_entities_value_tenant',
				columns: 'tenant_code, value, entity_type_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'entity_types',
				name: 'unique_entity_types_value_org_tenant',
				columns: 'tenant_code, value, organization_id',
				condition: 'WHERE deleted_at IS NULL',
			},
			{
				table: 'forms',
				name: 'unique_forms_type_subtype_org_tenant',
				columns: 'tenant_code, type, sub_type, organization_id',
				condition: 'WHERE deleted_at IS NULL',
			},
		]

		for (const indexConfig of indexConfigs) {
			try {
				// Check if table exists
				const [tableExists] = await this.sequelize.query(`
					SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${indexConfig.table}') as exists
				`)

				if (!tableExists[0].exists) {
					console.log(`⚠️  Table ${indexConfig.table} does not exist, skipping index`)
					continue
				}

				// Check if index already exists
				const [indexExists] = await this.sequelize.query(`
					SELECT EXISTS (
						SELECT 1 FROM pg_indexes 
						WHERE tablename = '${indexConfig.table}' 
						AND indexname = '${indexConfig.name}'
					) as exists
				`)

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
	 * Phase 6: Final validation
	 */
	async finalValidation() {
		console.log('\n📊 PHASE 6: Final validation...')
		console.log('='.repeat(50))

		// Check NOT NULL constraints
		for (const tableName of this.allTables) {
			try {
				const [nullCheck] = await this.sequelize.query(`
					SELECT COUNT(*) as null_count 
					FROM ${tableName} 
					WHERE tenant_code IS NULL
				`)

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
		const [primaryKeyCount] = await this.sequelize.query(`
			SELECT COUNT(*) as count 
			FROM information_schema.table_constraints 
			WHERE table_schema = 'public' 
			AND constraint_type = 'PRIMARY KEY'
			AND table_name IN ('${this.allTables.join("','")}')
		`)

		console.log(`✅ Primary keys configured: ${primaryKeyCount[0].count}/${this.allTables.length}`)

		// Check foreign keys
		const [foreignKeyCount] = await this.sequelize.query(`
			SELECT COUNT(*) as count 
			FROM information_schema.table_constraints 
			WHERE table_schema = 'public' 
			AND constraint_type = 'FOREIGN KEY'
			AND constraint_name LIKE 'fk_%'
		`)

		console.log(`✅ Foreign keys created: ${foreignKeyCount[0].count}`)

		// Check Citus distribution (only if Citus is enabled)
		const citusEnabled = await this.isCitusEnabled()
		if (citusEnabled) {
			const [distributedCount] = await this.sequelize.query(`
				SELECT COUNT(*) as count FROM pg_dist_partition
			`)
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

			await this.sequelize.authenticate()
			console.log('✅ Database connection established')

			// Check if Citus is enabled
			const citusEnabled = await this.isCitusEnabled()
			console.log(`🔧 Citus enabled: ${citusEnabled ? 'Yes' : 'No'}`)

			// Execute all phases
			await this.setColumnsNotNull()
			await this.updatePrimaryKeys()
			await this.addForeignKeys()
			await this.configureCitusDistribution()
			await this.createUniqueIndexes()
			await this.finalValidation()

			await this.printStats()
		} catch (error) {
			console.error('❌ Finalization failed:', error)
			process.exit(1)
		} finally {
			await this.sequelize.close()
		}
	}
}

// Execute finalization if run directly
if (require.main === module) {
	const finalizer = new TenantMigrationFinalizer()
	finalizer.execute()
}

module.exports = TenantMigrationFinalizer
