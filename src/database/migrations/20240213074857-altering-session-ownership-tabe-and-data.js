'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Remove the primary key constraint on mentor_id
		await queryInterface.removeConstraint('session_ownerships', 'session_ownerships_pkey')
		// change mentor_id column name
		await queryInterface.renameColumn('session_ownerships', 'mentor_id', 'user_id')
		// add new column called type
		await queryInterface.addColumn('session_ownerships', 'type', {
			allowNull: false,
			type: Sequelize.STRING,
			defaultValue: 'MENTOR',
			primaryKey: true,
		})

		// create new entries for creator type for old data
		const oldSessionOwnerships = await queryInterface.sequelize.query('SELECT * FROM session_ownerships', {
			type: Sequelize.QueryTypes.SELECT,
		})
		// Do only if old data is present
		if (oldSessionOwnerships.length > 0) {
			const creatorEntries = oldSessionOwnerships.map((entry) => ({
				...entry,
				type: 'CREATOR',
			}))

			await queryInterface.bulkInsert('session_ownerships', creatorEntries)
		}

		await queryInterface.addConstraint('session_ownerships', {
			fields: ['user_id', 'session_id', 'type'],
			type: 'primary key',
			name: 'session_ownerships_user_session_type_pkey',
		})
	},

	async down(queryInterface, Sequelize) {
		// Delete all entries where type='CREATOR'
		await queryInterface.bulkDelete('session_ownerships', { type: 'CREATOR' })

		// remove added primarykey constrain
		await queryInterface.removeConstraint('session_ownerships', 'session_ownerships_user_session_type_pkey')
		// revert column change
		await queryInterface.renameColumn('session_ownerships', 'user_id', 'mentor_id')
		// remove type column
		await queryInterface.removeColumn('session_ownerships', 'type')

		// Add back the primary key constraint on mentor_id
		await queryInterface.addConstraint('session_ownerships', {
			fields: ['mentor_id', 'session_id'],
			type: 'primary key',
			name: 'session_ownerships_pkey',
		})
	},
}
