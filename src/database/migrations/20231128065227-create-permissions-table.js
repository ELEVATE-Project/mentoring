'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('permissions', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			code: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			module: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			actions: {
				allowNull: false,
				type: Sequelize.ENUM('ALL', 'READ', 'WRITE', 'UPDATE', 'DELETE'),
			},
			status: {
				type: Sequelize.STRING,
				defaultValue: 'ACTIVE',
			},
		})
		await queryInterface.addIndex('permissions', ['code'], {
			unique: true,
			name: 'unique_code',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('permissions')
	},
}
