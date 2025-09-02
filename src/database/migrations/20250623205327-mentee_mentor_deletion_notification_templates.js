const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const emailTemplates = [
			// Templates for Mentee Deletion (notifying mentors)
			{
				code: 'mentee_deletion_notification_email',
				subject: 'Connection Removed',
				body: `
					<p>Hi,</p>
					<p>Your connected mentee has been removed from the platform.</p>
					<p>The connection history will remain available in your chat, but the mentee will no longer be accessible for new conversations or sessions.</p>
				`,
			},
			{
				code: 'private_session_cancelled_email',
				subject: '{sessionName} Cancelled',
				body: `<p>Hi,</p><p>The session <strong>{sessionName}</strong>, scheduled for {sessionDate} at {sessionTime}, has been cancelled and deleted as the mentee is no longer part of the organisation.</p><p>For more details, please visit MentorED.</p>`,
			},

			// Templates for Mentor Deletion (notifying mentees)
			{
				code: 'mentor_deletion_notification_email',
				subject: 'Connection Removed',
				body: `<p>Hi {menteeName},</p><p>Your connected mentor <strong>{mentorName}</strong> has been removed from the platform.</p><p>The connection history will remain available in your chat, but the mentor will no longer be accessible for new conversations or sessions.</p><p>You can continue to search for other mentors on the platform.</p>`,
			},
			{
				code: 'session_request_rejected_mentor_deletion_email',
				subject: 'Session Request Rejected',
				body: `<p>Hi,</p><p><strong>{sessionName}</strong></p><p>This session request has been rejected and deleted. Requested Mentor for this session is no longer available.</p>`,
			},
			{
				code: 'session_manager_mentor_deletion_email',
				subject: 'Action Required - Mentor Deleted',
				body: `<p>Hi,</p><p><strong>{mentorName}</strong> is no longer a part of the organisation, and following are their upcoming sessions :</p><div style="margin: 15px 0;">{sessionList}</div><p>Please reassign a mentor to continue the sessions or cancel the session to notify attendees.</p>`,
			},
			{
				code: 'session_deleted_mentor_deletion_email',
				subject: '{sessionName} Deleted',
				body: `<p>Hi,</p><p>The session <strong>{sessionName}</strong> has been deleted. Mentor for this session is no longer available.</p>`,
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
			console.log(`Inserted ${notificationTemplateData.length} new notification templates`)
		} else {
			console.log('All notification templates already exist, no insertions needed')
		}
	},

	down: async (queryInterface, Sequelize) => {
		const templateCodes = [
			'mentee_deletion_notification_email',
			'private_session_cancelled_email',
			'mentor_deletion_notification_email',
			'session_request_rejected_mentor_deletion_email',
			'session_manager_mentor_deletion_email',
			'session_deleted_mentor_deletion_email',
		]

		await queryInterface.bulkDelete(
			'notification_templates',
			{
				code: {
					[Sequelize.Op.in]: templateCodes,
				},
			},
			{}
		)
	},
}
