'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Insert data into the report_role_mapping table
		await queryInterface.bulkInsert('report_role_mapping', [
			{
				report_code: 'total_number_of_sessions_attended',
				role_title: 'mentee',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'total_hours_of_learning',
				role_title: 'mentee',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'split_of_sessions_enrolled_and_attended_by_user',
				role_title: 'mentee',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'mentee_session_details',
				role_title: 'mentee',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'total_number_of_sessions_conducted',
				role_title: 'mentor',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'total_hours_of_mentoring_conducted',
				role_title: 'mentor',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'split_of_sessions_conducted',
				role_title: 'mentor',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'mentoring_session_details',
				role_title: 'mentor',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'total_hours_of_sessions_created_by_session_manager',
				role_title: 'session_manager',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'total_number_of_hours_of_mentoring_conducted',
				role_title: 'session_manager',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'split_of_sessions_created_and_conducted',
				role_title: 'session_manager',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				report_code: 'session_manger_session_details',
				role_title: 'session_manager',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
		])
	},

	async down(queryInterface, Sequelize) {
		// Revert the inserted data by deleting rows based on the report_code values
		await queryInterface.bulkDelete('report_role_mapping', {
			report_code: [
				'total_number_of_sessions_attended',
				'total_hours_of_learning',
				'split_of_sessions_enrolled_and_attended_by_user',
				'mentee_session_details',
				'total_number_of_sessions_conducted',
				'total_hours_of_mentoring_conducted',
				'split_of_sessions_conducted',
				'mentoring_session_details',
				'total_hours_of_sessions_created_by_session_manager',
				'total_number_of_hours_of_mentoring_conducted',
				'split_of_sessions_created_and_conducted',
				'session_manger_session_details',
			],
		})
	},
}
