'use strict'
/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('reports', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			code: {
				allowNull: false,
				type: Sequelize.STRING(255),
			},
			title: {
				allowNull: false,
				type: Sequelize.STRING(255),
			},
			description: {
				type: Sequelize.TEXT,
			},
			report_type_title: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			config: {
				type: Sequelize.JSONB,
			},
			organization_id: {
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

		await queryInterface.addIndex('reports', ['code', 'organization_id'], {
			unique: true,
			name: 'report_code_organization_unique',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('reports')
	},
}
