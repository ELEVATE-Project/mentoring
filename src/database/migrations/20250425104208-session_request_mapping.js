'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('session_request_mapping', {
			requestee_id: {
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
			},
			request_session_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				primaryKey: true,
			},
		})
		await queryInterface.addIndex('session_request_mapping', ['requestee_id'], {
			name: 'index_requestee_id_session_request_mapping',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeIndex('session_request_mapping', 'index_requestee_id_session_request_mapping')
	},
}
