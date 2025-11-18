'use strict'
const moment = require('moment')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		let notificationTemplateData = [
			{
				body: '<p>Dear {name},</p><p>Your bulk upload is successfully completed. Please download the CSV of the report using the link provided below:</p><p>Link : <a href="{file_link}" target="_blank">Download CSV Report</a></p>.',
				updated_at: moment().format(),
			},
		]

		await queryInterface.bulkUpdate('notification_templates', notificationTemplateData[0], {
			code: 'bulk_upload_session',
		})
	},

	down: async (queryInterface, Sequelize) => {
		return
	},
}
