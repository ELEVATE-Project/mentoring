'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('request_sessions', {
			id: {
				type: Sequelize.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			user_id: {
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
			},
			friend_id: {
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
			agenda: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			start_date: {
				type: Sequelize.INTEGER,
			},
			end_date: {
				type: Sequelize.INTEGER,
			},
			session_id: {
				type: Sequelize.STRING,
				allowNull: true,
				primaryKey: true,
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
		await queryInterface.addIndex('request_sessions', ['user_id', 'friend_id'], {
			unique: true,
			name: 'unique_user_id_friend_id_request_sessions',
			where: {
				deleted_at: null,
			},
		})
		await queryInterface.addIndex('request_sessions', ['friend_id'], {
			name: 'index_friend_id_request_sessions',
		})
		await queryInterface.addIndex('request_sessions', ['status'], {
			name: 'index_status_request_sessions',
		})
		await queryInterface.addIndex('request_sessions', ['created_by'], {
			name: 'index_created_by_request_sessions',
		})
		await queryInterface.addIndex('request_sessions', ['session_id'], {
			name: 'index_session_id_request_sessions',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeIndex('request_sessions', 'index_friend_id_request_sessions')
		await queryInterface.removeIndex('request_sessions', 'index_status_request_sessions')
		await queryInterface.removeIndex('request_sessions', 'unique_user_id_friend_id_request_sessions')
		await queryInterface.removeIndex('request_sessions', 'index_created_by_request_sessions')
		await queryInterface.removeIndex('request_sessions', 'index_session_id_request_sessions')

		await queryInterface.dropTable('request_sessions')
	},
}
