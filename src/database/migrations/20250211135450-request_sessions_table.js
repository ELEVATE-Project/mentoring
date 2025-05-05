'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('session_request', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			requestor_id: {
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
			},
			requestee_id: {
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
			},
			status: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			meta: {
				type: Sequelize.JSON,
			},
			title: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			agenda: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			start_date: {
				type: Sequelize.INTEGER,
			},
			end_date: {
				type: Sequelize.INTEGER,
			},
			session_id: {
				type: Sequelize.STRING,
			},
			reject_reason: {
				type: Sequelize.STRING,
			},
			updated_by: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			created_by: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
			},
			updated_at: {
				type: Sequelize.DATE,
				allowNull: false,
			},
			deleted_at: {
				type: Sequelize.DATE,
				allowNull: true,
			},
		})
		await queryInterface.addIndex('session_request', ['requestor_id'], {
			name: 'index_requestor_id_session_request',
		})
		await queryInterface.addIndex('session_request', ['status'], {
			name: 'index_status_session_request',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeIndex('session_request', 'index_status_session_request')
		await queryInterface.removeIndex('session_request', 'index_requestor_id_request_sessions')

		await queryInterface.dropTable('session_request')
	},
}
