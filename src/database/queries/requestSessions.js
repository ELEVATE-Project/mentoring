const requestSession = require('@database/models/index').RequestSession
const { Op } = require('sequelize')
const sequelize = require('@database/models/index').sequelize

const common = require('@constants/common')
const MenteeExtension = require('@database/models/index').UserExtension
const { QueryTypes } = require('sequelize')
const moment = require('moment')

exports.getColumns = async () => {
	try {
		return await Object.keys(requestSession.rawAttributes)
	} catch (error) {
		return error
	}
}

exports.getModelName = async () => {
	try {
		return await requestSession.name
	} catch (error) {
		return error
	}
}

exports.addSessionRequest = async (requestorId, requesteeId, Agenda, startDate, endDate, Title, Meta) => {
	try {
		const SessionRequestData = [
			{
				requestor_id: requestorId,
				requestee_id: requesteeId,
				status: common.CONNECTIONS_STATUS.REQUESTED,
				title: Title,
				agenda: Agenda,
				start_date: startDate,
				end_date: endDate,
				created_by: requestorId,
				updated_by: requestorId,
				meta: Meta,
			},
		]

		const requests = await requestSession.bulkCreate(SessionRequestData)
		const requestResult = requests[0].get({ plain: true })

		return requestResult
	} catch (error) {
		throw error
	}
}

exports.getAllRequests = async (userId, status) => {
	try {
		// Prepare status filter
		const statusFilter =
			status.length != 0
				? status
				: {
						[Op.in]: [
							common.CONNECTIONS_STATUS.ACCEPTED,
							common.CONNECTIONS_STATUS.REQUESTED,
							common.CONNECTIONS_STATUS.REJECTED,
							common.CONNECTIONS_STATUS.EXPIRED,
						],
				  }

		const sessionRequest = await requestSession.findAndCountAll({
			where: {
				requestor_id: userId,
				status: statusFilter,
			},
			raw: true,
			order: [['created_at', 'DESC']],
		})

		return sessionRequest
	} catch (error) {
		console.error('Error in getAllRequests:', error)
		throw error
	}
}

exports.getSessionMappingDetails = async (sessionRequestIds, status) => {
	try {
		const statusFilter =
			status != []
				? status
				: {
						[Op.in]: [
							common.CONNECTIONS_STATUS.ACCEPTED,
							common.CONNECTIONS_STATUS.REQUESTED,
							common.CONNECTIONS_STATUS.REJECTED,
							common.CONNECTIONS_STATUS.EXPIRED,
						],
				  }

		const result = await requestSession.findAll({
			where: {
				id: {
					[Op.in]: sessionRequestIds, // Using Sequelize.Op.in to filter by multiple ids
				},
				status: statusFilter, // Your status filter
			},
			order: [['created_at', 'DESC']],
		})

		return result
	} catch (error) {
		throw error
	}
}

exports.getpendingRequests = async (userId, page, pageSize) => {
	try {
		const currentPage = page ? page : 1
		const limit = pageSize ? pageSize : 5
		const offset = (currentPage - 1) * limit

		const result = await requestSession.findAndCountAll({
			where: {
				user_id: userId,
				status: common.CONNECTIONS_STATUS.REQUESTED,
			},
			raw: true,
			limit,
			offset,
		})

		return result
	} catch (error) {
		throw error
	}
}

exports.approveRequest = async (userId, requestSessionId, sessionId) => {
	try {
		const updateData = {
			status: common.CONNECTIONS_STATUS.ACCEPTED,
			session_id: sessionId,
			updated_by: userId,
		}

		const requests = await requestSession.update(updateData, {
			where: {
				status: common.CONNECTIONS_STATUS.REQUESTED,
				id: requestSessionId,
			},
			individualHooks: true,
		})

		return requests[1] // this typically refers to the number of affected rows
	} catch (error) {
		throw error
	}
}

exports.rejectRequest = async (userId, requestSessionId, rejectReason) => {
	try {
		let updateData = {
			status: common.CONNECTIONS_STATUS.REJECTED,
			updated_by: userId,
			reject_reason: rejectReason ? rejectReason : null,
		}

		return await requestSession.update(updateData, {
			where: {
				status: common.CONNECTIONS_STATUS.REQUESTED,
				id: requestSessionId,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

exports.expireRequest = async (requestSessionId) => {
	try {
		let updateData = {
			status: common.CONNECTIONS_STATUS.EXPIRED,
		}

		return await requestSession.update(updateData, {
			where: {
				status: common.CONNECTIONS_STATUS.REQUESTED,
				id: requestSessionId,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

exports.findOneRequest = async (requestSessionId) => {
	try {
		const sessionRequest = await requestSession.findOne({
			where: {
				id: requestSessionId,
				status: common.CONNECTIONS_STATUS.REQUESTED,
			},
			raw: true,
		})

		return sessionRequest
	} catch (error) {
		throw error
	}
}

exports.checkPendingRequest = async (requestorId, requesteeId) => {
	try {
		const result = await requestSession.findAndCountAll({
			where: {
				requestor_id: requestorId,
				requestee_id: requesteeId,
				status: common.CONNECTIONS_STATUS.REQUESTED,
			},
		})
		return result
	} catch (error) {
		throw error
	}
}

exports.getRequestSessions = async (requestSessionId) => {
	try {
		const whereClause = {
			id: requestSessionId,
		}
		return await requestSession.findOne({
			where: whereClause,
			raw: true,
		})
	} catch (error) {
		throw error
	}
}

exports.markRequestsAsDeleted = async (requestSessionIds = []) => {
	try {
		const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ssZ')

		const [, updatedRows] = await requestSession.update(
			{
				deleted_at: currentDateTime,
			},
			{
				where: {
					id: {
						[Op.in]: requestSessionIds,
					},
				},
				returning: true, // Only works with PostgreSQL
			}
		)

		const deletedIds = updatedRows.map((row) => row.id)

		return deletedIds.length == 0 || deletedIds.length > 0 ? true : false
	} catch (error) {
		throw error
	}
}

exports.getPendingSessionRequests = async (userId) => {
	try {
		const query = `
			SELECT rs.*, rm.requestee_id
			FROM session_request rs
			INNER JOIN session_request_mapping rm ON rs.id = rm.request_session_id
			WHERE rm.requestee_id = :userId 
			AND rs.status = :requestedStatus
			AND rs.deleted_at IS NULL
		`

		const pendingRequests = await sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: {
				userId,
				requestedStatus: common.CONNECTIONS_STATUS.REQUESTED,
			},
		})

		return pendingRequests || []
	} catch (error) {
		console.error('Error getting pending session requests :', error)
		throw error
	}
}

exports.getCount = async (userId, status) => {
	try {
		// Prepare filter
		const filter =
			status.length != 0
				? status
				: {
						[Op.in]: [
							common.CONNECTIONS_STATUS.ACCEPTED,
							common.CONNECTIONS_STATUS.REQUESTED,
							common.CONNECTIONS_STATUS.REJECTED,
							common.CONNECTIONS_STATUS.EXPIRED,
						],
				  }

		const sessionRequest = await requestSession.count({
			where: {
				requestor_id: userId,
				status: filter,
			},
		})

		return sessionRequest
	} catch (error) {
		console.error('Error in getCount:', error)
		throw error
	}
}
