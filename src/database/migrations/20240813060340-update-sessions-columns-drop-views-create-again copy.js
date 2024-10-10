'use strict'
require('module-alias/register')
require('dotenv').config()
const materializedViewsService = require('@generics/materializedViews')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			// droping the sessions views
			await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS m_sessions;')

			await queryInterface.changeColumn('sessions', 'categories', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: true,
			})
			await queryInterface.changeColumn('sessions', 'recommended_for', {
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

			await queryInterface.changeColumn('sessions', 'categories', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: false,
			})
			await queryInterface.changeColumn('sessions', 'recommended_for', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: false,
			})

			await materializedViewsService.checkAndCreateMaterializedViews()
		} catch (error) {
			console.error(error)
			throw error
		}
	},
}
