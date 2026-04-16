'use strict'

/**
 * Tenant Data Correction Script
 *
 * For each tenant in the CSV this script:
 *   1. Deletes all existing config data for that tenant
 *      (notification_templates, forms, entity_types, entities, questions,
 *       question_sets, report_types, reports, report_queries,
 *       report_role_mapping, role_extensions)
 *   2. Re-replicates fresh config from the default tenant
 *
 * Use this to fix tenants that already exist but have missing or stale config.
 * Safe to re-run — the delete step ensures a clean slate each time.
 *
 * CSV format (header row required):
 *   code,org_id,org_code
 *
 * Usage:
 *   node src/scripts/correctTenantData.js <path-to-csv>
 *   node src/scripts/correctTenantData.js <path-to-csv> --dry-run
 *
 * Example CSV:
 *   code,org_id,org_code
 *   tenant_alpha,85,default_code
 *   tenant_beta,86,default_code
 */

require('module-alias/register')
require('dotenv').config({ path: `${__dirname}/../.env` })

const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')
const db = require('@database/models/index')
const TenantService = require('@services/tenant')

// Tables to clear, in the order that respects foreign-key dependencies
// (entities references entity_types, so entities must be deleted first)
const CONFIG_TABLES = [
	'entities',
	'entity_types',
	'question_sets',
	'questions',
	'notification_templates',
	'forms',
	'report_role_mapping',
	'report_queries',
	'reports',
	'report_types',
	'role_extensions',
]

/**
 * Parses a CSV file and returns an array of row objects.
 * @param {string} filePath
 * @returns {Promise<Array<object>>}
 */
function parseCsv(filePath) {
	return new Promise((resolve, reject) => {
		const rows = []
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (row) => rows.push(row))
			.on('end', () => resolve(rows))
			.on('error', (err) => reject(err))
	})
}

/**
 * Deletes all config rows for a given tenant_code inside a transaction.
 * @param {string} tenantCode
 * @param {object} transaction - Sequelize transaction
 */
async function deleteTenantConfig(tenantCode, transaction) {
	for (const table of CONFIG_TABLES) {
		await db.sequelize.query(`DELETE FROM "${table}" WHERE tenant_code = :tenantCode`, {
			replacements: { tenantCode },
			transaction,
		})
	}
	console.log(`[DELETE] Config cleared for tenant: ${tenantCode}`)
}

/**
 * Corrects tenant config data for an array of tenants.
 * For each tenant: deletes existing config then re-replicates from default tenant.
 *
 * @param {Array<object>} tenants - Array of { code, org_id, org_code }
 * @param {object} options
 * @param {boolean} options.dryRun - If true, only logs what would happen
 * @returns {Promise<{ success: number, failed: number, total: number }>}
 */
async function correctTenants(tenants, options = {}) {
	const { dryRun = false } = options
	let success = 0
	let failed = 0

	for (const tenant of tenants) {
		if (!tenant.code || !tenant.org_id || !tenant.org_code) {
			console.error(`[SKIP] Missing required field (code, org_id, or org_code):`, tenant)
			failed++
			continue
		}

		if (dryRun) {
			console.log(`[DRY RUN] Would correct: ${tenant.code}`)
			continue
		}

		try {
			console.log(`\n[Correcting] ${tenant.code} ...`)

			// Step 1: delete existing config inside a transaction
			const transaction = await db.sequelize.transaction()
			try {
				await deleteTenantConfig(tenant.code, transaction)
				await transaction.commit()
			} catch (err) {
				await transaction.rollback()
				throw err
			}

			// Step 2: re-replicate fresh config from the default tenant
			await TenantService.replicateConfigFromDefaultTenant(tenant.code, tenant.org_id, tenant.org_code)

			console.log(`[Done] ${tenant.code}`)
			success++
		} catch (err) {
			console.error(`[Failed] ${tenant.code} — ${err.message}`)
			failed++
		}
	}

	return { success, failed, total: tenants.length }
}

// Export for programmatic use (e.g. called from backfillTenantData.js)
module.exports = { correctTenants, parseCsv }

// ── CLI entry point ──────────────────────────────────────────────────────────
if (require.main === module) {
	const args = process.argv.slice(2)
	const isDryRun = args.includes('--dry-run')
	const csvPath = args.find((a) => !a.startsWith('--'))

	if (!csvPath) {
		console.error('Usage: node src/scripts/correctTenantData.js <path-to-csv> [--dry-run]')
		console.error('\nCSV format (header row required):')
		console.error('  code,org_id,org_code')
		process.exit(1)
	}

	const resolvedPath = path.resolve(csvPath)
	if (!fs.existsSync(resolvedPath)) {
		console.error(`File not found: ${resolvedPath}`)
		process.exit(1)
	}

	;(async () => {
		try {
			console.log('=== Tenant Correction Script ===')
			console.log(`CSV file: ${resolvedPath}`)
			if (isDryRun) console.log('*** DRY RUN — no changes will be made ***')
			console.log('')

			const tenants = await parseCsv(resolvedPath)
			console.log(`Parsed ${tenants.length} row(s) from CSV.\n`)

			if (!tenants.length) {
				console.log('CSV is empty. Nothing to do.')
				process.exit(0)
			}

			const result = await correctTenants(tenants, { dryRun: isDryRun })

			console.log('\n=== Correction Summary ===')
			console.log(`Total:   ${result.total}`)
			console.log(`Success: ${result.success}`)
			console.log(`Failed:  ${result.failed}`)

			process.exit(result.failed > 0 ? 1 : 0)
		} catch (err) {
			console.error('Fatal error:', err.message)
			console.error(err.stack)
			process.exit(1)
		}
	})()
}
