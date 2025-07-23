#!/usr/bin/env node
'use strict'

require('dotenv').config({ path: '../.env' })
const { Sequelize, QueryTypes } = require('sequelize')

class DatabaseIntegrityChecker {
	constructor() {
		const databaseUrl = process.env.DATABASE_URL || process.env.DEV_DATABASE_URL

		this.sequelize = new Sequelize(databaseUrl, {
			dialect: 'postgres',
			logging: false,
			pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
		})

		this.issues = []
		this.warnings = []
		this.passed = []
		this.tables = []
		this.tableInfo = {}
	}

	async checkConnection() {
		const databaseUrl = process.env.DATABASE_URL || process.env.DEV_DATABASE_URL
		if (!databaseUrl) {
			this.issues.push('DATABASE_URL not set')
			return false
		}

		try {
			await this.sequelize.authenticate()
			const result = await this.sequelize.query('SELECT current_database()', { type: QueryTypes.SELECT })
			console.log(`Connected to: ${result[0].current_database}`)
			return true
		} catch (error) {
			this.issues.push(`Connection failed: ${error.message}`)
			return false
		}
	}

	async discoverSchema() {
		const tables = await this.sequelize.query(
			`
			SELECT table_name 
			FROM information_schema.tables 
			WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
			ORDER BY table_name
		`,
			{ type: QueryTypes.SELECT }
		)

		this.tables = tables.map((t) => t.table_name)
		console.log(`Found ${this.tables.length} tables`)

		for (const tableName of this.tables) {
			const columns = await this.sequelize.query(
				`
				SELECT column_name, data_type, udt_name
				FROM information_schema.columns 
				WHERE table_name = '${tableName}' AND table_schema = 'public'
				ORDER BY ordinal_position
			`,
				{ type: QueryTypes.SELECT }
			)

			this.tableInfo[tableName] = {
				columns: columns.map((c) => c.column_name),
				columnData: columns,
			}
		}
	}

	async checkCriticalTables() {
		const critical = ['user_extensions', 'sessions', 'permissions']
		for (const table of critical) {
			if (this.tables.includes(table)) {
				this.passed.push(`Critical table '${table}' exists`)
			} else {
				this.issues.push(`Critical table '${table}' missing`)
			}
		}

		// Check for premature migration columns
		let hasMigrationColumns = false
		for (const [tableName, info] of Object.entries(this.tableInfo)) {
			const migrationCols = info.columns.filter((col) => ['tenant_code', 'organization_code'].includes(col))
			if (migrationCols.length > 0) {
				this.warnings.push(`Table '${tableName}' has migration columns: ${migrationCols.join(', ')}`)
				hasMigrationColumns = true
			}
		}

		if (!hasMigrationColumns) {
			this.passed.push('No premature migration columns found')
		}
	}

	async checkDataTypes() {
		const orgColumns = ['organization_id', 'mentor_organization_id']
		const userColumns = ['user_id', 'mentee_id', 'mentor_id', 'created_by', 'updated_by']

		for (const [tableName, info] of Object.entries(this.tableInfo)) {
			for (const column of info.columnData) {
				if (orgColumns.includes(column.column_name) || userColumns.includes(column.column_name)) {
					if (column.data_type === 'character varying' || column.udt_name === 'varchar') {
						this.passed.push(`${tableName}.${column.column_name} has correct STRING type`)
					} else {
						this.issues.push(`${tableName}.${column.column_name} has incorrect type: ${column.data_type}`)
					}
				}
			}
		}
	}

	async checkPrimaryKeys() {
		const primaryKeys = await this.sequelize.query(
			`
			SELECT tc.table_name, string_agg(kcu.column_name, ', ') as columns
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
			WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
			GROUP BY tc.table_name
		`,
			{ type: QueryTypes.SELECT }
		)

		for (const pk of primaryKeys) {
			this.passed.push(`${pk.table_name} has primary key`)
		}

		const tablesWithoutPK = this.tables.filter((table) => !primaryKeys.some((pk) => pk.table_name === table))

		for (const table of tablesWithoutPK) {
			this.issues.push(`${table} has no primary key`)
		}
	}

