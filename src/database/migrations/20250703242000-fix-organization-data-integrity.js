'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		console.log('🔧 Fixing organization data integrity issues...')

		// Fix tables with missing organization data that should have it

		// 1. Fix default_rules table - ensure all records have organization_id
		const defaultRulesCount = await queryInterface.sequelize.query(
			`
			SELECT COUNT(*) as count FROM default_rules WHERE organization_id IS NULL
		`,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		if (defaultRulesCount[0].count > 0) {
			console.log(`Fixing ${defaultRulesCount[0].count} default_rules records with missing organization_id`)

			// Set organization_id to a default value for orphaned default_rules
			// You may need to adjust this based on your business logic
			await queryInterface.sequelize.query(`
				UPDATE default_rules 
				SET organization_id = (
					SELECT organization_id 
					FROM user_extensions 
					WHERE deleted_at IS NULL 
					LIMIT 1
				)
				WHERE organization_id IS NULL
			`)
		}

		// 2. Fix users table - ensure all records have proper organization_id
		const usersCount = await queryInterface.sequelize.query(
			`
			SELECT COUNT(*) as count FROM users WHERE organization_id IS NULL
		`,
			{ type: Sequelize.QueryTypes.SELECT }
		)

		if (usersCount[0].count > 0) {
			console.log(`Fixing ${usersCount[0].count} users records with missing organization_id`)

			// Set organization_id for users based on their user_extensions data
			await queryInterface.sequelize.query(`
				UPDATE users 
				SET organization_id = (
					SELECT ue.organization_id::integer
					FROM user_extensions ue 
					WHERE ue.user_id = users.id::text
					AND ue.deleted_at IS NULL
					LIMIT 1
				)
				WHERE organization_id IS NULL
				AND EXISTS (
					SELECT 1 FROM user_extensions ue 
					WHERE ue.user_id = users.id::text 
					AND ue.deleted_at IS NULL
				)
			`)

			// Delete users that have no corresponding user_extensions record
			await queryInterface.sequelize.query(`
				DELETE FROM users 
				WHERE organization_id IS NULL
				AND NOT EXISTS (
					SELECT 1 FROM user_extensions ue 
					WHERE ue.user_id = users.id::text 
					AND ue.deleted_at IS NULL
				)
			`)
		}

		console.log('✅ Organization data integrity fixes completed')
	},

	async down(queryInterface, Sequelize) {
		console.log('⚠️ Cannot reverse organization data integrity fixes')
		// These fixes are data corrections and should not be reversed
	},
}
