const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const emailTemplates = [
			{
				code: 'mentor_has_changed',
				subject: 'Your Mentor Has Been Changed',
				body: `<p>Dear {menteeName},</p><p>Your previous mentor for the upcoming session has been changed.</p><p>Name of Session: {sessionTitle} </p><p>New Mentor:{newMentorName} </p><p> Date and Time of Session: {startDate} at {startTime} </p>`,
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
		const templateCodes = ['mentor_has_changed']

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
