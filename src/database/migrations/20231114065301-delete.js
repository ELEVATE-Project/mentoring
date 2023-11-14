'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('user_extensions', {
			status: {
				type: Sequelize.STRING,
			},
		})
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('user_extensions')
	},
}
