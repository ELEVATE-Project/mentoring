'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			const replacements = { report_filter: true }

			const entityTypesToUpdate = [
				{ value: 'type', label: 'Type' },
				{ value: 'categories', label: 'Categories' },
			]

			// Fetch and update records for each value/label pair
			const updateEntityTypePromises = entityTypesToUpdate.map(async (item) => {
				try {
					const entityTypes = await queryInterface.sequelize.query(
						`SELECT id, value, label, organization_id, model_names 
             FROM public.entity_types 
             WHERE value = :value
               AND label = :label
               AND organization_id = :organization_id
               AND model_names = :model_names;`,
						{
							replacements: { ...item, organization_id: '1', model_names: '{Session}' },
							type: Sequelize.QueryTypes.SELECT,
							transaction,
						}
					)

					// If no records found, log the error and continue
					if (entityTypes.length === 0) {
						console.error(`No entity types found for ${item.value} - ${item.label}`)
						return
					}

					// Update report_filter for each matching entityType
					const updatePromises = entityTypes.map((entityType) => {
						return queryInterface.sequelize.query(
							`UPDATE public.entity_types 
               SET report_filter = :report_filter 
               WHERE id = :id;`,
							{
								replacements: { ...replacements, id: entityType.id },
								transaction,
							}
						)
					})

					// Wait for all update queries to finish
					await Promise.all(updatePromises)
				} catch (error) {
					console.error(`Error processing ${item.value} - ${item.label}:`, error)
					throw error // Propagate error to trigger rollback
				}
			})

			// Execute all update promises
			await Promise.all(updateEntityTypePromises)

			await transaction.commit()
			console.log('Updated report_filter successfully.')
		} catch (error) {
			await transaction.rollback()
			console.error('Error updating report_filter:', error)
			throw error // Rethrow to ensure Sequelize logs the failure
		}
	},

	async down(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			const replacements = { report_filter: false }

			const entityTypesToRevert = [
				{ value: 'medium', label: 'Medium' },
				{ value: 'type', label: 'Type' },
				{ value: 'recommended_for', label: 'Recommended For' },
				{ value: 'categories', label: 'Categories' },
			]

			// Fetch and revert records for each value/label pair
			const revertEntityTypePromises = entityTypesToRevert.map(async (item) => {
				try {
					const entityTypes = await queryInterface.sequelize.query(
						`SELECT id, value, label, organization_id, model_names 
             FROM public.entity_types 
             WHERE value = :value
               AND label = :label
               AND organization_id = :organization_id
               AND model_names = :model_names;`,
						{
							replacements: { ...item, organization_id: '1', model_names: '{Session}' },
							type: Sequelize.QueryTypes.SELECT,
							transaction,
						}
					)

					// If no records found, log and continue
					if (entityTypes.length === 0) {
						console.error(`No entity types found for ${item.value} - ${item.label}`)
						return
					}

					// Revert report_filter for each matching entityType
					const revertPromises = entityTypes.map((entityType) => {
						return queryInterface.sequelize.query(
							`UPDATE public.entity_types 
               SET report_filter = :report_filter 
               WHERE id = :id;`,
							{
								replacements: { ...replacements, id: entityType.id },
								transaction,
							}
						)
					})

					// Wait for all revert queries to finish
					await Promise.all(revertPromises)
				} catch (error) {
					console.error(`Error processing revert for ${item.value} - ${item.label}:`, error)
					throw error // Propagate error to trigger rollback
				}
			})

			// Execute all revert promises
			await Promise.all(revertEntityTypePromises)

			await transaction.commit()
			console.log('Reverted report_filter successfully.')
		} catch (error) {
			await transaction.rollback()
			console.error('Error reverting report_filter:', error)
			throw error // Rethrow to ensure Sequelize logs the failure
		}
	},
}
