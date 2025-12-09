'use strict'
/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('report_role_mapping', {
			id: {
				allowNull: false,
				autoIncrement: true,
				type: Sequelize.INTEGER,
			},
			report_code: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			role_title: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
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
		await queryInterface.addIndex('report_role_mapping', {
			fields: ['report_code'],
			name: 'idx_report_role_mapping_report_code',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('report_role_mapping')
	},
}