	async checkOrganizationData() {
		// Check organization data integrity across all tables with organization_id
		const orgTables = []
		for (const [tableName, info] of Object.entries(this.tableInfo)) {
			const orgCols = info.columns.filter((col) => ['organization_id', 'mentor_organization_id'].includes(col))
			if (orgCols.length > 0) {
				orgTables.push({ table: tableName, column: orgCols[0] })
			}
		}

		if (orgTables.length > 0) {
			let totalOrganizations = new Set()
			for (const { table, column } of orgTables) {
				try {
					const stats = await this.sequelize.query(
						`
						SELECT 
							COUNT(*) as total_rows,
							COUNT(CASE WHEN ${column} IS NOT NULL THEN 1 END) as rows_with_org,
							COUNT(DISTINCT ${column}) as unique_orgs
						FROM ${table}
						WHERE deleted_at IS NULL OR deleted_at IS NULL
					`,
						{ type: QueryTypes.SELECT }
					)

					const percentage = Math.round((stats[0].rows_with_org / stats[0].total_rows) * 100)
					if (percentage >= 95) {
						this.passed.push(
							`Table '${table}': ${stats[0].rows_with_org}/${stats[0].total_rows} rows have organization data`
						)
					} else {
						this.warnings.push(
							`Table '${table}': Only ${stats[0].rows_with_org}/${stats[0].total_rows} rows have organization data (${percentage}%)`
						)
					}

					// Add to global org set
					const orgs = await this.sequelize.query(
						`
						SELECT DISTINCT ${column} as org_id 
						FROM ${table} 
						WHERE ${column} IS NOT NULL 
						AND (deleted_at IS NULL OR deleted_at IS NULL)
					`,
						{ type: QueryTypes.SELECT }
					)

					orgs.forEach((org) => totalOrganizations.add(org.org_id))
				} catch (error) {
					this.warnings.push(`Could not check organization data for table '${table}': ${error.message}`)
				}
			}

			this.passed.push(`Found ${totalOrganizations.size} unique organizations across ${orgTables.length} tables`)
		}
	}

	async checkOrphanedRecords() {
		const relationships = [
			{ table: 'entities', column: 'entity_type_id', refTable: 'entity_types', refColumn: 'id' },
			{ table: 'role_permission_mapping', column: 'permission_id', refTable: 'permissions', refColumn: 'id' },
			{ table: 'post_session_details', column: 'session_id', refTable: 'sessions', refColumn: 'id' },
			{ table: 'resources', column: 'session_id', refTable: 'sessions', refColumn: 'id' },
			{ table: 'session_attendees', column: 'session_id', refTable: 'sessions', refColumn: 'id' },
		]

		// Add user relationships dynamically
		for (const [tableName, info] of Object.entries(this.tableInfo)) {
			const userCols = info.columns.filter((col) =>
				[
					'user_id',
					'mentee_id',
					'mentor_id',
					'created_by',
					'updated_by',
					'requestor_id',
					'requestee_id',
					'friend_id',
				].includes(col)
			)
			for (const col of userCols) {
				if (this.tables.includes('user_extensions')) {
					relationships.push({
						table: tableName,
						column: col,
						refTable: 'user_extensions',
						refColumn: 'user_id',
					})
				}
			}
		}

		// Add session relationships dynamically
		for (const [tableName, info] of Object.entries(this.tableInfo)) {
			const sessionCols = info.columns.filter((col) => ['session_id', 'request_session_id'].includes(col))
			for (const col of sessionCols) {
				if (
					this.tables.includes('sessions') &&
					!relationships.some((r) => r.table === tableName && r.column === col)
				) {
					relationships.push({
						table: tableName,
						column: col,
						refTable: 'sessions',
						refColumn: 'id',
					})
				}
			}
		}

		for (const rel of relationships) {
			if (!this.tables.includes(rel.table) || !this.tables.includes(rel.refTable)) continue

			try {
				// Check if table has deleted_at column
				const hasDeletedAt = this.tableInfo[rel.table].columns.includes('deleted_at')
				const refHasDeletedAt = this.tableInfo[rel.refTable].columns.includes('deleted_at')

				let whereClause = `t.${rel.column} IS NOT NULL AND r.${rel.refColumn} IS NULL`
				if (hasDeletedAt) {
					whereClause += ` AND t.deleted_at IS NULL`
				}
				if (refHasDeletedAt) {
					whereClause += ` AND (r.deleted_at IS NULL OR r.deleted_at IS NULL)`
				}

				const orphans = await this.sequelize.query(
					`
					SELECT COUNT(*) as count
					FROM ${rel.table} t
					LEFT JOIN ${rel.refTable} r ON t.${rel.column}::text = r.${rel.refColumn}::text
					WHERE ${whereClause}
				`,
					{ type: QueryTypes.SELECT }
				)

				const count = parseInt(orphans[0].count)
				if (count > 0) {
					this.issues.push(
						`${count} orphaned records in ${rel.table}.${rel.column} → ${rel.refTable}.${rel.refColumn}`
					)
				} else {
					this.passed.push(`No orphaned records in ${rel.table}.${rel.column}`)
				}
			} catch (error) {
				this.warnings.push(`Could not check ${rel.table}.${rel.column}: ${error.message}`)
			}
		}
	}

