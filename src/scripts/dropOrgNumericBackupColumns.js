'use strict'

/**
 * Drop Numeric Backup Columns Script
 *
 * Drops the `visible_to_organizations_numeric` backup columns from `sessions`
 * and `user_extensions` tables. These columns were created by migration
 * 20260525000002-rename-visible-to-org-codes.js as a safety backup of the
 * original numeric-ID data before the org-code migration went live.
 *
 * Run this ONLY after:
 *   1. PR 2 (org-code migration) has been live in production for enough time
 *      to confirm data correctness in visible_to_organizations (now org codes).
 *   2. You have verified no rollback is needed (migration down() will no longer
 *      work correctly after this script runs, as the numeric backup is gone).
 *
 * Uses CASCADE on DROP COLUMN to automatically drop dependent materialized views,
 * then rebuilds them via checkAndCreateMaterializedViews().
 *
 * Modes:
 *   --dry-run   Print what would be dropped + row/null counts; no DB changes.
 *   --count     Same as --dry-run: inspect counts only, no drops.
 *   (default)   Drop the columns for real.
 *
 * Usage:
 *   node src/scripts/dropOrgNumericBackupColumns.js
 *   node src/scripts/dropOrgNumericBackupColumns.js --dry-run
 *   node src/scripts/dropOrgNumericBackupColumns.js --count
 */

require('module-alias/register')
require('dotenv').config({ path: `${__dirname}/../.env` })

const db = require('@database/models/index')
const materializedViewsService = require('@generics/materializedViews')

const BACKUP_COLUMN = 'visible_to_organizations_numeric'

const TARGETS = [
	{ table: 'sessions', column: BACKUP_COLUMN },
	{ table: 'user_extensions', column: BACKUP_COLUMN },
]

const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--count')

/**
 * Checks whether a column exists in a given table.
 */
async function columnExists(table, column) {
	const [rows] = await db.sequelize.query(
		`SELECT 1
		   FROM information_schema.columns
		  WHERE table_name   = :table
		    AND column_name  = :column
		  LIMIT 1`,
		{ replacements: { table, column } }
	)
	return rows.length > 0
}

/**
 * Counts total rows and rows with a non-null value in the backup column.
 */
async function inspectColumn(table, column) {
	const [[totalRow]] = await db.sequelize.query(`SELECT COUNT(*) AS count FROM "${table}"`)
	const [[nonNullRow]] = await db.sequelize.query(
		`SELECT COUNT(*) AS count FROM "${table}" WHERE "${column}" IS NOT NULL`
	)
	return {
		totalRows: parseInt(totalRow.count, 10),
		nonNullRows: parseInt(nonNullRow.count, 10),
	}
}

async function main() {
	console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE DROP'}`)
	console.log('---')

	let hasError = false
	let droppedAny = false

	for (const { table, column } of TARGETS) {
		const exists = await columnExists(table, column)

		if (!exists) {
			console.log(`[${table}] Column "${column}" does not exist — already dropped or never created. Skipping.`)
			continue
		}

		const { totalRows, nonNullRows } = await inspectColumn(table, column)
		console.log(`[${table}] "${column}" found.`)
		console.log(`  Total rows    : ${totalRows}`)
		console.log(`  Non-null rows : ${nonNullRows}`)

		if (nonNullRows > 0 && !isDryRun) {
			console.warn(
				`  WARNING: ${nonNullRows} row(s) in "${table}" still have data in "${column}". ` +
					`Dropping anyway — make sure you have a DB backup before proceeding.`
			)
		}

		if (isDryRun) {
			console.log(`  [DRY RUN] Would run: ALTER TABLE "${table}" DROP COLUMN "${column}" CASCADE`)
			console.log('  [DRY RUN] Dependent materialized views would be dropped and rebuilt.')
		} else {
			try {
				await db.sequelize.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}" CASCADE`)
				console.log(`  Dropped "${column}" from "${table}" (CASCADE).`)
				droppedAny = true
			} catch (err) {
				console.error(`  ERROR dropping "${column}" from "${table}": ${err.message}`)
				hasError = true
			}
		}

		console.log('')
	}

	if (isDryRun) {
		console.log('Dry run complete. No changes were made.')
	} else {
		// Always rebuild views if any column was dropped via CASCADE, even on partial failure,
		// so dependent views aren't left missing after a successful drop.
		if (droppedAny) {
			console.log('Rebuilding materialized views (dropped by CASCADE)...')
			try {
				await materializedViewsService.checkAndCreateMaterializedViews()
				console.log('Materialized views rebuilt successfully.')
			} catch (err) {
				console.error('ERROR rebuilding materialized views:', err.message)
				process.exit(1)
			}
		}

		if (hasError) {
			console.error('Completed with errors. Check output above.')
			process.exit(1)
		}

		console.log('Done. Both backup columns have been dropped.')
		console.log(
			'Note: migration 20260525000002-rename-visible-to-org-codes.js down() is no longer fully reversible.'
		)
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Unexpected error:', err)
		process.exit(1)
	})
