'use strict'

require('module-alias/register')
const common = require('@constants/common')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// Data to be inserted
			const roleExtensionsData = [
				{
					title: 'user',
					label: 'User',
					status: 'ACTIVE',
					scope: 'SELF',
					organization_id: '1',
					created_at: new Date(),
					updated_at: new Date(),
					deleted_at: null,
				},
				{
					title: 'mentor',
					label: 'Mentor',
					status: 'ACTIVE',
					scope: 'SELF',
					organization_id: '1',
					created_at: new Date(),
					updated_at: new Date(),
					deleted_at: null,
				},
				{
					title: 'mentee',
					label: 'Mentee',
					status: 'ACTIVE',
					scope: 'SELF',
					organization_id: '1',
					created_at: new Date(),
					updated_at: new Date(),
					deleted_at: null,
				},
				{
					title: 'admin',
					label: 'Admin',
					status: 'ACTIVE',
					scope: 'ALL',
					organization_id: '1',
					created_at: new Date(),
					updated_at: new Date(),
					deleted_at: null,
				},
				{
					title: 'org_admin',
					label: 'Org Admin',
					status: 'ACTIVE',
					scope: 'ALL',
					organization_id: '1',
					created_at: new Date(),
					updated_at: new Date(),
					deleted_at: null,
				},
				{
					title: 'session_manager',
					label: 'Session Manager',
					status: 'ACTIVE',
					scope: 'ASSOCIATED',
					organization_id: '1',
					created_at: new Date(),
					updated_at: new Date(),
					deleted_at: null,
				},
			]

			// Insert data into the role_extensions table
			await queryInterface.bulkInsert('role_extensions', roleExtensionsData)
		} catch (error) {
			console.error('Error inserting data into role_extensions:', error)
			throw error
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			// Delete all data from the role_extensions table
			await queryInterface.bulkDelete('role_extensions', null, {})
		} catch (error) {
			console.error('Error deleting data from role_extensions:', error)
			throw error
		}
	},
}
