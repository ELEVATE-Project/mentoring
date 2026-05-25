'use strict'

/**
 * Patch Tenant Organization ID Script
 *
 * Fixes tenants whose config was replicated with the wrong organization_id
 * because the backfill script fell back to DEFAULT_ORG_ID when org_id was
 * missing from the CSV.
 *
 * For each tenant in the CSV, runs a targeted UPDATE across all config tables:
 *
 *   UPDATE "<table>"
 *      SET organization_id   = <correct_org_id>,
 *          organization_code = <correct_org_code>
 *    WHERE tenant_code     = <tenant_code>
 *      AND organization_id = <DEFAULT_ORG_ID>
 *
 * What this guarantees:
 *   - Only corrupted rows (those with DEFAULT_ORG_ID) are touched
 *   - Tenant customizations are fully preserved
 *   - Safe to re-run — rows already correct are not matched
 *   - All updates for a tenant run in a single transaction (all-or-nothing)
 *
 * Required env vars:
 *   DEFAULT_ORG_ID              — the wrong org_id that was stamped during backfill
 *   DEFAULT_ORGANISATION_CODE   — the wrong org_code that was stamped during backfill
 *
 * CSV format (header row required):
 *   code,org_id,org_code
 *
 * Usage:
 *   node src/scripts/patchTenantOrgId.js <path-to-csv>
 *   node src/scripts/patchTenantOrgId.js <path-to-csv> --dry-run
 *   node src/scripts/patchTenantOrgId.js <path-to-csv> --count
 *
 * Example CSV:
 *   code,org_id,org_code
 *   tenant_alpha,85,alpha_org_code
 *   tenant_beta,86,beta_org_code
 */

require('module-alias/register')
require('dotenv').config({ path: `${__dirname}/../.env` })

const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')
const db = require('@database/models/index')

// Tables that have both organization_id and organization_code columns.
// Only these were corrupted during the backfill replication.
const TABLES_WITH_ORG_ID = [
	'forms',
	'entity_types',
	'notification_templates',
	'reports',
	'report_queries',
	'role_extensions',
]

// Tables that have a unique constraint involving organization_id.
// For these, the DELETE must use a row-specific EXISTS check (matching on the
// unique key columns excluding organization_id) so we only delete corrupted rows
// that have an actual correct counterpart — not every corrupted row in the tenant.
const CONFLICT_DELETE_EXISTS_CLAUSE = {
	forms: `EXISTS (
		SELECT 1 FROM "forms" t2
		WHERE t2.type        = "forms".type
		  AND t2.sub_type    = "forms".sub_type
		  AND t2.tenant_code = :tenantCode
		  AND t2.organization_id = :correctOrgId
	)`,
	reports: `EXISTS (
		SELECT 1 FROM "reports" t2
		WHERE t2.code        = "reports".code
		  AND t2.tenant_code = :tenantCode
		  AND t2.organization_id = :correctOrgId
	)`,
	report_queries: `EXISTS (
		SELECT 1 FROM "report_queries" t2
		WHERE t2.report_code = "report_queries".report_code
		  AND t2.tenant_code = :tenantCode
		  AND t2.organization_id = :correctOrgId
	)`,
}

/**
 * Validates that required env vars are present. Throws early if not.
 */
function validateEnv() {
	const missing = ['DEFAULT_ORG_ID', 'DEFAULT_ORGANISATION_CODE', 'DEFAULT_TENANT_CODE'].filter(
		(k) => !process.env[k]
	)
	if (missing.length) {
		throw new Error(`Missing required env var(s): ${missing.join(', ')}`)
	}
}

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
 * Counts corrupted rows per table for a given tenant (no changes made).
 *
 * @param {string} tenantCode
 * @param {string} defaultOrgId
 * @param {string} defaultOrgCode
 * @returns {Promise<number>} - Total matching rows across all tables
 */
async function countCorruptedRows(tenantCode, defaultOrgId, defaultOrgCode) {
	let total = 0

	for (const table of TABLES_WITH_ORG_ID) {
		const [rows] = await db.sequelize.query(
			`SELECT COUNT(*) AS count FROM "${table}"
			  WHERE tenant_code       = :tenantCode
			    AND organization_id   = :defaultOrgId
			    AND organization_code = :defaultOrgCode`,
			{ replacements: { tenantCode, defaultOrgId, defaultOrgCode } }
		)
		const count = parseInt(rows[0].count, 10)
		if (count > 0) {
			console.log(`  [${table}] ${count} corrupted row(s) found`)
		}
		total += count
	}

	return total
}

