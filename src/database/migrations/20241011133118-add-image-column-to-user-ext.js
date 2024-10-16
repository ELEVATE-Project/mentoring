'use strict'
require('module-alias/register')
require('dotenv').config({ path: '../../.env' })
const userRequests = require('@requests/user')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			const { STRING } = Sequelize

			await queryInterface.addColumn('user_extensions', 'image', { type: STRING, allowNull: true })
		} catch (error) {
			console.error('Migration failed:', error)
			throw error
		}
	},

	down: async (queryInterface) => {
		try {
			await queryInterface.removeColumn('user_extensions', 'image')
		} catch (err) {
			console.error('Rollback failed:', err)
			throw err
		}
	},
}
