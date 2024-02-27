'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		// update the body correct it as per products requirement
		let updateData = {
			body: "<p>Dear {name},</p> Thank you for enrolling for the session - <strong> {sessionTitle} </strong> by <strong> {mentorName} </strong>, The session is scheduled on <strong>{startDate}</strong> at <strong>{startTime}</strong> You will be able to join from  'Enrolled sessions'  tab once the Mentor starts the meeting.",
		}

		let updateFilter = {
			code: 'mentee_session_enrollment',
			organization_id: defaultOrgId,
		}
		// Update operation
		let check = await queryInterface.bulkUpdate('notification_templates', updateData, updateFilter)
	},

	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		// update the body correct it as per products requirement
		let updateData = {
			body: "<p>Dear {name},</p> Thank you for enrolling for the session - {sessionTitle} by {mentorName}, The session is scheduled on {startDate} at {startTime} You will be able to join from 'My sessions' on the app once the host starts the meeting.",
		}

		let updateFilter = {
			code: 'mentee_session_enrollment',
			organization_id: defaultOrgId,
		}
		// Update operation
		let check = await queryInterface.bulkUpdate('notification_templates', updateData, updateFilter)
	},
}
