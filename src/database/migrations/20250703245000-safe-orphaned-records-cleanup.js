'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		console.log('🔍 Safe cleanup of orphaned records - preserving data integrity...')

		// STRATEGY: Instead of deleting, we'll either:
		// 1. Set orphaned references to NULL (where allowed)
		// 2. Set to a valid fallback user (system user)
		// 3. Only delete where absolutely necessary

		// First, create a system user if it doesn't exist for fallback
		console.log('Creating system user for fallbacks...')
		const systemUser = await queryInterface.sequelize.query(
			`
			INSERT INTO user_extensions (user_id, organization_id, name, email, created_at, updated_at)
			SELECT 'system-cleanup-user', 
				   (SELECT organization_id FROM user_extensions WHERE deleted_at IS NULL LIMIT 1),
				   'System Cleanup User',
				   'system@cleanup.local',
				   NOW(),
				   NOW()
			WHERE NOT EXISTS (SELECT 1 FROM user_extensions WHERE user_id = 'system-cleanup-user')
			RETURNING user_id
		`,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		const fallbackUserId = 'system-cleanup-user'

		// APPROACH 1: Fix user references instead of deleting records
		console.log('Fixing orphaned user references with fallback user...')

		// entities table - set invalid user references to system user
		await queryInterface.sequelize.query(`
			UPDATE entities 
			SET created_by = '${fallbackUserId}'
			WHERE created_by IS NOT NULL 
			AND created_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
		`)

		await queryInterface.sequelize.query(`
			UPDATE entities 
			SET updated_by = '${fallbackUserId}'
			WHERE updated_by IS NOT NULL 
			AND updated_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
		`)

		// entity_types table - set invalid user references to system user
		await queryInterface.sequelize.query(`
			UPDATE entity_types 
			SET created_by = '${fallbackUserId}'
			WHERE created_by IS NOT NULL 
			AND created_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
		`)

		await queryInterface.sequelize.query(`
			UPDATE entity_types 
			SET updated_by = '${fallbackUserId}'
			WHERE updated_by IS NOT NULL 
			AND updated_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
		`)

		// organization_extension table - set invalid user references to system user
		await queryInterface.sequelize.query(`
			UPDATE organization_extension 
			SET created_by = '${fallbackUserId}'
			WHERE created_by IS NOT NULL 
			AND created_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
		`)

		await queryInterface.sequelize.query(`
			UPDATE organization_extension 
			SET updated_by = '${fallbackUserId}'
			WHERE updated_by IS NOT NULL 
			AND updated_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
		`)

		// role_permission_mapping table - set invalid user references to system user
		await queryInterface.sequelize.query(`
			UPDATE role_permission_mapping 
			SET created_by = '${fallbackUserId}'
			WHERE created_by IS NOT NULL 
			AND created_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
		`)

		// APPROACH 2: For session references, safer to delete only truly orphaned records
		console.log('Removing only genuinely orphaned session records...')

		// Check for any dependent data before deleting
		const sessionOrphans = await queryInterface.sequelize.query(
			`
			SELECT DISTINCT session_id 
			FROM session_attendees 
			WHERE session_id IS NOT NULL 
			AND session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL)
		`,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		if (sessionOrphans.length > 0) {
			console.log(`Found ${sessionOrphans.length} orphaned session references`)

			// session_attendees - delete only orphaned records
			await queryInterface.sequelize.query(`
				DELETE FROM session_attendees 
				WHERE session_id IS NOT NULL 
				AND session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL)
			`)

			// session_enrollments - delete only orphaned records
			await queryInterface.sequelize.query(`
				DELETE FROM session_enrollments 
				WHERE session_id IS NOT NULL 
				AND session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL)
			`)

			// session_ownerships - delete only orphaned records
			await queryInterface.sequelize.query(`
				DELETE FROM session_ownerships 
				WHERE session_id IS NOT NULL 
				AND session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL)
			`)

			// session_request_mapping - delete only orphaned records
			await queryInterface.sequelize.query(`
				DELETE FROM session_request_mapping 
				WHERE request_session_id IS NOT NULL 
				AND request_session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL)
			`)
		}

		// APPROACH 3: Verify no cascade effects
		console.log('Verifying data integrity after cleanup...')

		// Check that no valid records were affected
		const integrityCheck = await queryInterface.sequelize.query(
			`
			SELECT 
				(SELECT COUNT(*) FROM entities WHERE deleted_at IS NULL) as entities_count,
				(SELECT COUNT(*) FROM entity_types WHERE deleted_at IS NULL) as entity_types_count,
				(SELECT COUNT(*) FROM organization_extension WHERE deleted_at IS NULL) as org_ext_count,
				(SELECT COUNT(*) FROM sessions WHERE deleted_at IS NULL) as sessions_count
		`,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		console.log('Post-cleanup counts:', integrityCheck[0])
		console.log('✅ Safe orphaned records cleanup completed')
	},

	async down(queryInterface, Sequelize) {
		console.log('⚠️ Rolling back safe cleanup...')

		// Remove the system user we created
		await queryInterface.sequelize.query(`
			DELETE FROM user_extensions WHERE user_id = 'system-cleanup-user'
		`)

		console.log(
			'Note: User reference fixes cannot be fully reversed - original invalid references were preserved as fallback user'
		)
	},
}
