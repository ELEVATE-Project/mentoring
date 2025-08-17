const SessionAttendee = require('@database/models/index').SessionAttendee
const { Op } = require('sequelize')
const SessionEnrollment = require('@database/models/index').SessionEnrollment

exports.create = async (data, tenantCode) => {
	try {
		data.tenant_code = tenantCode
		return await SessionAttendee.create(data)
	} catch (error) {
		return error
	}
}

exports.findOne = async (filter, tenantCode, options = {}) => {
	try {
		filter.tenant_code = tenantCode
		const res = await SessionAttendee.findOne({
			where: filter,
			...options,
			raw: true,
		})
		return res
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, tenantCode, options = {}) => {
	try {
		filter.tenant_code = tenantCode
		return await SessionAttendee.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})
	} catch (error) {
		console.error(error)
		return error
	}
}

exports.unEnrollFromSession = async (sessionId, userId, tenantCode) => {
	try {
		const result = await SessionAttendee.destroy({
			where: {
				session_id: sessionId,
				mentee_id: userId,
				tenant_code: tenantCode,
			},
			force: true, // Setting force to true for a hard delete
		})

		return result
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, tenantCode, options = {}) => {
	try {
		if (!tenantCode) {
			console.error('findAll: tenantCode is required but undefined')
			throw new Error('tenantCode is required')
		}
		filter.tenant_code = tenantCode
		return await SessionAttendee.findAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		throw error
	}
}

exports.unEnrollAllAttendeesOfSessions = async (sessionIds, tenantCode) => {
	try {
		const destroyedCount = await SessionAttendee.destroy({
			where: {
				session_id: { [Op.in]: sessionIds },
				tenant_code: tenantCode,
			},
		})
		await SessionEnrollment.destroy({
			where: {
				session_id: { [Op.in]: sessionIds },
				tenant_code: tenantCode,
			},
		})

		return destroyedCount
	} catch (error) {
		console.error('An error occurred:', error)
		throw error
	}
}

exports.usersUpcomingSessions = async (userId, sessionIds, tenantCode) => {
	try {
		if (!tenantCode) {
			console.error('usersUpcomingSessions: tenantCode is required but undefined')
			throw new Error('tenantCode is required')
		}
		const filter = {
			session_id: sessionIds,
			mentee_id: userId,
		}
		filter.tenant_code = tenantCode
		return await SessionAttendee.findAll({
			where: filter,
			raw: true,
		})
	} catch (error) {
		console.error('An error occurred:', error)
		throw error
	}
}

exports.unenrollFromUpcomingSessions = async (userId, sessionIds, tenantCode) => {
	try {
		const result = await SessionAttendee.destroy({
			where: {
				session_id: sessionIds,
				mentee_id: userId,
				tenant_code: tenantCode,
			},
		})
		await SessionEnrollment.destroy({
			where: {
				session_id: sessionIds,
				mentee_id: userId,
				tenant_code: tenantCode,
			},
		})
		return result
	} catch (error) {
		console.error('An error occurred:', error)
		throw error
	}
}

exports.removeUserFromAllSessions = async (userId, tenantCode) => {
	try {
		// Remove from session attendees (all sessions)
		const attendeeResult = await SessionAttendee.destroy({
			where: {
				mentee_id: userId,
				tenant_code: tenantCode,
			},
		})

		// Remove from session enrollments (all sessions)
		const enrollmentResult = await SessionEnrollment.destroy({
			where: {
				mentee_id: userId,
				tenant_code: tenantCode,
			},
		})

		return { attendeeResult, enrollmentResult }
	} catch (error) {
		return error
	}
}
exports.countEnrolledSessions = async (mentee_id, tenantCode) => {
	try {
		const whereClause = {
			mentee_id: mentee_id,
			joined_at: {
				[Op.not]: null,
			},
		}

		if (tenantCode) {
			whereClause.tenant_code = tenantCode
		}

		return await SessionAttendee.count({
			where: whereClause,
		})
	} catch (error) {
		return error
	}
}

exports.getEnrolledSessionsCountInDateRange = async (startDate, endDate, mentee_id, tenantCode) => {
	try {
		let sessionEnrollments = await SessionEnrollment.findAll({
			where: {
				mentee_id: mentee_id,
				tenant_code: tenantCode,
			},
		})
		const sessionIds = sessionEnrollments.map((enrollment) => enrollment.session_id)
		if (sessionIds.length <= 0) {
			return 0
		}
		return await SessionAttendee.count({
			where: {
				created_at: {
					[Op.between]: [startDate, endDate],
				},
				session_id: sessionIds,
				mentee_id: mentee_id,
				tenant_code: tenantCode,
			},
		})
	} catch (error) {
		return error
	}
}

exports.getAttendedSessionsCountInDateRange = async (startDate, endDate, mentee_id, tenantCode) => {
	try {
		let sessionEnrollments = await SessionEnrollment.findAll({
			where: {
				mentee_id: mentee_id,
				tenant_code: tenantCode,
			},
		})
		const sessionIds = sessionEnrollments.map((enrollment) => enrollment.session_id)
		if (sessionIds.length <= 0) {
			return 0
		}
		return await SessionAttendee.count({
			where: {
				joined_at: {
					[Op.between]: [startDate, endDate],
				},
				session_id: sessionIds,
				mentee_id: mentee_id,
				tenant_code: tenantCode,
			},
		})
	} catch (error) {
		console.error(error)
		return error
	}
}
exports.findAttendeeBySessionAndUserId = async (id, sessionId, tenantCode) => {
	try {
		const attendee = await SessionAttendee.findOne({
			where: {
				mentee_id: id,
				session_id: sessionId,
				tenant_code: tenantCode,
			},
			raw: true,
		})
		return attendee
	} catch (error) {
		return error
	}
}
exports.findPendingFeedbackSessions = async (menteeId, completedSessionIds, tenantCode) => {
	try {
		if (!tenantCode) {
			console.error('findPendingFeedbackSessions: tenantCode is required but undefined')
			throw new Error('tenantCode is required')
		}
		let sessionEnrollments = await SessionEnrollment.findAll({
			where: {
				mentee_id: menteeId,
				tenant_code: tenantCode,
			},
		})
		const sessionIds = sessionEnrollments.map((enrollment) => enrollment.session_id)
		const filteredSessionIds = sessionIds.filter((sessionId) => !completedSessionIds.includes(sessionId))

		const filter = {
			mentee_id: menteeId,
			joined_at: {
				[Op.not]: null,
			},
			is_feedback_skipped: false,
			session_id: filteredSessionIds,
		}
		filter.tenant_code = tenantCode

		return await SessionAttendee.findAll({
			where: filter,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.getCount = async (filter = {}, options = {}) => {
	try {
		return await SessionAttendee.count({
			where: filter,
			...options,
		})
	} catch (error) {
		throw error
	}
}
