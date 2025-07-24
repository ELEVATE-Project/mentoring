const { Sequelize } = require('sequelize')
const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')
require('dotenv').config({ path: '../.env' })

/**
 * Simplified Data Migration Script for Mentoring Service
 * - Uses CSV lookup data directly (no temp tables)
 * - Consolidated batch processing
 * - Removes unnecessary code
 */

class MentoringDataMigrator {
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

		// Centralized batch processing configuration
		this.BATCH_SIZE = 5000

		// Data cache for CSV lookup
		this.orgLookupCache = new Map()

		// Processing statistics
		this.stats = {
			totalProcessed: 0,
			successfulUpdates: 0,
			failedUpdates: 0,
			tablesUndistributed: 0,
			tablesRedistributed: 0,
			startTime: Date.now(),
		}

		// Tables with organization_id - process using CSV lookup
		this.tablesWithOrgId = [
			{
				name: 'availabilities',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'default_rules',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'entity_types',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'file_uploads',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'forms',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'notification_templates',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'organization_extension',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'report_queries',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'reports',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'role_extensions',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
		]

		// Tables with user_id - process using user_extensions with inner joins
		this.tablesWithUserId = [
			{
				name: 'user_extensions',
				userIdColumn: 'user_id',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'sessions',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'session_attendees',
				userIdColumn: 'mentee_id',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'feedbacks',
				userIdColumn: 'user_id',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'connection_requests',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'connections',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'entities',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'issues',
				userIdColumn: 'user_id',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'resources',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'session_request',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
			},
			{
				name: 'question_sets',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'questions',
				userIdColumn: 'created_by',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
			},
			{
				name: 'post_session_details',
				sessionIdColumn: 'session_id',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
				useSessionLookup: true,
			},
		]
	}

	/**
	 * Load lookup data from CSV file
	 */
	async loadLookupData() {
		console.log('🔄 Loading lookup data from data_codes.csv...')

		try {
			await this.loadTenantAndOrgCsv()

			console.log(`✅ Loaded lookup data:`)
			console.log(`   - Organization codes: ${this.orgLookupCache.size}`)

			if (this.orgLookupCache.size === 0) {
				console.log('⚠️  No CSV data loaded, using defaults')
			}
		} catch (error) {
			console.error('❌ Failed to load lookup data:', error)
			throw error
		}
	}

