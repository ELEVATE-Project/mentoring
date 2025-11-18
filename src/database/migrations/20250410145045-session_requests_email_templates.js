const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		const emailTemplates = [
			{
				code: 'request_session_accepted_email_template',
				subject: 'Request Session Accepted',
				body: '<p>Dear {name},</p> Congratulations! Mentor {mentorName} has accepted your session request. You can access the scheduled session from the Enrolled Sessions tab. Thanks!',
			},
			{
				code: 'request_session_rejected_email_template',
				subject: 'Request Session Rejected',
				body: `{{default}}<p>Dear {name},</p><p> Mentor {mentorName} has rejected your session request.</p>{{/default}}{{reasonTemplate}}<p>Reason: {reason} </p>{{/reasonTemplate}}{{gratitude}}<p>Thanks! </p>{{/gratitude}}`,
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
