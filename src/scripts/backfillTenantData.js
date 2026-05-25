'use strict'

/**
 * Backfill script — Step 3 of Phase 1.
 *
 * Reads tenant data from a CSV file and processes each row through the
 * existing tenant Kafka consumer (create event), which handles both
 * tenant record creation and config replication from the default tenant.
 *
 * ── Generating the CSV ───────────────────────────────────────────────────────
 * Run the following query in the USER SERVICE database to produce the correct
 * CSV. Replace 'default_code' with the value of DEFAULT_ORGANISATION_CODE from
 * your .env — this value must be the same in both the user service and the
 * mentoring service.
 *
 *   SELECT t.*, o.id AS org_id, o.code AS org_code
 *   FROM tenants t
 *   INNER JOIN organizations o ON o.tenant_code = t.code
 *   WHERE o.code       = 'default_code'
 *     AND o.deleted_at IS NULL
 *     AND t.deleted_at IS NULL;
 *
 * Export the query result as a .csv file before running this script.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CSV format (header row required):
 *   code,name,org_id,org_code
 *
 * Optional columns: status, description, logo
 *
 * Safe to re-run: the consumer uses findOrCreate (idempotent) and
 * replication only runs for genuinely new tenants.
 *
 * Usage:
 *   node src/scripts/backfillTenantData.js <path-to-csv>
 *   node src/scripts/backfillTenantData.js <path-to-csv> --dry-run
 *
 * Example CSV:
 *   code,name,org_id,org_code
 *   tenant_alpha,Alpha School,85,default_code
 *   tenant_beta,Beta Academy,86,default_code
 */

require('module-alias/register')
require('dotenv').config({ path: `${__dirname}/../.env` })

const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')
const tenantConsumer = require('@generics/kafka/consumers/tenant')

/**
 * Parses a CSV file and returns an array of row objects.
 * @param {string} filePath - Absolute or relative path to the CSV file
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
 * Backfills tenant data from an array of tenant records.
 * Each record is passed to the tenant Kafka consumer as a create event.
 *
 * @param {Array<object>} tenants - Array of { code, name, org_id, org_code, status?, description?, logo? }
 * @param {object} options
 * @param {boolean} options.dryRun - If true, only logs what would happen
 * @returns` {Promise<{ success: number, failed: number, total: number }>}
 */
async function backfillTenants(tenants, options = {}) {
	const { dryRun = false } = options
	let success = 0
	let failed = 0

	for (const tenant of tenants) {
		if (!tenant.code || !tenant.name || !tenant.org_id || !tenant.org_code) {
			console.error('[SKIP] Missing required field (code, name, org_id, org_code):', tenant)
			failed++
			continue
		}

		if (dryRun) {
			console.log(`[DRY RUN] Would process: ${tenant.code} (${tenant.name})`)
			continue
		}

		// Build the same payload the Kafka consumer expects
		const payload = {
			entity: 'tenant',
			eventType: 'create',
			code: tenant.code,
			name: tenant.name,
			status: tenant.status || 'ACTIVE',
			description: tenant.description || null,
			logo: tenant.logo || null,
			org_id: tenant.org_id,
			org_code: tenant.org_code,
		}

		try {
			await tenantConsumer.messageReceived(payload)
			console.log(`[Done] ${tenant.code}`)
			success++
		} catch (err) {
			console.error(`[Failed] ${tenant.code} — ${err.message}`)
			failed++
		}
	}

	return { success, failed, total: tenants.length }
}

// Export for programmatic use
module.exports = { backfillTenants, parseCsv }

// ── CLI entry point ──────────────────────────────────────────────────────────
if (require.main === module) {
	const args = process.argv.slice(2)
	const isDryRun = args.includes('--dry-run')
	const csvPath = args.find((a) => !a.startsWith('--'))

	if (!csvPath) {
		console.error('Usage: node src/scripts/backfillTenantData.js <path-to-csv> [--dry-run]')
		console.error('\nCSV format (header row required):')
		console.error('  code,name,org_id,org_code')
		console.error('\nOptional columns: status, description, logo')
		process.exit(1)
	}

	const resolvedPath = path.resolve(csvPath)
	if (!fs.existsSync(resolvedPath)) {
		console.error(`File not found: ${resolvedPath}`)
		process.exit(1)
	}

	;(async () => {
		try {
			console.log('=== Tenant Backfill Script ===')
			console.log(`CSV file: ${resolvedPath}`)
			if (isDryRun) console.log('*** DRY RUN — no changes will be made ***')
			console.log('')

			const tenants = await parseCsv(resolvedPath)
			console.log(`Parsed ${tenants.length} row(s) from CSV.\n`)

			if (!tenants.length) {
				console.log('CSV is empty. Nothing to do.')
				process.exit(0)
			}

			const result = await backfillTenants(tenants, { dryRun: isDryRun })

			console.log('\n=== Backfill Summary ===')
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