	async checkForeignKeyConstraints() {
		const foreignKeys = await this.sequelize.query(
			`
			SELECT 
				tc.table_name,
				kcu.column_name,
				ccu.table_name AS referenced_table,
				ccu.column_name AS referenced_column
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
			JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
			WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
		`,
			{ type: QueryTypes.SELECT }
		)

		if (foreignKeys.length === 0) {
			this.warnings.push('No foreign key constraints found - relationships not enforced at database level')
		} else {
			for (const fk of foreignKeys) {
				this.passed.push(`${fk.table_name}.${fk.column_name} → ${fk.referenced_table}.${fk.referenced_column}`)
			}
		}
	}

	async checkUniqueConstraints() {
		const uniqueConstraints = await this.sequelize.query(
			`
			SELECT tc.table_name, string_agg(kcu.column_name, ', ') as columns
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
			WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
			GROUP BY tc.table_name, tc.constraint_name
		`,
			{ type: QueryTypes.SELECT }
		)

		for (const uc of uniqueConstraints) {
			this.passed.push(`${uc.table_name} has unique constraint on [${uc.columns}]`)
		}

		if (uniqueConstraints.length === 0) {
			this.warnings.push('No unique constraints found')
		}
	}

	generateReport() {
		console.log('\n📊 INTEGRITY CHECK RESULTS')
		console.log('='.repeat(50))
		console.log(
			`✅ Passed: ${this.passed.length} | ⚠️ Warnings: ${this.warnings.length} | ❌ Issues: ${this.issues.length}`
		)

		if (this.issues.length > 0) {
			console.log('\n❌ CRITICAL ISSUES:')
			this.issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`))
		}

		if (this.warnings.length > 0) {
			console.log('\n⚠️ WARNINGS:')
			this.warnings.forEach((warning, i) => console.log(`${i + 1}. ${warning}`))
		}

		console.log('\n' + '='.repeat(50))
		console.log(this.issues.length === 0 ? '🎉 DATABASE READY FOR MIGRATION!' : '⛔ FIX ISSUES BEFORE MIGRATION')
		console.log('='.repeat(50))

		return this.issues.length === 0
	}

	async run() {
		console.log('🔍 Database Integrity Check')

		try {
			if (!(await this.checkConnection())) {
				throw new Error('Database connection failed')
			}

			await this.discoverSchema()
			await this.checkCriticalTables()
			await this.checkDataTypes()
			await this.checkPrimaryKeys()
			await this.checkUniqueConstraints()
			await this.checkOrganizationData()
			await this.checkOrphanedRecords()
			await this.checkForeignKeyConstraints()

			const isReady = this.generateReport()
			process.exit(isReady ? 0 : 1)
		} catch (error) {
			console.error(`❌ Check failed: ${error.message}`)
			process.exit(1)
		} finally {
			await this.sequelize.close()
		}
	}
}

if (require.main === module) {
	const checker = new DatabaseIntegrityChecker()
	checker.run()
}

module.exports = DatabaseIntegrityChecker
