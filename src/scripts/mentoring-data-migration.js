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
 * - Follows Rakesh's PR comments
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

		// Default values from environment
		this.defaultTenantCode = process.env.DEFAULT_ORGANISATION_CODE || 'DEFAULT_TENANT'
		this.defaultOrgCode = process.env.DEFAULT_ORG_CODE || 'DEFAULT_ORG'
		this.defaultOrgId = process.env.DEFAULT_ORG_ID || '1'

		// Centralized batch processing configuration
		this.BATCH_SIZE = 5000
		this.maxRetries = 3
		this.retryDelay = 2000

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
			{
				name: 'modules',
				updateColumns: ['tenant_code'],
				hasPartitionKey: true,
				useDefaultValues: true,
			},
			{
				name: 'report_role_mapping',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
				useDefaultValues: true,
			},
			{
				name: 'report_types',
				updateColumns: ['tenant_code', 'organization_code'],
				hasPartitionKey: true,
				useDefaultValues: true,
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

	async loadTenantAndOrgCsv() {
		const csvPath = path.join(__dirname, '../data/data_codes.csv')
		if (!fs.existsSync(csvPath)) {
			console.log('⚠️  data_codes.csv not found, using defaults')
			return
		}

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

					if (row.organization_id && row.organization_code && row.tenant_code) {
						this.orgLookupCache.set(row.organization_id, {
							organization_code: row.organization_code,
							tenant_code: row.tenant_code,
						})
					} else {
						console.warn('⚠️  Skipping invalid row:', row)
					}
				})
				.on('end', () => {
					if (!isHeaderValidated) {
						reject(new Error('❌ CSV headers could not be validated'))
						return
					}
					console.log(`✅ Loaded ${this.orgLookupCache.size} organization codes`)
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
	 * Helper method to redistribute table if needed
	 */
	async redistributeTableIfNeeded(tableName, partitionKey = 'tenant_code', shouldDistribute = true) {
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
	 * Process organization_id table using GROUP BY + CSV lookup hybrid approach
	 */
	async processOrgIdTableWithCSV(tableName, availableUpdateColumns) {
		console.log(`📊 Processing ${tableName} using GROUP BY + CSV lookup hybrid...`)

		// Strategy 1: Try GROUP BY bulk update with CSV data (most efficient)
		let totalUpdated = 0
		try {
			totalUpdated = await this.processOrgIdTableWithGroupBy(tableName, availableUpdateColumns)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using GROUP BY + CSV`)
		} catch (error) {
			console.warn(
				`⚠️  GROUP BY approach failed for ${tableName}, falling back to individual updates:`,
				error.message
			)
			// Strategy 2: Fallback to individual org processing
			totalUpdated = await this.processOrgIdTableIndividually(tableName, availableUpdateColumns)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using individual updates`)
		}

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * Strategy 1: GROUP BY bulk update with CSV data injection
	 */
	async processOrgIdTableWithGroupBy(tableName, availableUpdateColumns) {
		console.log(`🚀 Attempting GROUP BY bulk update for ${tableName}...`)

		const transaction = await this.sequelize.transaction()
		let totalUpdated = 0

		try {
			// Build VALUES clause from CSV data for efficient JOIN
			const csvValues = Array.from(this.orgLookupCache.entries())
				.map(([orgId, data]) => `('${orgId}', '${data.tenant_code}', '${data.organization_code}')`)
				.join(', ')

			if (csvValues.length === 0) {
				throw new Error('No CSV data available for bulk update')
			}

			// Build SET clause
			const setClauses = []
			if (availableUpdateColumns.includes('tenant_code')) {
				setClauses.push('tenant_code = csv_data.tenant_code')
			}
			if (availableUpdateColumns.includes('organization_code')) {
				setClauses.push('organization_code = csv_data.organization_code')
			}
			setClauses.push('updated_at = NOW()')

			// Execute GROUP BY bulk update with CSV data
			const [, metadata] = await this.sequelize.query(
				`
				UPDATE ${tableName}
				SET ${setClauses.join(', ')}
				FROM (
					VALUES ${csvValues}
				) AS csv_data(organization_id, tenant_code, organization_code)
				WHERE ${tableName}.organization_id::text = csv_data.organization_id
			`,
				{ transaction }
			)

			totalUpdated = metadata.rowCount || 0
			await transaction.commit()
			return totalUpdated
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	}

	/**
	 * Strategy 2: Individual organization processing (fallback)
	 */
	async processOrgIdTableIndividually(tableName, availableUpdateColumns) {
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
	 * Process user_extensions using GROUP BY + CSV lookup hybrid
	 */
	async processUserExtensions(tableConfig) {
		console.log(`\n🔄 Processing user_extensions using GROUP BY + CSV hybrid...`)

		// Undistribute table first if it's distributed
		await this.undistributeTableIfNeeded('user_extensions')

		// Strategy 1: Try GROUP BY bulk update first
		let totalUpdated = 0
		try {
			totalUpdated = await this.processUserExtensionsWithGroupBy()
			console.log(`✅ Updated ${totalUpdated} user_extensions using GROUP BY + CSV`)
		} catch (error) {
			console.warn(`⚠️  GROUP BY failed for user_extensions, using individual updates:`, error.message)
			// Strategy 2: Fallback to individual processing
			totalUpdated = await this.processUserExtensionsIndividually()
			console.log(`✅ Updated ${totalUpdated} user_extensions using individual updates`)
		}

		// Redistribute table with tenant_code as partition key
		await this.redistributeTableIfNeeded('user_extensions', 'tenant_code', tableConfig.hasPartitionKey)

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * GROUP BY bulk update for user_extensions
	 */
	async processUserExtensionsWithGroupBy() {
		console.log(`🚀 Attempting GROUP BY bulk update for user_extensions...`)

		const transaction = await this.sequelize.transaction()

		try {
			// Build VALUES clause from CSV data
			const csvValues = Array.from(this.orgLookupCache.entries())
				.map(([orgId, data]) => `('${orgId}', '${data.tenant_code}', '${data.organization_code}')`)
				.join(', ')

			if (csvValues.length === 0) {
				throw new Error('No CSV data available for user_extensions bulk update')
			}

			// Execute GROUP BY bulk update
			const [, metadata] = await this.sequelize.query(
				`
				UPDATE user_extensions
				SET 
					tenant_code = csv_data.tenant_code,
					organization_code = csv_data.organization_code,
					updated_at = NOW()
				FROM (
					VALUES ${csvValues}
				) AS csv_data(organization_id, tenant_code, organization_code)
				WHERE user_extensions.organization_id::text = csv_data.organization_id
			`,
				{ transaction }
			)

			await transaction.commit()
			return metadata.rowCount || 0
		} catch (error) {
			await transaction.rollback()
			throw error
		}
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
		const { name, updateColumns, hasPartitionKey, useSessionLookup, useDefaultValues } = tableConfig
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
				} else if (useDefaultValues) {
					await this.processDefaultValuesTable(name, tableConfig)
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
	 * Uses GROUP BY + Inner Join + CSV hybrid approach
	 */
	async processSessionLookupTable(tableName, tableConfig) {
		const sessionIdColumn = tableConfig.sessionIdColumn
		console.log(`🔄 Processing ${tableName} using GROUP BY + Inner Join + CSV hybrid...`)

		// Strategy 1: Try GROUP BY with inner join + CSV data
		let totalUpdated = 0
		try {
			totalUpdated = await this.processSessionLookupWithGroupBy(tableName, tableConfig)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using GROUP BY + Inner Join + CSV`)
		} catch (error) {
			console.warn(`⚠️  GROUP BY approach failed for ${tableName}, using individual processing:`, error.message)
			// Strategy 2: Fallback to individual organization processing
			totalUpdated = await this.processSessionLookupIndividually(tableName, tableConfig)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using individual updates`)
		}

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * GROUP BY approach with inner join for session lookup tables
	 */
	async processSessionLookupWithGroupBy(tableName, tableConfig) {
		const sessionIdColumn = tableConfig.sessionIdColumn
		console.log(`🚀 Attempting GROUP BY + Inner Join for ${tableName}...`)

		const transaction = await this.sequelize.transaction()

		try {
			// Build VALUES clause from CSV data
			const csvValues = Array.from(this.orgLookupCache.entries())
				.map(([orgId, data]) => `('${orgId}', '${data.tenant_code}', '${data.organization_code}')`)
				.join(', ')

			if (csvValues.length === 0) {
				throw new Error(`No CSV data available for ${tableName} bulk update`)
			}

			// Build SET clause using CSV data
			const setClauses = []
			if (tableConfig.updateColumns.includes('tenant_code')) {
				setClauses.push('tenant_code = csv_data.tenant_code')
			}
			if (tableConfig.updateColumns.includes('organization_code')) {
				setClauses.push('organization_code = csv_data.organization_code')
			}
			setClauses.push('updated_at = NOW()')

			// Execute GROUP BY bulk update with inner joins + CSV
			const [, metadata] = await this.sequelize.query(
				`
				UPDATE ${tableName}
				SET ${setClauses.join(', ')}
				FROM 
					sessions s,
					user_extensions ue,
					(
						VALUES ${csvValues}
					) AS csv_data(organization_id, tenant_code, organization_code)
				WHERE ${tableName}.${sessionIdColumn} = s.id
				AND ue.user_id = s.created_by
				AND ue.organization_id::text = csv_data.organization_id
			`,
				{ transaction }
			)

			await transaction.commit()
			return metadata.rowCount || 0
		} catch (error) {
			await transaction.rollback()
			throw error
		}
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
	 * Process table with default values (modules)
	 */
	async processDefaultValuesTable(tableName, tableConfig) {
		console.log(`🔄 Processing ${tableName} with default values`)

		const transaction = await this.sequelize.transaction()

		try {
			const [, metadata] = await this.sequelize.query(
				`
				UPDATE ${tableName}
				SET tenant_code = '${this.defaultTenantCode}', updated_at = NOW()
				WHERE tenant_code IS NULL OR tenant_code = ''
			`,
				{ transaction }
			)

			const totalUpdated = metadata.rowCount || 0
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} with default values`)
			this.stats.successfulUpdates += totalUpdated

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	}

	/**
	 * Process table with user_id using GROUP BY + Inner Join + CSV hybrid
	 */
	async processUserIdTable(tableName, tableConfig) {
		const userIdColumn = tableConfig.userIdColumn
		console.log(`🔄 Processing ${tableName} using GROUP BY + Inner Join + CSV hybrid...`)

		// Strategy 1: Try GROUP BY with inner join + CSV data
		let totalUpdated = 0
		try {
			totalUpdated = await this.processUserIdTableWithGroupBy(tableName, tableConfig)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using GROUP BY + Inner Join + CSV`)
		} catch (error) {
			console.warn(`⚠️  GROUP BY approach failed for ${tableName}, using individual processing:`, error.message)
			// Strategy 2: Fallback to individual organization processing
			totalUpdated = await this.processUserIdTableIndividually(tableName, tableConfig)
			console.log(`✅ Updated ${totalUpdated} rows in ${tableName} using individual updates`)
		}

		this.stats.successfulUpdates += totalUpdated
	}

	/**
	 * GROUP BY approach for user_id tables
	 */
	async processUserIdTableWithGroupBy(tableName, tableConfig) {
		const userIdColumn = tableConfig.userIdColumn
		console.log(`🚀 Attempting GROUP BY + Inner Join for ${tableName}...`)

		const transaction = await this.sequelize.transaction()

		try {
			// Build VALUES clause from CSV data
			const csvValues = Array.from(this.orgLookupCache.entries())
				.map(([orgId, data]) => `('${orgId}', '${data.tenant_code}', '${data.organization_code}')`)
				.join(', ')

			if (csvValues.length === 0) {
				throw new Error(`No CSV data available for ${tableName} bulk update`)
			}

			// Build SET clause using CSV data
			const setClauses = []
			if (tableConfig.updateColumns.includes('tenant_code')) {
				setClauses.push('tenant_code = csv_data.tenant_code')
			}
			if (tableConfig.updateColumns.includes('organization_code')) {
				setClauses.push('organization_code = csv_data.organization_code')
			}
			setClauses.push('updated_at = NOW()')

			// Execute GROUP BY bulk update with inner join + CSV
			const [, metadata] = await this.sequelize.query(
				`
				UPDATE ${tableName}
				SET ${setClauses.join(', ')}
				FROM 
					user_extensions ue,
					(
						VALUES ${csvValues}
					) AS csv_data(organization_id, tenant_code, organization_code)
				WHERE ${tableName}.${userIdColumn} = ue.user_id
				AND ue.organization_id::text = csv_data.organization_id
			`,
				{ transaction }
			)

			await transaction.commit()
			return metadata.rowCount || 0
		} catch (error) {
			await transaction.rollback()
			throw error
		}
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
