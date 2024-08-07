const moment = require('moment')

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		const emailTemplates = [
			{
				code: 'bulk_upload_session',
				subject: 'Session Creation Bulk upload Status',
				body: '<p>Dear {name},</p> Please find attached the status of your bulk upload activity for session creations.',
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
