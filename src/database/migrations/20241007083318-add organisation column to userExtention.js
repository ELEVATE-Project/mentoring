'use strict'
require('module-alias/register')
require('dotenv').config({ path: '../../.env' })
const userRequests = require('@requests/user')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			const { STRING } = Sequelize

			await queryInterface.addColumn('user_extensions', 'organization_name', { type: STRING, allowNull: true })

			// Fetch the count of distinct organizations
			const [[orgList]] = await queryInterface.sequelize.query(
				'SELECT COUNT(DISTINCT organization_id) AS count FROM user_extensions WHERE deleted_at IS NULL;'
			)

			const orgsCount = orgList.count
			console.log(`Number of organizations: ${orgsCount}`)

			const getOrgDetails = async (orgIds, batchSize = 500) => {
				const updateBatch = async (batchOrgs) => {
					const orgDetails = await userRequests.listOrganization(batchOrgs)

					if (!orgDetails.success || !orgDetails.data.result) {
						console.error(`Failed to retrieve organization details for batch: ${batchOrgs}`)
						return
					}

					const updatePromises = orgDetails.data.result.map(async (orgInfo) => {
						console.log(`Updating user_extensions for the : ${orgInfo.name} (ID: ${orgInfo.id})`)
						await queryInterface.sequelize.query(
							`UPDATE user_extensions 
                             SET organization_name = :organization_name 
                             WHERE organization_id = :organizationId`,
							{
								replacements: {
									organization_name: orgInfo.name,
									organizationId: orgInfo.id.toString(),
								},
							}
						)
					})

					await Promise.all(updatePromises)
				}

				for (let i = 0; i < orgIds.length; i += batchSize) {
					const batch = orgIds.slice(i, i + batchSize)
					await updateBatch(batch)
				}
			}

			if (orgsCount > 0) {
				const [orgsList] = await queryInterface.sequelize.query(
					'SELECT DISTINCT organization_id FROM user_extensions WHERE deleted_at IS NULL;'
				)
				const orgIds = orgsList.map((item) => item.organization_id)
				await getOrgDetails(orgIds)
			}
		} catch (error) {
			console.error('Migration failed:', error)
			throw error
		}
	},

	down: async (queryInterface) => {
		try {
			await queryInterface.removeColumn('user_extensions', 'organization_name')
		} catch (err) {
			console.error('Rollback failed:', err)
			throw err
		}
	},
}
