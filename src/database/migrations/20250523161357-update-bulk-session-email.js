'use strict'
const moment = require('moment')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		let notificationTemplateData = [
			{
				body: '<p>Dear {name},</p><p>Please find the status of your bulk upload activity for session creations in the <strong>attached/linked</strong> report.</p><p>You can also access the report directly using the following link <a href="{file_link}" target="_blank">here</a></p>.',
				updated_at: moment().format(),
			},
		]

		await queryInterface.bulkUpdate('notification_templates', notificationTemplateData[0], {
			code: 'bulk_upload_session',
		})
	},

	down: async (queryInterface, Sequelize) => {
		let notificationTemplateData = [
			{
				body: '<p>Dear {name},</p> Please find attached the status of your bulk upload activity for session creations.',
				updated_at: moment().format(),
			},
		]

		await queryInterface.bulkUpdate('notification_templates', notificationTemplateData[0], {
			code: 'generic_invite',
		})
	},
}
