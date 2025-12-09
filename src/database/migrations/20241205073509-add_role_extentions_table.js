'use strict'
/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('role_extensions', {
			id: {
				allowNull: false,
				autoIncrement: true,
				type: Sequelize.INTEGER,
			},
			title: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			label: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			status: {
				allowNull: false,
				type: Sequelize.STRING,
				defaultValue: 'ACTIVE',
			},
			scope: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			organization_id: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			deleted_at: {
				type: Sequelize.DATE,
			},
			created_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updated_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('role_extensions')
	},
}
