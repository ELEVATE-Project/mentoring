'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		let notificationTemplateData = [
			{
				body: '<div><p>Dear {name},</p><p>I trust this email finds you well. I wanted to inform you that there have been some updates to the mentoring session previously scheduled in which you were enrolled. Please review the changes outlined below:</p><p><strong>Revised Session Details:</strong></p><ul><li><strong>Date:</strong> {newStartDate}</li><li><strong>Time:</strong> {newStartTime}</li><li><strong>Duration:</strong> {newSessionDuration} {unitOfTime}</li><li><strong>Session Platform:</strong> {newSessionPlatform}</li><li><strong>Topic:</strong> {revisedSessionTitle}</li><li><strong>Session Type:</strong> {newSessionType}</li></ul><p>We understand that schedule changes may impact your availability, and we appreciate your flexibility. If there are any concerns or conflicts with the revised schedule, please let us know as soon as possible so that we can address them accordingly. Thank you for your understanding and continued participation in the mentoring program. Your engagement contributes significantly to the success of our mentoring initiatives, and we value your ongoing support.</p></div>',
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
		]

		await queryInterface.bulkUpdate('notification_templates', notificationTemplateData[0], {
			code: 'mentee_session_edited_by_manager_email_template',
		})
	},

	down: async (queryInterface, Sequelize) => {
		const previousTemplateBody =
			'<div><p>Dear {name},</p><p>I trust this email finds you well. I wanted to inform you that there have been some updates to the mentoring session previously scheduled in which you were enrolled. Please review the changes outlined below:</p><p><strong>Original Session Details:</strong></p><ul><li><strong>Date:</strong> {startDate}</li><li><strong>Time:</strong> {startTime}</li><li><strong>Duration:</strong> {sessionDuration} {unitOfTime}</li><li><strong>Session Platform:</strong> {sessionPlatform}</li><li><strong>Topic:</strong> {originalSessionTitle}</li><li><strong>Session Type:</strong> {sessionType}</li></ul><p><strong>Revised Session Details:</strong></p><ul><li><strong>Date:</strong> {newStartDate}</li><li><strong>Time:</strong> {newStartTime}</li><li><strong>Duration:</strong> {newSessionDuration} {unitOfTime}</li><li><strong>Session Platform:</strong> {newSessionPlatform}</li><li><strong>Topic:</strong> {revisedSessionTitle}</li><li><strong>Session Type:</strong> {newSessionType}</li></ul><p>We understand that schedule changes may impact your availability, and we appreciate your flexibility. If there are any concerns or conflicts with the revised schedule, please let us know as soon as possible so that we can address them accordingly. Thank you for your understanding and continued participation in the mentoring program. Your engagement contributes significantly to the success of our mentoring initiatives, and we value your ongoing support.</p></div>'
		await queryInterface.bulkUpdate(
			'notification_templates',
			{
				body: previousTemplateBody,
				updated_at: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			{
				code: 'mentee_session_edited_by_manager_email_template',
			}
		)
	},
}