/**
 * Patches organization_id and organization_code for all corrupted rows
 * belonging to the given tenant, inside an existing transaction.
 *
 * @param {string} tenantCode
 * @param {string} correctOrgId
 * @param {string} correctOrgCode
 * @param {string} defaultOrgId    - The wrong org_id to match against
 * @param {string} defaultOrgCode  - The wrong org_code to match against
 * @param {object} transaction     - Sequelize transaction
 * @returns {Promise<number>}      - Total rows updated across all tables
 */
async function patchOrgIdForTenant(
	tenantCode,
	correctOrgId,
	correctOrgCode,
	defaultOrgId,
	defaultOrgCode,
	transaction
) {
	let totalUpdated = 0

	for (const table of TABLES_WITH_ORG_ID) {
		// Attempt 1: try to UPDATE all corrupted rows
		await db.sequelize.query(`SAVEPOINT sp_${table}`, { transaction })
		try {
			const [, meta] = await db.sequelize.query(
				`UPDATE "${table}"
				    SET organization_id   = :correctOrgId
				  WHERE tenant_code       = :tenantCode
				    AND organization_id   = :defaultOrgId
				    AND organization_code = :defaultOrgCode`,
				{
					replacements: { correctOrgId, correctOrgCode, tenantCode, defaultOrgId, defaultOrgCode },
					transaction,
				}
			)
			await db.sequelize.query(`RELEASE SAVEPOINT sp_${table}`, { transaction })
			const rowsUpdated = meta?.rowCount ?? 0
			if (rowsUpdated > 0) console.log(`  [${table}] ${rowsUpdated} row(s) patched`)
			totalUpdated += rowsUpdated
		} catch (err) {
			// Check if this is a unique constraint violation (PostgreSQL error code 23505)
			const isUniqueViolation =
				err.original?.code === '23505' ||
				err.message?.includes('unique constraint') ||
				err.message?.includes('duplicate key')

			console.log(`  [${table}] UPDATE failed — isUniqueViolation: ${isUniqueViolation}, error: ${err.message}`)

			if (!isUniqueViolation) {
				throw err // Re-throw non-constraint errors
			}

			// UPDATE hit a unique constraint — some corrupted rows have correct counterparts.
			// Rollback to savepoint so the transaction stays alive, then:
			//   1. DELETE only the corrupted rows that have a correct counterpart (EXISTS check)
			//   2. Retry the UPDATE for the remaining corrupted rows (no conflicts left)
			await db.sequelize.query(`ROLLBACK TO SAVEPOINT sp_${table}`, { transaction })

			// Step 1: delete corrupted rows that have a correct counterpart.
			// Use row-specific EXISTS (matching on the table's unique key columns)
			// so we only delete rows that truly have a correct duplicate —
			// not every corrupted row in the tenant.
			// If this table has no unique constraint on organization_id it should
			// never reach here — re-throw the bug
			const existsClause = CONFLICT_DELETE_EXISTS_CLAUSE[table]
			if (!existsClause) throw err
			const [, deleteMeta] = await db.sequelize.query(
				`DELETE FROM "${table}"
				  WHERE tenant_code       = :tenantCode
				    AND organization_id   = :defaultOrgId
				    AND organization_code = :defaultOrgCode
				    AND ${existsClause}`,
				{ replacements: { tenantCode, defaultOrgId, defaultOrgCode, correctOrgId }, transaction }
			)
			const rowsDeleted = deleteMeta?.rowCount ?? 0
			if (rowsDeleted > 0)
				console.log(`  [${table}] ${rowsDeleted} corrupted duplicate(s) deleted (correct rows already existed)`)
			totalUpdated += rowsDeleted

			// Step 2: retry UPDATE for remaining corrupted rows (conflicts are now gone)
			const [, retryMeta] = await db.sequelize.query(
				`UPDATE "${table}"
				    SET organization_id   = :correctOrgId
				  WHERE tenant_code       = :tenantCode
				    AND organization_id   = :defaultOrgId
				    AND organization_code = :defaultOrgCode`,
				{
					replacements: { correctOrgId, correctOrgCode, tenantCode, defaultOrgId, defaultOrgCode },
					transaction,
				}
			)
			const rowsUpdated = retryMeta?.rowCount ?? 0
			if (rowsUpdated > 0)
				console.log(`  [${table}] ${rowsUpdated} row(s) patched (retry after conflict resolution)`)
			totalUpdated += rowsUpdated
		}
	}

	return totalUpdated
}

