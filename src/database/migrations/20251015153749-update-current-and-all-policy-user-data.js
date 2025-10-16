'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			const [orgResults] = await queryInterface.sequelize.query(
				`
        SELECT organization_id FROM organization_extension WHERE 
          session_visibility_policy IN ('CURRENT', 'ALL') OR 
          external_mentor_visibility_policy IN ('CURRENT', 'ALL') OR 
          mentor_visibility_policy IN ('CURRENT', 'ALL') OR 
          external_session_visibility_policy IN ('CURRENT', 'ALL');;
        `,
				{ transaction }
			)

			const orgIds = orgResults.map((org) => org.organization_id)

			const chunkArray = (arr, size) => {
				const result = []
				for (let i = 0; i < arr.length; i += size) {
					result.push(arr.slice(i, i + size))
				}
				return result
			}

			const batches = chunkArray(orgIds, 1000)

			for (const batch of batches) {
				await queryInterface.sequelize.query(
					`
            UPDATE user_extensions
            SET visible_to_organizations = '{}'::varchar[]
            WHERE organization_id IN (:batch)
          `,
					{
						replacements: { batch },
						type: Sequelize.QueryTypes.UPDATE,
						transaction,
					}
				)
			}

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		console.warn('WARNING: This migration does not have a safe automated rollback.')
		console.warn('Manual restoration of visible_to_organizations may be required.')
	},
}
