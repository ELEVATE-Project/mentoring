'use strict'
/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('report_types', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			title: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			created_at: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.fn('NOW'),
			},
			updated_at: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.fn('NOW'),
			},
			deleted_at: {
				type: Sequelize.DATE,
			},
		})

		await queryInterface.addIndex('report_types', ['title'], {
			unique: true,
			where: {
				deleted_at: null,
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('report_types')
	},
}
