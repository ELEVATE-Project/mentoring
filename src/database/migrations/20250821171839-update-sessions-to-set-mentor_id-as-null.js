'use strict'

require('dotenv').config()
const materializedViewsService = require('@generics/materializedViews')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS m_user_extensions;')
		await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS m_mentor_extensions;')
		await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS m_sessions;')

		await queryInterface.changeColumn('sessions', 'mentor_id', {
			type: Sequelize.STRING,
			allowNull: true,
		})
		await materializedViewsService.checkAndCreateMaterializedViews()
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('sessions', 'mentor_id', {
			type: Sequelize.STRING,
			allowNull: false,
		})
	},
}
