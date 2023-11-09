'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('user_extensions', {
			name: DataTypes.STRING,
			isBetaMember: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
				allowNull: false,
			},
			status: {
				type: DataTypes.STRING,
			},
		})
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('user_extensions')
	},
}
