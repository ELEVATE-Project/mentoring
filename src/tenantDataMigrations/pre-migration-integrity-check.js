#!/usr/bin/env node
'use strict'

const { QueryTypes } = require('sequelize')
const fs = require('fs')
const path = require('path')
const DatabaseConnectionManager = require('./db-connection-utils')

class DatabaseIntegrityChecker {
	constructor() {
		// Initialize database connection manager with migration-specific settings
		this.dbManager = new DatabaseConnectionManager({
			poolMax: 5,
			poolMin: 0,
			logging: false,
		})
		this.sequelize = this.dbManager.getSequelize()

		this.issues = []
		this.warnings = []
		this.passed = []
		this.tables = []
		this.tableInfo = {}
		this.detailedIssues = []
		this.logFilePath = path.join(__dirname, 'data-integrity-issues.log')
	}

	async checkConnection() {
		try {
			const connectionResult = await this.dbManager.checkConnection()

			if (connectionResult.success) {
				console.log(`Connected to: ${connectionResult.details.database}`)
				console.log(`Connection time: ${connectionResult.details.connectionTime}ms`)
				return true
			} else {
				this.issues.push(`Connection failed: ${connectionResult.message}`)
				return false
			}
		} catch (error) {
			this.issues.push(`Connection error: ${error.message}`)
			return false
		}
	}

	async checkOrphanedRecords() {
		const relationships = [
			{ table: 'entities', column: 'entity_type_id', refTable: 'entity_types', refColumn: 'id' },
			{ table: 'role_permission_mapping', column: 'permission_id', refTable: 'permissions', refColumn: 'id' },
			{ table: 'post_session_details', column: 'session_id', refTable: 'sessions', refColumn: 'id' },
			{ table: 'resources', column: 'session_id', refTable: 'sessions', refColumn: 'id' },
			{ table: 'session_attendees', column: 'session_id', refTable: 'sessions', refColumn: 'id' },
			{ table: 'question_sets', column: 'questions', refTable: 'questions', refColumn: 'id' },
		]

		console.log(`🔍 Checking ${relationships.length} foreign key relationships...`)

		for (const rel of relationships) {
			// Check if both tables exist before processing
			try {
				await this.sequelize.query(`SELECT 1 FROM ${rel.table} LIMIT 1`, { type: QueryTypes.SELECT })
				await this.sequelize.query(`SELECT 1 FROM ${rel.refTable} LIMIT 1`, { type: QueryTypes.SELECT })
			} catch (error) {
				this.warnings.push(
					`Skipping ${rel.table}.${rel.column} → ${rel.refTable}.${rel.refColumn}: Table not found`
				)
				continue
			}

			try {
				let whereClause = `t.${rel.column} IS NOT NULL AND r.${rel.refColumn} IS NULL AND t.deleted_at IS NULL`

				const orphans = await this.sequelize.query(
					`
					SELECT t.id, t.${rel.column} as invalid_reference
					FROM ${rel.table} t
					LEFT JOIN ${rel.refTable} r ON t.${rel.column}::text = r.${rel.refColumn}::text
					WHERE ${whereClause}
				`,
					{ type: QueryTypes.SELECT }
				)

				if (orphans.length > 0) {
					const totalCount = orphans.length
					const allIds = orphans
						.map((row) => `id:${row.id}(${rel.column}:${row.invalid_reference})`)
						.join(', ')

					// Add to main issues array for console output
					this.issues.push(
						`${totalCount} orphaned records in ${rel.table}.${rel.column} → ${rel.refTable}.${rel.refColumn}. All records: ${allIds}`
					)

					// Add detailed records to log file data
					this.detailedIssues.push({
						type: 'ORPHANED_RECORDS',
						table: rel.table,
						column: rel.column,
						refTable: rel.refTable,
						refColumn: rel.refColumn,
						totalCount: totalCount,
						timestamp: new Date().toISOString(),
						records: orphans.map((row) => ({
							id: row.id,
							invalidReference: row.invalid_reference,
						})),
					})
				} else {
					this.passed.push(`No orphaned records in ${rel.table}.${rel.column}`)
				}
			} catch (error) {
				this.warnings.push(`Could not check ${rel.table}.${rel.column}: ${error.message}`)
			}
		}
	}

	writeLogFile() {
		if (this.detailedIssues.length === 0) {
			console.log('📝 No integrity issues to log')
			return
		}

		const logContent = {
			checkTimestamp: new Date().toISOString(),
			database: 'reportsMentorings',
			summary: {
				totalIssues: this.detailedIssues.length,
				totalOrphanedRecords: this.detailedIssues.reduce((sum, issue) => sum + issue.totalCount, 0),
			},
			issues: this.detailedIssues,
		}

		try {
			fs.writeFileSync(this.logFilePath, JSON.stringify(logContent, null, 2))
			console.log(`📝 Detailed issues logged to: ${this.logFilePath}`)
		} catch (error) {
			console.error(`❌ Failed to write log file: ${error.message}`)
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

		// Write detailed log file
		this.writeLogFile()

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

			await this.checkOrphanedRecords()

			const isReady = this.generateReport()
			process.exit(isReady ? 0 : 1)
		} catch (error) {
			console.error(`❌ Check failed: ${error.message}`)
			process.exit(1)
		} finally {
			await this.dbManager.close()
		}
	}
}

if (require.main === module) {
	const checker = new DatabaseIntegrityChecker()
	checker.run()
}

module.exports = DatabaseIntegrityChecker
