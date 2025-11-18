const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const emailTemplates = [
			{
				code: 'connection_request_rejected',
				subject: 'Message Request Rejected',
				body: `<p>Dear {menteeName},</p><p>We regret to inform you that your message request to <strong>{mentorName}</strong> has been rejected. Thanks!</p>
				`,
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
			console.log('Connection request rejection notification template already exists, no insertion needed')
		}
	},

	down: async (queryInterface, Sequelize) => {
		const templateCodes = ['connection_request_rejected']

		await queryInterface.bulkDelete(
			'notification_templates',
			{
				code: {
					[Sequelize.Op.in]: templateCodes,
				},
			},
			{}
		)
		console.log('Removed connection request rejection notification template')
	},
}
