const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		const emailTemplates = [
			{
				code: 'new_session_resource_email',
				subject: 'New Session',
				body: '<p>Hi,</p><p>New Session {sessionTitle} has been scheduled on {startDate} at {startTime} by {mentorName}. To access resources, <a href="{sessionLink}">click on more information</a>. </p> <p> Thanks! </p> ',
			},
			{
				code: 'pre_session_resource_email',
				subject: 'Pre Session Resource Uploaded',
				body: '<p>Hi,</p><p>{mentorName} has added pre session resources for {sessionTitle}. To access, <a href="{sessionLink}">click on more information</a>. </p><p> Thanks!</p> ',
			},
			{
				code: 'post_session_resource_email',
				subject: 'Post Session Resource Uploaded',
				body: '<p>Hi,</p><p>{mentorName} has added post session resources for {sessionTitle}. To access, <a href="{sessionLink}">click on more information</a>. </p><p> Thanks!</p> ',
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
