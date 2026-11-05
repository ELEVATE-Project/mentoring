'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		const table = await queryInterface.describeTable('session_request')

		if (!table.requestee_id || table.requestee_id.allowNull !== true) {
			await queryInterface.changeColumn('session_request', 'requestee_id', {
				type: Sequelize.STRING,
				allowNull: true,
			})
		}

		if (!table.assignment_type) {
			await queryInterface.addColumn('session_request', 'assignment_type', {
				type: Sequelize.ENUM('SPECIFIC', 'GROUP', 'PUBLIC'),
				allowNull: false,
				defaultValue: 'PUBLIC',
			})
		}

		if (!table.requestees) {
			await queryInterface.addColumn('session_request', 'requestees', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: true,
				defaultValue: [],
			})
		}

		if (!table.rejected_requestees) {
			await queryInterface.addColumn('session_request', 'rejected_requestees', {
				type: Sequelize.ARRAY(Sequelize.STRING),
				allowNull: true,
				defaultValue: [],
			})
		}
	},

	down: async (queryInterface, Sequelize) => {
		const table = await queryInterface.describeTable('session_request')

		if (table.rejected_requestees) {
			await queryInterface.removeColumn('session_request', 'rejected_requestees')
		}
		if (table.requestees) {
			await queryInterface.removeColumn('session_request', 'requestees')
		}
		if (table.assignment_type) {
			await queryInterface.removeColumn('session_request', 'assignment_type')
			await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_session_request_assignment_type";')
		}

		// Will throw if any row already has requestee_id = NULL by the time this runs.
		await queryInterface.changeColumn('session_request', 'requestee_id', {
			type: Sequelize.STRING,
			allowNull: false,
		})
	},
}
