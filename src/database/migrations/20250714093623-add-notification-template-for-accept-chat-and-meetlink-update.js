const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const emailTemplates = [
			{
				code: 'connection_request_accept',
				subject: 'Message Request Accepted',
				body: `<p>Dear {menteeName},</p><p>Congratulations! Your message request to <strong>{mentorName}</strong> has been accepted.</p><p>You can now continue your conversation and seek guidance on your queries.</p>`,
			},
			{
				code: 'session_meeting_link_added',
				subject: 'Meeting link added for {sessionTitle}',
				body: `<p>Hi,</p><p>The meeting link for your upcoming session, <strong>{sessionTitle}</strong> scheduled on {Date}, {Time} has been added by <strong>{mentorName}</strong>.</p><p>You can access it from the <strong>'Enrolled Sessions'</string> tab and click on the <strong> <a href="{sessionLink}">Join</a></strong> button at the scheduled time to attend the session. Thank you!</p>`,
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
		const templateCodes = ['connection_request_accept', 'session_meeting_link_added']

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
