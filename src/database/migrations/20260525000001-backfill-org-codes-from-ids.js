'use strict'

/**
 * PR 1 — Migrations gate for Issue 3 (organization_id → organization_code deprecation).
 *
 * Adds mentor_organization_code to sessions and backfills visible_to_organizations
 * arrays in sessions + user_extensions from numeric IDs to org code strings.
 *
 * Strategy: load the full org lookup into JS, map in JS, write back in batches.
 * No complex SQL joins — easy to read and debug.
 *
 * IMPORTANT: Deploy and verify this migration BEFORE deploying the PR 2 code changes.
 */
module.exports = {
	async up(queryInterface, Sequelize) {
		// ── 0. Add the new column (safe to run even if it already exists) ──────
		const [existing] = await queryInterface.sequelize.query(`
			SELECT 1 FROM information_schema.columns
			WHERE  table_name = 'sessions' AND column_name = 'mentor_organization_code'
		`)
		if (existing.length === 0) {
			await queryInterface.addColumn('sessions', 'mentor_organization_code', {
				type: Sequelize.STRING,
				allowNull: true,
			})
			console.log('Added column: sessions.mentor_organization_code')
		}

		// ── 1. Build org ID → code lookup (one query, shared by all steps) ────
		const [orgRows] = await queryInterface.sequelize.query(`
			SELECT organization_id, organization_code, tenant_code
			FROM   organization_extension
		`)

		// Primary key: "tenantCode:orgId"  →  orgCode
		const lookup = new Map(orgRows.map((r) => [`${r.tenant_code}:${r.organization_id}`, r.organization_code]))

		// Fallback: orgId alone → orgCode, for rows where the session's tenant_code does not
		// match the tenant_code on the organization_extension row for the same numeric org ID.
		// Last-write wins when the same org_id appears under multiple tenants — acceptable
		// for backfill because org codes are stable and unique per org across tenants.
		const fallbackLookup = new Map(orgRows.map((r) => [String(r.organization_id), r.organization_code]))

		const toCode = (id, tenantCode) =>
			lookup.get(`${tenantCode}:${String(id)}`) ?? fallbackLookup.get(String(id)) ?? null

		// Convert each element of a visible_to_organizations array.
		// Unknown IDs are left as-is so data is never silently lost.
		const toCodeArray = (arr, tenantCode) => arr.map((id) => toCode(id, tenantCode) ?? id)

		// Format a JS string array as a Postgres array literal: {val1,val2}
		const pgArr = (arr) => `{${arr.join(',')}}`

		// ── Step 1: sessions.mentor_organization_code ─────────────────────────
		console.log('\nStep 1: Backfilling sessions.mentor_organization_code ...')

		const [sessions] = await queryInterface.sequelize.query(`
			SELECT id, mentor_organization_id, tenant_code
			FROM   sessions
		`)

		const sessionCodeUpdates = sessions
			.map((s) => ({ id: s.id, code: toCode(s.mentor_organization_id, s.tenant_code) }))
			.filter((u) => u.code !== null)

		if (sessionCodeUpdates.length) {
			// Batch all updates in one VALUES-based UPDATE — no per-row round trips
			const values = sessionCodeUpdates.map((u) => `(${u.id}, '${u.code}')`).join(', ')
			await queryInterface.sequelize.query(`
				UPDATE sessions
				SET    mentor_organization_code = v.code
				FROM   (VALUES ${values}) AS v(id, code)
				WHERE  sessions.id = v.id::int
			`)
		}

		console.log(`  Updated ${sessionCodeUpdates.length} / ${sessions.length} rows`)

		// ── Step 2: sessions.visible_to_organization_codes (new column) ──────
		console.log('\nStep 2: Adding and backfilling sessions.visible_to_organization_codes ...')

		const [existingVtoSessions] = await queryInterface.sequelize.query(`
			SELECT 1 FROM information_schema.columns
			WHERE  table_name = 'sessions' AND column_name = 'visible_to_organization_codes'
		`)
		if (existingVtoSessions.length === 0) {
			await queryInterface.addColumn('sessions', 'visible_to_organization_codes', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: true,
			})
			console.log('  Added column: sessions.visible_to_organization_codes')
		}

		const [sessionRows] = await queryInterface.sequelize.query(`
			SELECT id, visible_to_organizations, tenant_code
			FROM   sessions
			WHERE  visible_to_organizations IS NOT NULL
		`)

		let sessionArrUpdated = 0
		for (const row of sessionRows) {
			const newArr = toCodeArray(row.visible_to_organizations, row.tenant_code)
			await queryInterface.sequelize.query(
				'UPDATE sessions SET visible_to_organization_codes = :arr WHERE id = :id',
				{ replacements: { arr: pgArr(newArr), id: row.id } }
			)
			sessionArrUpdated++
		}

		console.log(`  Updated ${sessionArrUpdated} rows`)

		// ── Step 3: user_extensions.visible_to_organization_codes ─────────────
		console.log('\nStep 3: Adding and backfilling user_extensions.visible_to_organization_codes ...')

		const [existingVtoUE] = await queryInterface.sequelize.query(`
			SELECT 1 FROM information_schema.columns
			WHERE  table_name = 'user_extensions' AND column_name = 'visible_to_organization_codes'
		`)
		if (existingVtoUE.length === 0) {
			await queryInterface.addColumn('user_extensions', 'visible_to_organization_codes', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: true,
			})
			console.log('  Added column: user_extensions.visible_to_organization_codes')
		}

		const [ueRows] = await queryInterface.sequelize.query(`
			SELECT user_id, visible_to_organizations, tenant_code
			FROM   user_extensions
			WHERE  visible_to_organizations IS NOT NULL
		`)

		let ueUpdated = 0
		for (const row of ueRows) {
			const newArr = toCodeArray(row.visible_to_organizations, row.tenant_code)
			await queryInterface.sequelize.query(
				`UPDATE user_extensions
				 SET    visible_to_organization_codes = :arr
				 WHERE  user_id     = :userId
				   AND  tenant_code = :tenantCode`,
				{ replacements: { arr: pgArr(newArr), userId: row.user_id, tenantCode: row.tenant_code } }
			)
			ueUpdated++
		}

		console.log(`  Updated ${ueUpdated} rows`)
	},

	async down(queryInterface) {
		// All new columns are dropped. Original columns (mentor_organization_id,
		// visible_to_organizations) are untouched so data is fully preserved.
		await queryInterface.removeColumn('sessions', 'mentor_organization_code')
		await queryInterface.removeColumn('sessions', 'visible_to_organization_codes')
		await queryInterface.removeColumn('user_extensions', 'visible_to_organization_codes')
		console.log('Removed new columns. Original data in existing columns is untouched.')
	},
}
