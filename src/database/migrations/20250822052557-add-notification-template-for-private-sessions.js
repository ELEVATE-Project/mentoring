const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const emailTemplates = [
			{
				body: '<div><p> Hi {name},</p><p> You`ve been enrolled in a Public Mentoring Session assigned by {managerName} and conducted by your mentor {mentorName}.</p><p><ul><li><strong>Session Name:</strong> {sessionTitle}</li><li><strong>Date:</strong> {startDate}</li><li><strong>Time:</strong> {startTime}</li><li><strong>Duration:</strong> {sessionDuration} {unitOfTime}</li></ul></p></div>',
				code: 'mentee_public_session_enrollment_by_manager',
				subject: 'You have been enrolled in a Public Mentoring Session',
			},
			{
				body: '<div><p>Hi,<p><p>{sessionTitle}</p><p>This session has been cancelled and deleted. The mentor for this session is no longer available. Regards,</p></div>',
				code: 'session_creator_delete_the_session',
				subject: '{sessionTitle} Deleted',
			},
		]

		let notificationTemplateData = []

		for (const emailTemplate of emailTemplates) {
			// Check if template already exists
			const existingTemplate = await queryInterface.sequelize.query(
				`SELECT id FROM notification_templates WHERE code = '${emailTemplate.code}' AND organization_id = '${defaultOrgId}'`,
				{ type: queryInterface.sequelize.QueryTypes.SELECT }
			)

			if (existingTemplate.length === 0) {
				// Template doesn't exist, add it
				const templateData = {
					...emailTemplate,
					status: 'active',
					type: 'email',
					updated_at: moment().format(),
					created_at: moment().format(),
					organization_id: defaultOrgId,
					email_footer: 'email_footer',
					email_header: 'email_header',
				}

				notificationTemplateData.push(templateData)
			} else {
				console.log(`Template with code '${emailTemplate.code}' already exists, skipping...`)
			}
		}

		if (notificationTemplateData.length > 0) {
			await queryInterface.bulkInsert('notification_templates', notificationTemplateData, {})
			console.log(`Inserted ${notificationTemplateData.length} new notification template(s)`)
		} else {
			console.log('Notification template already exists, no insertion needed')
		}
	},

	down: async (queryInterface, Sequelize) => {
		const templateCodes = ['session_creator_delete_the_session', 'mentee_public_session_enrollment_by_manager']

		await queryInterface.bulkDelete(
			'notification_templates',
			{
				code: {
					[Sequelize.Op.in]: templateCodes,
				},
			},
			{}
		)
		console.log('Notification templates are removed')
	},
}
