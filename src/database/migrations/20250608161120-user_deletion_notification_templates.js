const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		const emailTemplates = [
			{
				code: 'mentor_request_session_deletion_email',
				subject: ' {nameOfTheSession} Cancelled ',
				body: '<p>Hi,</p><p>The session {nameOfTheSession}, scheduled for {Date}, {Time}, has been cancelled and deleted as the mentee is no longer part of the organisation. </p><p>For more details, please visit MentorED. </p> ',
			},
			{
				code: 'mentee_request_session_deletion_email',
				subject: 'Session Request Rejected ',
				body: '<p>Hi,</p><p>{<nameOfTheSession>}</p><p>This session request has been rejected and deleted. Requested Mentor for this session is no longer available. </p> ',
			},
			{
				code: 'session_manager_private_session_deletion_email',
				subject: 'Action Required - Mentor/Mentee Deleted',
				body: `
				  <p>Hi,</p>
				  <p><strong>{name}</strong> is no longer a part of the organisation, and following are their upcoming sessions:</p>
				  <ul>
					{sessionsList}
				  </ul>
				  <p>Please reassign a mentor/mentee to continue the sessions or cancel the session to notify attendees.</p>
				`,
			},
		]

		let notificationTemplateData = []
		emailTemplates.forEach(async function (emailTemplate) {
			emailTemplate['status'] = 'active'
			emailTemplate['type'] = 'email'
			emailTemplate['updated_at'] = moment().format()
			emailTemplate['created_at'] = moment().format()
			emailTemplate['organization_id'] = defaultOrgId
			emailTemplate['email_footer'] = 'email_footer'
			emailTemplate['email_header'] = 'email_header'

			notificationTemplateData.push(emailTemplate)
		})

		await queryInterface.bulkInsert('notification_templates', notificationTemplateData, {})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('notification_templates', null, {})
	},
}
