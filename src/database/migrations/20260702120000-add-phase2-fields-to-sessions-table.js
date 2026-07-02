'use strict'
require('module-alias/register')
require('dotenv').config()
const materializedViewsService = require('@generics/materializedViews')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			// dropping the sessions view before altering the table
			await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS m_sessions;')

			await queryInterface.addColumn('sessions', 'province', {
				type: Sequelize.STRING,
				allowNull: true,
			})
			await queryInterface.addColumn('sessions', 'site', {
				type: Sequelize.STRING,
				allowNull: true,
			})
			await queryInterface.addColumn('sessions', 'learning_objectives', {
				type: Sequelize.TEXT,
				allowNull: true,
			})
			await queryInterface.addColumn('sessions', 'delivery_format', {
				type: Sequelize.STRING,
				allowNull: true,
			})
			await queryInterface.addColumn('sessions', 'target_audience', {
				type: Sequelize.STRING,
				allowNull: true,
			})
			await queryInterface.addColumn('sessions', 'max_participants', {
				type: Sequelize.INTEGER,
				allowNull: true,
			})
			await queryInterface.addColumn('sessions', 'certificate_provided', {
				type: Sequelize.BOOLEAN,
				allowNull: true,
				defaultValue: false,
			})
			await queryInterface.addColumn('sessions', 'is_recurring', {
				type: Sequelize.BOOLEAN,
				allowNull: true,
				defaultValue: false,
			})
			await queryInterface.addColumn('sessions', 'resource_content', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: true,
			})

			await materializedViewsService.checkAndCreateMaterializedViews()
		} catch (error) {
			console.error(error)
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		try {
			await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS m_sessions;')

			await queryInterface.removeColumn('sessions', 'province')
			await queryInterface.removeColumn('sessions', 'site')
			await queryInterface.removeColumn('sessions', 'learning_objectives')
			await queryInterface.removeColumn('sessions', 'delivery_format')
			await queryInterface.removeColumn('sessions', 'target_audience')
			await queryInterface.removeColumn('sessions', 'max_participants')
			await queryInterface.removeColumn('sessions', 'certificate_provided')
			await queryInterface.removeColumn('sessions', 'is_recurring')
			await queryInterface.removeColumn('sessions', 'resource_content')

			await materializedViewsService.checkAndCreateMaterializedViews()
		} catch (error) {
			console.error(error)
			throw error
		}
	},
}
