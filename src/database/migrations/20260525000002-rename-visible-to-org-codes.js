'use strict'
require('module-alias/register')
require('dotenv').config()
const materializedViewsService = require('@generics/materializedViews')

/**
 * PR 2 — Rename migration for Issue 3 (organization_id → organization_code deprecation).
 *
 * Renames the old visible_to_organizations columns (numeric IDs) to
 * visible_to_organizations_numeric as a backup, then promotes visible_to_organization_codes
 * (org code strings) to take the visible_to_organizations name.
 *
 * This keeps the original column name in the final schema (no code or model changes needed)
 * and preserves the numeric backup so down() is fully reversible.
 *
 * IMPORTANT: Run AFTER verifying PR 1 migration data side-by-side.
 * Deploy this migration together with the PR 2 code changes.
 * The _numeric backup columns can be dropped in a follow-up cleanup migration once verified.
 */
module.exports = {
	async up(queryInterface) {
		// sessions: park old column as backup, promote new column to primary name
		await queryInterface.renameColumn('sessions', 'visible_to_organizations', 'visible_to_organizations_numeric')
		await queryInterface.renameColumn('sessions', 'visible_to_organization_codes', 'visible_to_organizations')
		console.log(
			'sessions: visible_to_organizations (numeric) → visible_to_organizations_numeric (backup); visible_to_organization_codes → visible_to_organizations'
		)

		// user_extensions: same swap
		await queryInterface.renameColumn(
			'user_extensions',
			'visible_to_organizations',
			'visible_to_organizations_numeric'
		)
		await queryInterface.renameColumn(
			'user_extensions',
			'visible_to_organization_codes',
			'visible_to_organizations'
		)
		console.log(
			'user_extensions: visible_to_organizations (numeric) → visible_to_organizations_numeric (backup); visible_to_organization_codes → visible_to_organizations'
		)

		// Rebuild materialized views: visible_to_organizations is now varchar[] not integer[],
		// and mentor_organization_code is a new concrete column — existing views must be replaced.
		console.log('Rebuilding materialized views for all tenants...')
		await materializedViewsService.triggerViewBuildForAllTenants()
		console.log('Materialized view rebuild complete')
	},

	async down(queryInterface) {
		// Fully reversible: rename both columns back to their pre-up names.
		// Numeric ID data is preserved in visible_to_organizations_numeric throughout.
		await queryInterface.renameColumn('sessions', 'visible_to_organizations', 'visible_to_organization_codes')
		await queryInterface.renameColumn('sessions', 'visible_to_organizations_numeric', 'visible_to_organizations')

		await queryInterface.renameColumn(
			'user_extensions',
			'visible_to_organizations',
			'visible_to_organization_codes'
		)
		await queryInterface.renameColumn(
			'user_extensions',
			'visible_to_organizations_numeric',
			'visible_to_organizations'
		)

		console.log('Reverted rename. Numeric ID data fully restored in visible_to_organizations.')

		// Rebuild views to reflect the reverted column names and types
		console.log('Rebuilding materialized views for all tenants...')
		await materializedViewsService.triggerViewBuildForAllTenants()
		console.log('Materialized view rebuild complete')
	},
}
