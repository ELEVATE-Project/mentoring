'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.sequelize.transaction(async (transaction) => {
			await queryInterface.sequelize.query(
				`UPDATE entity_types SET allow_filtering = false WHERE value = 'status';`,
				{ transaction }
			)
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.sequelize.transaction(async (transaction) => {
			await queryInterface.sequelize.query(
				`UPDATE entity_types SET allow_filtering = true WHERE value = 'status';`,
				{ transaction }
			)
		})
	},
}
