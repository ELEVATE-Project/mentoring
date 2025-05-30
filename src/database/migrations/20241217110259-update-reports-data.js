'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId

		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		// Insert the report data into the reports table
		await queryInterface.bulkInsert('reports', [
			{
				code: 'total_number_of_sessions_attended',
				title: 'Total number of sessions attended',
				description: 'Total sessions attended by user in big number',
				report_type_title: 'big_number',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'total_hours_of_learning',
				title: 'Total hours of learning',
				description: 'Total hours of learning by user in big number',
				report_type_title: 'big_number',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'split_of_sessions_enrolled_and_attended_by_user',
				title: 'Total sessions enrolled vs total sessions attended',
				description: 'Split of sessions enrolled and attended by user in bar chart',
				report_type_title: 'bar_chart',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'mentee_session_details',
				title: 'Session details',
				description: 'Mentee session details table with pagination and downloadable pdf',
				report_type_title: 'table',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: JSON.stringify({
					columns: [
						{
							key: 'sessions_title',
							label: 'Sessions Title',
							filter: false,
							sort: true,
							search: true,
							filterType: '=',
							isEntityType: false,
							isMultipleFilter: false,
						},
						{
							key: 'sessions_created_by',
							label: 'Sessions Created By',
							filter: false,
							sort: true,
							search: true,
							filterType: '=',
							isEntityType: false,
							isMultipleFilter: false,
						},
						{
							key: 'mentor_name',
							label: 'Mentor Name',
							filter: false,
							sort: true,
							search: true,
							filterType: '=',
							isEntityType: false,
							isMultipleFilter: false,
						},
						{
							key: 'date_of_session',
							label: 'Date of Session',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							dataType: 'Date',
							isEntityType: false,
							isMultipleFilter: true,
						},
						{
							key: 'session_type',
							label: 'Session Type',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							isEntityType: false,
							defaultValues: [
								{ label: 'ALL', value: ['PUBLIC','PRIVATE'] },
								{ label: 'PUBLIC', value: 'PUBLIC' },
								{ label: 'PRIVATE', value: 'PRIVATE' },
							],
							isMultipleFilter: false,
						},
						{
							key: 'categories',
							label: 'Categories',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							isEntityType: true,
							isMultipleFilter: true,
						},
						{
							key: 'recommended_for',
							label: 'Recommended for',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							isEntityType: true,
							isMultipleFilter: true,
						},
						{
							key: 'session_attended',
							label: 'Session Attended',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							isEntityType: false,
							defaultValues: [
								{ label: 'Yes', value: 'Yes' },
								{ label: 'No', value: 'No' },
							],
							isMultipleFilter: true,
						},
						{
							key: 'duration_of_sessions_attended_in_minutes',
							label: 'Duration of Sessions Attended - min (at setup time)',
							filter: true,
							sort: true,
							search: false,
							filterType: '<=',
							isEntityType: false,
							defaultValues: [
								{ label: '30', value: '30' },
								{ label: '60', value: '60' },
								{ label: '90', value: '90' },
								{ label: '120', value: '120' },
								{ label: '150', value: '150' },
								{ label: '180', value: '180' },
								{ label: '210', value: '210' },
								{ label: '240', value: '240' },
								{ label: '270', value: '270' },
								{ label: '300', value: '300' },
								{ label: '330', value: '330' },
								{ label: '360', value: '360' },
								{ label: '390', value: '390' },
								{ label: '420', value: '420' },
								{ label: '450', value: '450' },
								{ label: '480', value: '480' },
								{ label: '510', value: '510' },
								{ label: '540', value: '540' },
								{ label: '570', value: '570' },
								{ label: '600', value: '600' },
								{ label: '630', value: '630' },
								{ label: '660', value: '660' },
								{ label: '690', value: '690' },
								{ label: '720', value: '720' },
								{ label: '750', value: '750' },
								{ label: '780', value: '780' },
								{ label: '810', value: '810' },
								{ label: '840', value: '840' },
								{ label: '870', value: '870' },
								{ label: '900', value: '900' },
								{ label: '930', value: '930' },
								{ label: '960', value: '960' },
								{ label: '990', value: '990' },
								{ label: '1020', value: '1020' },
								{ label: '1050', value: '1050' },
								{ label: '1080', value: '1080' },
								{ label: '1110', value: '1110' },
								{ label: '1140', value: '1140' },
								{ label: '1170', value: '1170' },
								{ label: '1200', value: '1200' },
								{ label: '1230', value: '1230' },
								{ label: '1260', value: '1260' },
								{ label: '1290', value: '1290' },
								{ label: '1320', value: '1320' },
								{ label: '1350', value: '1350' },
								{ label: '1380', value: '1380' },
								{ label: '1410', value: '1410' },
								{ label: '1440', value: '1440' },
							],
							isMultipleFilter: false,
						},
					],
				}),
				organization_id: defaultOrgId,
			},
			{
				code: 'total_number_of_sessions_conducted',
				title: 'Total number of sessions attended',
				description: 'Total number of sessions conducted by user in big number',
				report_type_title: 'big_number',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'total_hours_of_mentoring_conducted',
				title: 'Total hours of Mentoring conducted',
				description: 'Total number of mentoring hours conducted by user in big number',
				report_type_title: 'big_number',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'split_of_sessions_conducted',
				title: 'Number of sessions created or assigned vs number of sessions conducted',
				description: 'Split of sessions created by user with number of sessions conducted by user in bar chart',
				report_type_title: 'bar_chart',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'mentoring_session_details',
				title: 'Mentoring Session Details',
				description: 'Mentoring session details table with pagination and downloadable pdf',
				report_type_title: 'table',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: JSON.stringify({
					columns: [
						{
							key: 'sessions_created_by',
							label: 'Sessions Created By',
							filter: false,
							sort: true,
							search: true,
							filterType: '=',
							isEntityType: false,
							isMultipleFilter: false,
						},
						{
							key: 'sessions_title',
							label: 'Sessions Title',
							filter: false,
							sort: true,
							search: true,
							filterType: '=',
							isEntityType: false,
							isMultipleFilter: false,
						},
						{
							key: 'date_of_session',
							label: 'Date of Session',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							dataType: 'Date',
							isEntityType: false,
							isMultipleFilter: true,
						},
						{
							key: 'session_type',
							label: 'Session Type',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							isEntityType: false,
							defaultValues: [
								{ label: 'ALL', value: ['PUBLIC','PRIVATE'] },
								{ label: 'PUBLIC', value: 'PUBLIC' },
								{ label: 'PRIVATE', value: 'PRIVATE' },
							],
							isMultipleFilter: false,
						},
						{
							key: 'number_of_mentees',
							label: 'Number of Mentees',
							filter: true,
							sort: true,
							search: false,
							filterType: '<=',
							isEntityType: false,
							defaultValues: [
								{ label: '5', value: '5' },
								{ label: '10', value: '10' },
								{ label: '15', value: '15' },
								{ label: '20', value: '20' },
								{ label: '25', value: '25' },
							],
							isMultipleFilter: false,
						},
						{
							key: 'session_conducted',
							label: 'Session Conducted',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							isEntityType: false,
							defaultValues: [
								{ label: 'Yes', value: 'Yes' },
								{ label: 'No', value: 'No' },
							],
							isMultipleFilter: true,
						},
						{
							key: 'duration_of_sessions_attended_in_minutes',
							label: 'Duration of Sessions Attended - min (at setup time)',
							filter: true,
							sort: true,
							search: false,
							filterType: '<=',
							isEntityType: false,
							defaultValues: [
								{ label: '30', value: '30' },
								{ label: '60', value: '60' },
								{ label: '90', value: '90' },
								{ label: '120', value: '120' },
								{ label: '150', value: '150' },
								{ label: '180', value: '180' },
								{ label: '210', value: '210' },
								{ label: '240', value: '240' },
								{ label: '270', value: '270' },
								{ label: '300', value: '300' },
								{ label: '330', value: '330' },
								{ label: '360', value: '360' },
								{ label: '390', value: '390' },
								{ label: '420', value: '420' },
								{ label: '450', value: '450' },
								{ label: '480', value: '480' },
								{ label: '510', value: '510' },
								{ label: '540', value: '540' },
								{ label: '570', value: '570' },
								{ label: '600', value: '600' },
								{ label: '630', value: '630' },
								{ label: '660', value: '660' },
								{ label: '690', value: '690' },
								{ label: '720', value: '720' },
								{ label: '750', value: '750' },
								{ label: '780', value: '780' },
								{ label: '810', value: '810' },
								{ label: '840', value: '840' },
								{ label: '870', value: '870' },
								{ label: '900', value: '900' },
								{ label: '930', value: '930' },
								{ label: '960', value: '960' },
								{ label: '990', value: '990' },
								{ label: '1020', value: '1020' },
								{ label: '1050', value: '1050' },
								{ label: '1080', value: '1080' },
								{ label: '1110', value: '1110' },
								{ label: '1140', value: '1140' },
								{ label: '1170', value: '1170' },
								{ label: '1200', value: '1200' },
								{ label: '1230', value: '1230' },
								{ label: '1260', value: '1260' },
								{ label: '1290', value: '1290' },
								{ label: '1320', value: '1320' },
								{ label: '1350', value: '1350' },
								{ label: '1380', value: '1380' },
								{ label: '1410', value: '1410' },
								{ label: '1440', value: '1440' },
							],
							isMultipleFilter: false,
						},
					],
				}),
				organization_id: defaultOrgId,
			},
			{
				code: 'total_hours_of_sessions_created_by_session_manager',
				title: 'Total hours of sessions created by SM',
				description: 'Total hours of sessions created by Session Manager in big number',
				report_type_title: 'big_number',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'total_number_of_hours_of_mentoring_conducted',
				title: 'Total hours of mentoring conducted',
				description: 'Total sessions created by Session Manager in big number',
				report_type_title: 'big_number',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'split_of_sessions_created_and_conducted',
				title: 'Total number of sessions created vs Total number of sessions conducted',
				description:
					'Total number of sessions created by session manager vs Total number of sessions conducted by session manager',
				report_type_title: 'bar_chart',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: '{}',
				organization_id: defaultOrgId,
			},
			{
				code: 'session_manger_session_details',
				title: 'Session details',
				description:
					'Number and hours of Mentoring Sessions conducted by individual Mentors along with Mentor Rating',
				report_type_title: 'table',
				created_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
				config: JSON.stringify({
					columns: [
						{
							key: 'mentor_name',
							label: 'Mentor Name',
							filter: false,
							sort: true,
							search: true,
							filterType: '=',
							isEntityType: false,
							isMultipleFilter: false,
						},
						{
							key: 'number_of_mentoring_sessions',
							label: 'Number of Mentoring Sessions',
							filter: true,
							sort: true,
							search: false,
							filterType: '<=',
							isEntityType: false,
							defaultValues: [
								{ label: '5', value: '5' },
								{ label: '10', value: '10' },
								{ label: '50', value: '50' },
								{ label: '100', value: '100' },
								{ label: '200', value: '200' },
								{ label: '400', value: '400' },
								{ label: '600', value: '600' },
								{ label: '800', value: '800' },
								{ label: '1000', value: '1000' },
								{ label: '1200', value: '1200' },
								{ label: '1460', value: '1460' },
							],
							isMultipleFilter: false,
						},
						{
							key: 'hours_of_mentoring_sessions',
							label: 'Hours of Mentoring Sessions',
							filter: true,
							sort: true,
							search: false,
							filterType: '<=',
							isEntityType: false,
							defaultValues: [
								{ label: '5', value: '5' },
								{ label: '10', value: '10' },
								{ label: '50', value: '50' },
								{ label: '100', value: '100' },
								{ label: '200', value: '200' },
								{ label: '300', value: '300' },
								{ label: '400', value: '400' },
								{ label: '500', value: '500' },
								{ label: '600', value: '600' },
								{ label: '720', value: '720' },
							],
							isMultipleFilter: false,
						},
						{
							key: 'avg_mentor_rating',
							label: 'Avg Mentor Rating',
							filter: true,
							sort: true,
							search: false,
							filterType: '=',
							isEntityType: false,
							defaultValues: [
								{ label: '1', value: '1' },
								{ label: '2', value: '2' },
								{ label: '3', value: '3' },
								{ label: '4', value: '4' },
								{ label: '5', value: '5' },
							],
							isMultipleFilter: false,
						},
					],
				}),
				organization_id: defaultOrgId,
			},
		])
	},

	async down(queryInterface, Sequelize) {
		// Revert the inserted data
		await queryInterface.bulkDelete('reports', {
			code: [
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
