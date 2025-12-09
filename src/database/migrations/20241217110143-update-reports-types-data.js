'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			// Insert each title individually in a loop
			const titles = ['big_number', 'line_chart', 'table', 'bar_chart']

			for (const title of titles) {
				await queryInterface.bulkInsert(
					'report_types',
					[
						{
							title,
							created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
							updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
						},
					],
					{ transaction }
				)
			}

			await transaction.commit()
			console.log('Inserted report types successfully.')
		} catch (error) {
			await transaction.rollback()
			console.error('Error inserting report types:', error)
			throw error // Propagate error to ensure Sequelize logs the failure
		}
	},

	async down(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			// Delete the inserted titles
			const titles = ['big_number', 'line_chart', 'table', 'bar_chart']

			for (const title of titles) {
				await queryInterface.bulkDelete('report_types', { title }, { transaction })
			}

			await transaction.commit()
			console.log('Deleted report types successfully.')
		} catch (error) {
			await transaction.rollback()
			console.error('Error deleting report types:', error)
			throw error // Propagate error to ensure Sequelize logs the failure
		}
	},
}