/**
 * Patches organization_id for an array of tenants.
 *
 * @param {Array<object>} tenants  - Array of { code, org_id, org_code }
 * @param {object} options
 * @param {boolean} options.dryRun
 * @returns {Promise<{ success: number, failed: number, skipped: number, total: number }>}
 */
async function patchTenants(tenants, options = {}) {
	const { dryRun = false, countOnly = false } = options
	const defaultOrgId = process.env.DEFAULT_ORG_ID
	const defaultOrgCode = process.env.DEFAULT_ORGANISATION_CODE

	let success = 0
	let failed = 0
	let skipped = 0

	for (const tenant of tenants) {
		// Require all three fields — no silent fallbacks
		if (!tenant.code || !tenant.org_id || !tenant.org_code) {
			console.error(`[SKIP] Missing required field (code, org_id, org_code):`, tenant)
			skipped++
			continue
		}

		// Skip the default tenant — its config should never be patched
		if (tenant.code === process.env.DEFAULT_TENANT_CODE) {
			console.log(`[SKIP] ${tenant.code} — default tenant, nothing to patch`)
			skipped++
			continue
		}

		// If the correct org_id IS the default, there's nothing to fix
		if (tenant.org_id === defaultOrgId) {
			console.log(`[SKIP] ${tenant.code} — org_id is already the default org id, nothing to patch`)
			skipped++
			continue
		}

		if (countOnly) {
			console.log(`\n[Count] ${tenant.code}`)
			const total = await countCorruptedRows(tenant.code, defaultOrgId, defaultOrgCode)
			console.log(`  Total: ${total} corrupted row(s)`)
			continue
		}

		if (dryRun) {
			console.log(
				`[DRY RUN] Would patch ${tenant.code}: organization_id ${defaultOrgId} → ${tenant.org_id} (where organization_code = ${defaultOrgCode})`
			)
			continue
		}

		const transaction = await db.sequelize.transaction()
		try {
			console.log(`\n[Patching] ${tenant.code} ...`)

			const totalUpdated = await patchOrgIdForTenant(
				tenant.code,
				tenant.org_id,
				tenant.org_code,
				defaultOrgId,
				defaultOrgCode,
				transaction
			)

			await transaction.commit()
			console.log(`[Done] ${tenant.code} — ${totalUpdated} total row(s) patched`)
			success++
		} catch (err) {
			await transaction.rollback()
			console.error(`[Failed] ${tenant.code} — ${err.message}`)
			failed++
		}
	}

	return { success, failed, skipped, total: tenants.length }
}

module.exports = { patchTenants, parseCsv }

// ── CLI entry point ──────────────────────────────────────────────────────────
if (require.main === module) {
	const args = process.argv.slice(2)
	const isDryRun = args.includes('--dry-run')
	const isCountOnly = args.includes('--count')
	const csvPath = args.find((a) => !a.startsWith('--'))

	if (!csvPath) {
		console.error('Usage: node src/scripts/patchTenantOrgId.js <path-to-csv> [--dry-run] [--count]')
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
			// Validate env vars upfront before doing any work
			validateEnv()

			console.log('=== Patch Tenant Org ID Script ===')
			console.log(`CSV file:        ${resolvedPath}`)
			console.log(`DEFAULT_ORG_ID:  ${process.env.DEFAULT_ORG_ID}  (wrong value being replaced)`)
			if (isCountOnly) console.log('*** COUNT ONLY — no changes will be made ***')
			if (isDryRun) console.log('*** DRY RUN — no changes will be made ***')
			console.log('')

			const tenants = await parseCsv(resolvedPath)
			console.log(`Parsed ${tenants.length} row(s) from CSV.\n`)

			if (!tenants.length) {
				console.log('CSV is empty. Nothing to do.')
				process.exit(0)
			}

			const result = await patchTenants(tenants, { dryRun: isDryRun, countOnly: isCountOnly })

			console.log('\n=== Summary ===')
			console.log(`Total:   ${result.total}`)
			console.log(`Success: ${result.success}`)
			console.log(`Skipped: ${result.skipped}`)
			console.log(`Failed:  ${result.failed}`)

			process.exit(result.failed > 0 ? 1 : 0)
		} catch (err) {
			console.error('Fatal error:', err.message)
			process.exit(1)
		}
	})()
}