	/**
	 * Validate that all organization_ids from organization_extension table exist in the CSV file
	 * Fails the migration if any organization_extension organization_ids are missing from CSV
	 */
	async validateDatabaseOrgsCoveredByCSV() {
		console.log('\n🔍 Validating organization_extension organization_ids coverage in CSV...')

		const missingOrgs = new Set()
		const csvOrgIds = new Set(this.orgLookupCache.keys())

		// Only get organization_ids from organization_extension table (source of truth)
		try {
			// Check if organization_extension table exists first
			const tableExists = await this.sequelize.query(
				`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'organization_extension')`,
				{ type: Sequelize.QueryTypes.SELECT }
			)

			if (!tableExists[0].exists) {
				throw new Error('organization_extension table does not exist')
			}

			// Get distinct organization_ids from organization_extension table only
			const orgResults = await this.sequelize.query(
				`SELECT DISTINCT organization_id::text as org_id
				 FROM organization_extension
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

			console.log(`✅ Checked organization_extension: ${orgResults.length} distinct organization_ids`)
		} catch (error) {
			console.error(`❌ Failed to check organization_extension: ${error.message}`)
			throw error
		}

		// Report results
		if (missingOrgs.size > 0) {
			const missingOrgsList = Array.from(missingOrgs).sort()
			console.error('\n❌ VALIDATION FAILED: Missing organization_ids in CSV')
			console.error('='.repeat(60))
			console.error(
				`Found ${missingOrgs.size} organization_ids from organization_extension table that are missing from CSV:`
			)
			missingOrgsList.forEach((orgId) => {
				console.error(`   - organization_id: ${orgId}`)
			})
			console.error('\n📝 Required action:')
			console.error(
				'   - Add missing organization_ids to data_codes.csv with proper tenant_code and organization_code'
			)
			console.error(
				'   - Or verify if these organization_ids should be removed from organization_extension table'
			)

			throw new Error(
				`Migration cannot proceed: ${missingOrgs.size} organization_ids from organization_extension missing from CSV. See details above.`
			)
		}

		console.log('✅ Validation passed: All organization_extension organization_ids are covered in CSV')
	}

	async loadTenantAndOrgCsv() {
		const csvPath = path.join(__dirname, '../data/data_codes.csv')
		if (!fs.existsSync(csvPath)) {
			console.log('⚠️  data_codes.csv not found, using defaults')
			return
		}

		// Get organization_ids only from organization_extension table (source of truth)
		console.log('🔍 Getting organization_ids from organization_extension table...')
		const orgExtensionIds = await this.sequelize.query(
			`SELECT DISTINCT organization_id::text as org_id FROM organization_extension WHERE organization_id IS NOT NULL`,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		const validOrgIds = new Set(orgExtensionIds.map((row) => row.org_id))
		console.log(`📊 Found ${validOrgIds.size} organization_ids in organization_extension table`)

		const requiredHeaders = ['tenant_code', 'organization_code', 'organization_id']
		let isHeaderValidated = false

		return new Promise((resolve, reject) => {
			fs.createReadStream(csvPath)
				.pipe(csv())
				.on('headers', (headers) => {
					console.log('📋 CSV Headers found:', headers)

					const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header))
					if (missingHeaders.length > 0) {
						reject(
							new Error(
								`❌ Missing required CSV headers: ${missingHeaders.join(
									', '
								)}. Required headers: ${requiredHeaders.join(', ')}`
							)
						)
						return
					}

					console.log('✅ CSV headers validation passed')
					isHeaderValidated = true
				})
				.on('data', (row) => {
					if (!isHeaderValidated) return

					// Only load CSV data for organization_ids that exist in organization_extension table
					if (
						row.organization_id &&
						row.organization_code &&
						row.tenant_code &&
						validOrgIds.has(row.organization_id)
					) {
						this.orgLookupCache.set(row.organization_id, {
							organization_code: row.organization_code,
							tenant_code: row.tenant_code,
						})
					} else if (row.organization_id && !validOrgIds.has(row.organization_id)) {
						console.log(
							`ℹ️  Skipping CSV row for organization_id ${row.organization_id} - not found in organization_extension table`
						)
					} else {
						console.warn('⚠️  Skipping invalid CSV row:', row)
					}
				})
				.on('end', () => {
					if (!isHeaderValidated) {
						reject(new Error('❌ CSV headers could not be validated'))
						return
					}
					console.log(
						`✅ Loaded ${this.orgLookupCache.size} organization codes (filtered by organization_extension table)`
					)
					resolve()
				})
				.on('error', reject)
		})
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
	 * Undistribute a table temporarily for updates
	 */
	async undistributeTable(tableName) {
		try {
			const isDistributed = await this.isTableDistributed(tableName)
			if (isDistributed) {
				await this.sequelize.query(`SELECT undistribute_table('${tableName}')`)
				console.log(`✅ Undistributed table: ${tableName}`)
				this.stats.tablesUndistributed++
				return true
			}
			return false
		} catch (error) {
			console.log(`⚠️  Could not undistribute ${tableName}: ${error.message}`)
			return false
		}
	}

	/**
	 * Redistribute table after updates
	 */
	async redistributeTable(tableName) {
		try {
			await this.sequelize.query(`SELECT create_distributed_table('${tableName}', 'tenant_code')`)
			console.log(`✅ Redistributed table: ${tableName}`)
			this.stats.tablesRedistributed++
			return true
		} catch (error) {
			console.log(`⚠️  Could not redistribute ${tableName}: ${error.message}`)
			return false
		}
	}

	/**
	 * Helper method to undistribute table if needed
	 */
	async undistributeTableIfNeeded(tableName) {
		const isDistributed = await this.isTableDistributed(tableName)
		if (isDistributed) {
			console.log(`✅ Undistributed table: ${tableName}`)
			await this.sequelize.query(`SELECT undistribute_table('${tableName}')`)
			this.stats.tablesUndistributed++
			return true
		}
		return false
	}

	/**
	 * Helper method to redistribute table if needed (only if Citus is enabled)
	 */
	async redistributeTableIfNeeded(tableName, partitionKey = 'tenant_code', shouldDistribute = true) {
		const citusEnabled = await this.isCitusEnabled()

		if (!citusEnabled) {
			console.log(`✅ Skipping distribution for ${tableName} - Citus not enabled`)
			return false
		}

		if (shouldDistribute) {
			const isDistributed = await this.isTableDistributed(tableName)
			if (!isDistributed) {
				console.log(`✅ Redistributed table: ${tableName} with ${partitionKey}`)
				await this.sequelize.query(`SELECT create_distributed_table('${tableName}', '${partitionKey}')`)
				this.stats.tablesRedistributed++
				return true
			}
		}
		return false
	}

	/**
	 * Process tables with organization_id using CSV lookup
	 */
	async processTablesWithOrgId() {
		console.log('\n🔄 PHASE 1: Processing tables with organization_id using CSV lookup...')
		console.log('='.repeat(70))

		for (const tableConfig of this.tablesWithOrgId) {
			await this.processTableWithOrgId(tableConfig)
		}
	}

	/**
	 * Process a single table with organization_id using CSV lookup
	 */
	async processTableWithOrgId(tableConfig) {
		const { name, updateColumns, hasPartitionKey } = tableConfig
		console.log(`\n🔄 Processing table with organization_id: ${name}`)

		try {
			// Check if table exists and has target columns
			const existingColumns = await this.checkTableColumns(name)
			const availableUpdateColumns = updateColumns.filter((col) => existingColumns.includes(col))

			if (availableUpdateColumns.length === 0) {
				console.log(`⚠️  Table ${name} has no target columns, skipping`)
				return
			}

			console.log(`📋 Available columns for update: ${availableUpdateColumns.join(', ')}`)

			// Check if we need to update tenant_code (partition key)
			const needsTenantCodeUpdate = availableUpdateColumns.includes('tenant_code')
			const citusEnabled = await this.isCitusEnabled()

			// Undistribute table if needed
			let wasDistributed = false
			if (citusEnabled && hasPartitionKey && needsTenantCodeUpdate) {
				wasDistributed = await this.undistributeTable(name)
			}

			try {
				// Process using CSV lookup data
				await this.processOrgIdTableWithCSV(name, availableUpdateColumns)

				// Redistribute if needed
				if (citusEnabled && wasDistributed && needsTenantCodeUpdate) {
					await this.redistributeTable(name)
				}
			} catch (error) {
				console.error(`❌ Error updating table ${name}:`, error)
				if (citusEnabled && wasDistributed && needsTenantCodeUpdate) {
					await this.redistributeTable(name)
				}
				throw error
			}

			console.log(`✅ Completed ${name}`)
		} catch (error) {
			console.error(`❌ Error processing table ${name}:`, error)
			throw error
		}
	}

	/**
	 * Process organization_id table using individual organization updates
	 */
	async processOrgIdTableWithCSV(tableName, availableUpdateColumns) {
		console.log(`📊 Processing ${tableName} using individual organization updates...`)

		let totalUpdated = 0
		try {
			totalUpdated = await this.processOrgIdTable(tableName, availableUpdateColumns)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using individual updates`)
		} catch (error) {
			console.error(`❌ Failed to process ${tableName}:`, error.message)
			this.stats.failedUpdates++
			throw error
		}

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * Process table with organization_id using individual organization updates
	 */
	async processOrgIdTable(tableName, availableUpdateColumns) {
		console.log(`🔄 Processing ${tableName} with individual organization updates...`)

		// Get distinct organization_ids from table
		const [orgList] = await this.sequelize.query(`
			SELECT DISTINCT organization_id::text as organization_id 
			FROM ${tableName} 
			WHERE organization_id IS NOT NULL 
			ORDER BY organization_id
		`)

		console.log(`🔄 Processing ${tableName} with ${orgList.length} organizations individually`)
		let totalUpdated = 0

		const transaction = await this.sequelize.transaction()

		try {
			// Process organizations in batches
			for (let i = 0; i < orgList.length; i += this.BATCH_SIZE) {
				const orgBatch = orgList.slice(i, i + this.BATCH_SIZE)

				// Process each organization using CSV data
				for (const org of orgBatch) {
					const orgData = this.orgLookupCache.get(org.organization_id)
					if (!orgData) {
						console.warn(`⚠️  No CSV data for organization_id: ${org.organization_id}`)
						continue
					}

					// Build SET clause with CSV data
					const setClauses = []
					if (availableUpdateColumns.includes('tenant_code')) {
						setClauses.push(`tenant_code = '${orgData.tenant_code}'`)
					}
					if (availableUpdateColumns.includes('organization_code')) {
						setClauses.push(`organization_code = '${orgData.organization_code}'`)
					}
					setClauses.push('updated_at = NOW()')

					const [, metadata] = await this.sequelize.query(
						`
						UPDATE ${tableName} 
						SET ${setClauses.join(', ')}
						WHERE organization_id::text = '${org.organization_id}'
					`,
						{ transaction }
					)

					totalUpdated += metadata.rowCount || 0
				}
			}

			await transaction.commit()
			return totalUpdated
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	}

	/**
	 * Process tables with user_id using inner joins
	 */
	async processTablesWithUserId() {
		console.log('\n🔄 PHASE 2: Processing tables with user_id using inner joins...')
		console.log('='.repeat(70))

		// First process user_extensions
		const userExtConfig = this.tablesWithUserId.find((t) => t.name === 'user_extensions')
		if (userExtConfig) {
			await this.processUserExtensions(userExtConfig)
		}

		// Then process other tables
		for (const tableConfig of this.tablesWithUserId) {
			if (tableConfig.name !== 'user_extensions') {
				await this.processTableWithUserId(tableConfig)
			}
		}
	}

	/**
	 * Process user_extensions using individual organization updates
	 */
	async processUserExtensions(tableConfig) {
		console.log(`\n🔄 Processing user_extensions using individual organization updates...`)

		// Undistribute table first if it's distributed
		await this.undistributeTableIfNeeded('user_extensions')

		let totalUpdated = 0
		try {
			totalUpdated = await this.processUserExtensionsIndividually()
			console.log(`✅ Updated ${totalUpdated} user_extensions using individual updates`)
		} catch (error) {
			console.error(`❌ Failed to process user_extensions:`, error.message)
			this.stats.failedUpdates++
			throw error
		}

		// Redistribute table with tenant_code as partition key
		await this.redistributeTableIfNeeded('user_extensions', 'tenant_code', tableConfig.hasPartitionKey)

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * Individual processing for user_extensions (fallback)
	 */
	async processUserExtensionsIndividually() {
		console.log(`🔄 Processing user_extensions individually...`)

		// Get distinct organization_ids from user_extensions
		const [orgResults] = await this.sequelize.query(`
			SELECT DISTINCT organization_id::text as org_id
			FROM user_extensions
			WHERE organization_id IS NOT NULL
			ORDER BY org_id
		`)

		console.log(`🔄 Processing user_extensions with ${orgResults.length} organizations individually`)

		if (orgResults.length === 0) {
			console.log(`⚠️  No organizations found in user_extensions`)
			return 0
		}

		const transaction = await this.sequelize.transaction()
		let totalUpdated = 0

		try {
			// Process organizations in batches
			for (let i = 0; i < orgResults.length; i += this.BATCH_SIZE) {
				const orgBatch = orgResults.slice(i, i + this.BATCH_SIZE)

				for (const org of orgBatch) {
					const orgData = this.orgLookupCache.get(org.org_id)
					if (!orgData) {
						console.warn(`⚠️  No CSV data for organization_id: ${org.org_id}`)
						continue
					}

					const [, metadata] = await this.sequelize.query(
						`
						UPDATE user_extensions 
						SET 
							tenant_code = '${orgData.tenant_code}',
							organization_code = '${orgData.organization_code}',
							updated_at = NOW()
						WHERE organization_id::text = '${org.org_id}'
					`,
						{ transaction }
					)

					totalUpdated += metadata.rowCount || 0
				}
			}

			await transaction.commit()
			return totalUpdated
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	}

	/**
	 * Process table with user_id using inner joins and CSV lookup
	 */
	async processTableWithUserId(tableConfig) {
		const { name, updateColumns, hasPartitionKey, useSessionLookup } = tableConfig
		console.log(`\n🔄 Processing table with user_id: ${name}`)

		try {
			// Check if table exists and has target columns
			const existingColumns = await this.checkTableColumns(name)
			const availableUpdateColumns = updateColumns.filter((col) => existingColumns.includes(col))

			if (availableUpdateColumns.length === 0) {
				console.log(`⚠️  Table ${name} has no target columns, skipping`)
				return
			}

			// Handle Citus undistribution
			const citusEnabled = await this.isCitusEnabled()
			let wasDistributed = false
			if (citusEnabled && hasPartitionKey && availableUpdateColumns.includes('tenant_code')) {
				wasDistributed = await this.undistributeTable(name)
			}

			try {
				if (useSessionLookup) {
					await this.processSessionLookupTable(name, tableConfig)
				} else {
					await this.processUserIdTable(name, tableConfig)
				}

				// Redistribute if needed
				if (citusEnabled && wasDistributed) {
					await this.redistributeTable(name)
				}
			} catch (error) {
				console.error(`❌ Error during updates for ${name}:`, error.message)
				throw error
			}

			console.log(`✅ Completed ${name}`)
		} catch (error) {
			console.error(`❌ Error processing table ${name}:`, error)
			throw error
		}
	}

	/**
	 * Process table that needs session lookup (post_session_details)
	 * Uses individual organization updates
	 */
	async processSessionLookupTable(tableName, tableConfig) {
		const sessionIdColumn = tableConfig.sessionIdColumn
		console.log(`🔄 Processing ${tableName} using individual organization updates...`)

		let totalUpdated = 0
		try {
			totalUpdated = await this.processSessionLookupIndividually(tableName, tableConfig)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using individual updates`)
		} catch (error) {
			console.error(`❌ Failed to process ${tableName}:`, error.message)
			this.stats.failedUpdates++
			throw error
		}

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * Individual processing for session lookup tables (fallback)
	 */
	async processSessionLookupIndividually(tableName, tableConfig) {
		const sessionIdColumn = tableConfig.sessionIdColumn

		// Inner join: post_session_details -> sessions -> user_extensions, group by organization_id
		const [sessionOrgs] = await this.sequelize.query(`
			SELECT DISTINCT ue.organization_id::text as org_id
			FROM ${tableName} psd
			INNER JOIN sessions s ON psd.${sessionIdColumn} = s.id
			INNER JOIN user_extensions ue ON ue.user_id = s.created_by
			WHERE ue.organization_id IS NOT NULL
			ORDER BY org_id
		`)

		console.log(`🔄 Processing ${tableName} with ${sessionOrgs.length} organizations individually`)

		const transaction = await this.sequelize.transaction()
		let totalUpdated = 0

		try {
			// Process organizations in batches
			for (let i = 0; i < sessionOrgs.length; i += this.BATCH_SIZE) {
				const orgBatch = sessionOrgs.slice(i, i + this.BATCH_SIZE)

				for (const org of orgBatch) {
					const orgData = this.orgLookupCache.get(org.org_id)
					if (!orgData) continue

					// Build SET clause using CSV data
					const setClauses = []
					if (tableConfig.updateColumns.includes('tenant_code')) {
						setClauses.push(`tenant_code = '${orgData.tenant_code}'`)
					}
					if (tableConfig.updateColumns.includes('organization_code')) {
						setClauses.push(`organization_code = '${orgData.organization_code}'`)
					}
					setClauses.push('updated_at = NOW()')

					const [, metadata] = await this.sequelize.query(
						`
						UPDATE ${tableName} 
						SET ${setClauses.join(', ')}
						FROM sessions s, user_extensions ue
						WHERE ${tableName}.${sessionIdColumn} = s.id
						AND ue.user_id = s.created_by
						AND ue.organization_id::text = '${org.org_id}'
					`,
						{ transaction }
					)

					totalUpdated += metadata.rowCount || 0
				}
			}

			await transaction.commit()
			return totalUpdated
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	}

	/**
	 * Process table with user_id using individual organization updates
	 */
	async processUserIdTable(tableName, tableConfig) {
		const userIdColumn = tableConfig.userIdColumn
		console.log(`🔄 Processing ${tableName} using individual organization updates...`)

		let totalUpdated = 0
		try {
			totalUpdated = await this.processUserIdTableIndividually(tableName, tableConfig)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using individual updates`)
		} catch (error) {
			console.error(`❌ Failed to process ${tableName}:`, error.message)
			this.stats.failedUpdates++
			throw error
		}

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * Individual processing for user_id tables (fallback)
	 */
	async processUserIdTableIndividually(tableName, tableConfig) {
		const userIdColumn = tableConfig.userIdColumn

		// Inner join with user_extensions, group by organization_id
		const [userExtByOrg] = await this.sequelize.query(`
			SELECT DISTINCT ue.organization_id::text as org_id
			FROM user_extensions ue
			INNER JOIN ${tableName} t ON t.${userIdColumn} = ue.user_id
			WHERE ue.organization_id IS NOT NULL
			ORDER BY org_id
		`)

		console.log(`🔄 Processing ${tableName} with ${userExtByOrg.length} organizations individually`)

		if (userExtByOrg.length === 0) {
			console.log(`⚠️  No organizations found for ${tableName}`)
			return 0
		}

		const transaction = await this.sequelize.transaction()
		let totalUpdated = 0

		try {
			// Process each organization in batches
			for (let i = 0; i < userExtByOrg.length; i += this.BATCH_SIZE) {
				const orgBatch = userExtByOrg.slice(i, i + this.BATCH_SIZE)

				for (const org of orgBatch) {
					const orgData = this.orgLookupCache.get(org.org_id)
					if (!orgData) continue

					// Build SET clause using CSV lookup data
					const setClauses = []
					if (tableConfig.updateColumns.includes('tenant_code')) {
						setClauses.push(`tenant_code = '${orgData.tenant_code}'`)
					}
					if (tableConfig.updateColumns.includes('organization_code')) {
						setClauses.push(`organization_code = '${orgData.organization_code}'`)
					}
					setClauses.push('updated_at = NOW()')

					const [, metadata] = await this.sequelize.query(
						`
						UPDATE ${tableName} 
						SET ${setClauses.join(', ')}
						FROM user_extensions ue
						WHERE ${tableName}.${userIdColumn} = ue.user_id
						AND ue.organization_id::text = '${org.org_id}'
					`,
						{ transaction }
					)

					totalUpdated += metadata.rowCount || 0
				}
			}

			await transaction.commit()
			return totalUpdated
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	}

	/**
	 * Check table columns
	 */
	async checkTableColumns(tableName) {
		try {
			const [columns] = await this.sequelize.query(`
				SELECT column_name 
				FROM information_schema.columns 
				WHERE table_name = '${tableName}' 
				AND table_schema = 'public'
			`)
			return columns.map((col) => col.column_name)
		} catch (error) {
			return []
		}
	}

	/**
	 * Handle Citus distribution
	 */
	async handleCitusDistribution() {
		console.log('\n🔄 PHASE 3: Handling Citus distribution...')
		console.log('='.repeat(70))

		const allTables = [...this.tablesWithOrgId, ...this.tablesWithUserId]
		let distributedCount = 0

		for (const tableConfig of allTables) {
			const { name, hasPartitionKey } = tableConfig

			if (hasPartitionKey) {
				try {
					const isDistributed = await this.isTableDistributed(name)

					if (!isDistributed) {
						await this.redistributeTable(name)
						distributedCount++
					} else {
						console.log(`✅ Table ${name} already distributed`)
					}
				} catch (error) {
					console.log(`⚠️  Could not distribute ${name}: ${error.message}`)
				}
			}
		}

		console.log(`✅ Distribution complete: ${distributedCount} tables redistributed`)
	}

	/**
	 * Print final statistics
	 */
	printStats() {
		const duration = Math.round((Date.now() - this.stats.startTime) / 1000)
		const minutes = Math.floor(duration / 60)
		const seconds = duration % 60

		console.log('\n🎯 MIGRATION COMPLETED!')
		console.log('='.repeat(50))
		console.log(`⏱️  Duration: ${minutes}m ${seconds}s`)
		console.log(`✅ Successful updates: ${this.stats.successfulUpdates.toLocaleString()}`)
		console.log(`❌ Failed updates: ${this.stats.failedUpdates.toLocaleString()}`)
		console.log(`🔄 Tables undistributed: ${this.stats.tablesUndistributed}`)
		console.log(`🔄 Tables redistributed: ${this.stats.tablesRedistributed}`)
	}

	/**
	 * Main execution method
	 */
	async execute() {
		try {
			console.log('🚀 Starting Simplified Data Migration...')
			console.log('='.repeat(60))

			await this.sequelize.authenticate()
			console.log('✅ Database connection established')

			// Check if Citus is enabled
			const citusEnabled = await this.isCitusEnabled()
			console.log(`🔧 Citus enabled: ${citusEnabled ? 'Yes' : 'No'}`)

			await this.loadLookupData()

			// Validate CSV data coverage before proceeding
			await this.validateDatabaseOrgsCoveredByCSV()

			// PHASE 1: Process tables with organization_id using CSV lookup
			await this.processTablesWithOrgId()

			// PHASE 2: Process tables with user_id using inner joins and CSV lookup
			await this.processTablesWithUserId()

			// PHASE 3: Handle Citus distribution if enabled
			if (citusEnabled) {
				await this.handleCitusDistribution()
			} else {
				console.log('\n⚠️  Citus not enabled, skipping distribution logic')
			}

			this.printStats()
		} catch (error) {
			console.error('❌ Migration failed:', error)
			process.exit(1)
		} finally {
			await this.sequelize.close()
		}
	}
}

// Execute migration if run directly
if (require.main === module) {
	const migrator = new MentoringDataMigrator()
	migrator.execute()
}

module.exports = MentoringDataMigrator
