const Session = require('@database/models/index').Session
const { Op, literal, QueryTypes } = require('sequelize')
const common = require('@constants/common')
const sequelize = require('sequelize')

const moment = require('moment')
const SessionOwnership = require('../models/index').SessionOwnership
const Sequelize = require('@database/models/index').sequelize
const sessionOwnership = require('@database/queries/sessionOwnership')

exports.getColumns = async () => {
	try {
		return await Object.keys(Session.rawAttributes)
	} catch (error) {
		return error
	}
}

exports.getModelName = async () => {
	try {
		return await Session.name
	} catch (error) {
		return error
	}
}

exports.create = async (data) => {
	try {
		const session = await Session.create(data)
		// create session ownership entry for the session creator
		await sessionOwnership.create({
			user_id: session.created_by,
			session_id: session.id,
			type: common.SESSION_OWNERSHIP_TYPE.CREATOR,
		})

		// create session ownership entry for the session mentor
		await sessionOwnership.create({
			user_id: session.mentor_id,
			session_id: session.id,
			type: common.SESSION_OWNERSHIP_TYPE.MENTOR,
		})
		return session
	} catch (error) {
		return error
	}
}

exports.findOne = async (filter, options = {}) => {
	try {
		const res = await Session.findOne({
			where: filter,
			...options,
			raw: true,
		})
		return res
	} catch (error) {
		return error
	}
}

exports.findById = async (id) => {
	try {
		return await Session.findByPk(id)
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, options = {}) => {
	try {
		const result = await Session.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})
		const [rowsAffected, updatedRows] = result

		return options.returning ? { rowsAffected, updatedRows } : rowsAffected
	} catch (error) {
		return error
	}
}

/**
 * Update Session table rows with provided data and conditions
 * @param {Object} data - Fields to update (e.g., { deleted_at: new Date() })
 * @param {Object} where - WHERE condition (e.g., { id: sessionIds })
 * @returns {Promise<number>} Number of affected rows
 */
exports.updateRecords = async (data, options = {}) => {
	try {
		if (!options.where || Object.keys(options.where).length === 0) {
			throw new Error('updateRecords: "where" condition is required')
		}
		const result = await Session.update(data, options)
		return Array.isArray(result) ? result[0] : result // Sequelize returns [number of affected rows]
	} catch (error) {
		throw error
	}
}

exports.findAll = async (filter, options = {}) => {
	try {
		return await Session.findAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.updateEnrollmentCount = async (sessionId, increment = true) => {
	try {
		const options = increment ? { by: 1 } : { by: -1 }
		const result = this.incrementOrDecrement(
			{
				where: { id: sessionId },
				...options,
			},
			'seats_remaining'
		)
		return result
	} catch (error) {
		return error
	}
}

exports.incrementOrDecrement = async (filterWithOptions, incrementFields = []) => {
	try {
		return await Session.increment(incrementFields, filterWithOptions)
	} catch (error) {
		return error
	}
}

exports.getSessionByUserIdAndTime = async (userId, startDate, endDate, sessionId) => {
	try {
		let startDateResponse, endDateResponse
		const query = {
			mentor_id: userId,
			status: { [Op.ne]: common.COMPLETED_STATUS },
		}

		if (startDate) {
			query.start_date = {
				[Op.lte]: startDate,
			}
			query.end_date = {
				[Op.gte]: startDate,
			}

			if (sessionId) {
				// check if sessionId is truthy (i.e. not undefined or empty)
				query.id = { [Op.ne]: sessionId }
			}

			startDateResponse = await this.findAll(query)
		}
		if (endDate) {
			query.start_date = {
				[Op.lte]: endDate,
			}
			query.end_date = {
				[Op.gte]: endDate,
			}

			if (sessionId) {
				// check if sessionId is truthy (i.e. not undefined or empty)
				query.id = { [Op.ne]: sessionId }
			}

			endDateResponse = await this.findAll(query)
		}

		return {
			startDateResponse: startDateResponse,
			endDateResponse: endDateResponse,
		}
	} catch (error) {
		return error
	}
}

exports.deleteSession = async (filter) => {
	try {
		return await Session.destroy({
			where: filter,
		})
	} catch (error) {
		return error
	}
}

exports.updateSession = async (filter, update, options = {}) => {
	try {
		return await await Session.update(update, {
			where: filter,
			...options,
		})
	} catch (error) {
		return error
	}
}
exports.removeAndReturnMentorSessions = async (userId) => {
	try {
		const currentEpochTime = moment().unix()
		const currentDate = moment()
		const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ssZ')

		/* const foundSessionOwnerships = await SessionOwnerships.findAll({
			attributes: ['session_id'],
			where: {
				mentor_id: userId,
			},
			include: [
				{
					model: Session,
					where: {
						deleted: false,
						[Op.or]: [{ startDate: { [Op.gt]: currentEpochTime } }, { status: common.PUBLISHED_STATUS }],
					},
					attributes: ['id', 'title'],
				},
			],
		}) */

		const filter = {
			user_id: userId,
		}

		const option = {
			attributes: ['session_id'],
		}
		const sessionIds = await sessionOwnership.findAll(filter, option, true)

		const foundSessions = await Session.findAll({
			where: {
				mentor_id: userId,
				created_by: userId,
				id: { [Op.in]: sessionIds },
				[Op.or]: [{ start_date: { [Op.gt]: currentEpochTime } }, { status: common.PUBLISHED_STATUS }],
			},
			raw: true,
		})

		const sessionIdAndTitle = foundSessions.map((session) => {
			return { id: session.id, title: session.title }
		})
		const upcomingSessionIds = foundSessions.map((session) => session.id)

		const updatedSessions = await Session.update(
			{
				deleted_at: currentDateTime,
			},
			{
				where: {
					mentor_id: userId,
					created_by: userId,
					id: { [Op.in]: upcomingSessionIds },
				},
			}
		)
		await SessionOwnership.update(
			{
				deleted_at: currentDateTime,
			},
			{
				where: {
					user_id: userId,
					session_id: { [Op.in]: upcomingSessionIds },
				},
			}
		)
		const removedSessions = updatedSessions[0] > 0 ? sessionIdAndTitle : []
		return removedSessions
	} catch (error) {
		return error
	}
}

exports.findAllSessions = async (page, limit, search, filters) => {
	try {
		let filterQuery = {
			where: filters,
			raw: true,
			attributes: [
				'id',
				'title',
				'mentor_id',
				'description',
				'status',
				'start_date',
				'end_date',
				'image',
				'created_at',
				'meeting_info',
				'created_by',
			],
			offset: parseInt((page - 1) * limit, 10),
			limit: parseInt(limit, 10),
			order: [['created_at', 'DESC']],
		}

		if (search) {
			filterQuery.where.title = {
				[Op.iLike]: search + '%',
			}
		}

		return await Session.findAndCountAll(filterQuery)
	} catch (error) {
		return error
	}
}
exports.getAllUpcomingSessions = async (paranoid) => {
	const currentEpochTime = moment().unix()
	//const currentEpochTime = moment().format('YYYY-MM-DD HH:mm:ssZ')

	try {
		return await Session.findAll({
			paranoid: paranoid,
			where: {
				start_date: {
					[Op.gt]: currentEpochTime,
				},
				status: {
					[Op.not]: common.INACTIVE_STATUS,
				},
			},
			raw: true,
		})
	} catch (err) {
		console.error('An error occurred:', err)
		throw err
	}
}

exports.updateEnrollmentCount = async (sessionId, increment = true) => {
	try {
		const updateFields = increment
			? { seats_remaining: literal('"seats_remaining" + 1') }
			: { seats_remaining: literal('"seats_remaining" - 1') }

		return await Session.update(updateFields, {
			where: {
				id: sessionId,
			},
		})
	} catch (error) {
		console.error(error)
		throw error
	}
}
exports.countHostedSessions = async (id) => {
	try {
		const filter = {
			user_id: id,
			type: common.SESSION_OWNERSHIP_TYPE.MENTOR,
		}

		const option = {
			attributes: ['session_id'],
		}
		const sessionIds = await sessionOwnership.findAll(filter, option, true)

		const count = await Session.count({
			where: {
				id: { [Op.in]: sessionIds },
				status: 'COMPLETED',
				started_at: {
					[Op.not]: null,
				},
			},
		})
		return count
	} catch (error) {
		return error
	}
}

exports.getCreatedSessionsCountInDateRange = async (mentorId, startDate, endDate) => {
	try {
		const filter = {
			user_id: mentorId,
			type: common.SESSION_OWNERSHIP_TYPE.CREATOR,
		}

		const option = {
			attributes: ['session_id'],
		}
		const sessionIds = await sessionOwnership.findAll(filter, option, true)

		const count = await Session.count({
			where: {
				id: { [Op.in]: sessionIds },
				created_at: {
					[Op.between]: [startDate, endDate],
				},
				mentor_id: mentorId, // Check mentor_id
				created_by: mentorId, // Check created_by
			},
		})
		return count
	} catch (error) {
		throw error
	}
}

/**
 * Get the count of mentoring sessions within a date range for a specific mentor.
 * @param {number} mentorId 	- The ID of the mentor.
 * @param {Date} startDate 		- The start date of the date range.
 * @param {Date} endDate 		- The end date of the date range.
 * @returns {Promise<number>} 	- The count of mentoring sessions.
 * @throws {Error} 				- If an error occurs during the process.
 */

exports.getAssignedSessionsCountInDateRange = async (mentorId, startDate, endDate) => {
	try {
		const filter = {
			user_id: mentorId,
			type: common.SESSION_OWNERSHIP_TYPE.MENTOR,
		}

		const option = {
			attributes: ['session_id'],
		}
		const sessionIds = await sessionOwnership.findAll(filter, option, true)

		const count = await Session.count({
			where: {
				id: { [Op.in]: sessionIds },
				created_at: {
					[Op.between]: [startDate, endDate],
				},
				mentor_id: mentorId,
				created_by: { [Op.ne]: mentorId },
			},
		})
		return count
	} catch (error) {
		throw error
	}
}

exports.getHostedSessionsCountInDateRange = async (mentorId, startDate, endDate) => {
	try {
		const filter = {
			user_id: mentorId,
			type: common.SESSION_OWNERSHIP_TYPE.MENTOR,
		}

		const option = {
			attributes: ['session_id'],
		}
		const sessionIds = await sessionOwnership.findAll(filter, option, true)

		const count = await Session.count({
			where: {
				id: { [Op.in]: sessionIds },
				status: 'COMPLETED',
				start_date: {
					[Op.between]: [startDate, endDate],
				},
				started_at: {
					[Op.not]: null,
				},
			},
		})
		return count
	} catch (error) {
		throw error
	}
}

/* exports.getMentorsUpcomingSessions = async (mentorId) => {
	try {
		const foundSessionOwnerships = await SessionOwnership.findAll({
			attributes: ['session_id'],
			where: {
				mentor_id: mentorId,
			},
			raw: true,
		})

		const sessionIds = foundSessionOwnerships.map((ownership) => ownership.session_id)
		const currentEpochTime = moment().unix()
		console.log(sessionIds)
		console.log(currentEpochTime)
		return await Session.findAll({
			where: {
				id: { [Op.in]: sessionIds },
				status: 'PUBLISHED',
				start_date: {
					[Op.gt]: currentEpochTime,
				},
				started_at: {
					[Op.eq]: null,
				},
			},
			raw: true,
		})
	} catch (error) {
		throw error
	}
} */

exports.getMentorsUpcomingSessions = async (page, limit, search, mentorId) => {
	try {
		const filter = {
			user_id: mentorId,
		}

		const option = {
			attributes: ['session_id'],
		}
		const sessionIds = await sessionOwnership.findAll(filter, option, true)

		const currentEpochTime = moment().unix()

		const sessionAttendeesData = await Session.findAndCountAll({
			where: {
				[Op.and]: [
					{
						id: { [Op.in]: sessionIds },
						status: 'PUBLISHED',
						start_date: {
							[Op.gt]: currentEpochTime,
						},
						started_at: {
							[Op.eq]: null,
						},
					},
					{
						[Op.or]: [
							sequelize.where(
								sequelize.fn('LOWER', sequelize.col('title')),
								'LIKE',
								`%${search.toLowerCase()}%`
							),
						],
					},
				],
			},
			order: [['start_date', 'ASC']],
			attributes: [
				'id',
				'title',
				'description',
				'start_date',
				'end_date',
				'status',
				'image',
				'mentor_id',
				'meeting_info',
				/* 				[(sequelize.json('meeting_info.platform'), 'meeting_info.platform')],
				[sequelize.json('meeting_info.value'), 'meeting_info.value'], */
			],
			offset: limit * (page - 1),
			limit: limit,
			raw: true,
		})

		return {
			data: sessionAttendeesData.rows,
			count: sessionAttendeesData.count,
		}
	} catch (error) {
		return error
	}
}

exports.getUpcomingSessions = async (page, limit, search, userId, startDate, endDate) => {
	try {
		const currentEpochTime = moment().unix()
		let whereCondition = {
			[Op.or]: [{ title: { [Op.iLike]: `%${search}%` } }],
			mentor_id: {
				[Op.or]: [{ [Op.ne]: userId }, { [Op.is]: null }],
			},
			end_date: {
				[Op.gt]: currentEpochTime,
			},
			status: {
				[Op.in]: [common.PUBLISHED_STATUS, common.LIVE_STATUS],
			},
		}

		if (startDate && endDate) {
			const startEpoch = startDate
			const endEpoch = endDate

			// Log to debug
			console.log('Filtering sessions between:', startEpoch, 'and', endEpoch)

			whereCondition.start_date = {
				[Op.gte]: startEpoch,
				[Op.lte]: endEpoch,
			}
		}

		const sessionData = await Session.findAndCountAll({
			where: whereCondition,
			order: [['start_date', 'ASC']],
			attributes: [
				'id',
				'title',
				'description',
				'start_date',
				'end_date',
				'status',
				'image',
				'mentor_id',
				'created_at',
				'meeting_info',
				'visibility',
				'mentor_organization_id',
				/* ['meetingInfo.platform', 'meetingInfo.platform'],
				['meetingInfo.value', 'meetingInfo.value'], */
			],
			offset: limit * (page - 1),
			limit: limit,
			raw: true,
		})
		return sessionData
	} catch (error) {
		console.error(error)
		return error
	}
}

exports.findAndCountAll = async (filter, options = {}, attributes = {}) => {
	try {
		const { rows, count } = await Session.findAndCountAll({
			where: filter,
			...options,
			...attributes,
			raw: true,
		})
		return { rows, count }
	} catch (error) {
		return error
	}
}
exports.mentorsSessionWithPendingFeedback = async (mentorId, options = {}, completedSessionIds) => {
	try {
		return await Session.findAll({
			where: {
				id: { [Op.notIn]: completedSessionIds },
				status: common.COMPLETED_STATUS,
				started_at: {
					[Op.not]: null,
				},
				is_feedback_skipped: false,
				mentor_id: mentorId,
			},
			...options,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.getUpcomingSessionsFromView = async (
	page,
	limit,
	searchFilter,
	userId,
	filter,
	saasFilter = '',
	additionalProjectionclause = '',
	searchText,
	defaultFilter = ''
) => {
	try {
		const currentEpochTime = Math.floor(Date.now() / 1000)

		const filterClause = filter?.query.length > 0 ? `AND (${filter.query})` : ''

		const saasFilterClause = saasFilter != '' ? saasFilter : ''
		const defaultFilterClause = defaultFilter != '' ? 'AND ' + defaultFilter : ''
		let publicSessionFilter = " AND type = '" + common.SESSION_TYPE.PUBLIC + "'"

		// Create selection clause
		let projectionClause = [
			'id',
			'title',
			'description',
			'start_date',
			'end_date',
			'meta',
			'recommended_for',
			'medium',
			'categories',
			'status',
			'image',
			'mentor_id',
			'visibility',
			'mentor_organization_id',
			'created_at',
			'mentor_name',
			"(meeting_info - 'link') AS meeting_info",
		]

		if (additionalProjectionclause !== '') {
			projectionClause.push(additionalProjectionclause)
		}

		//if (searchFilter.positionQuery !== '') {
		//projectionClause.push(searchFilter.positionQuery)
		//}

		projectionClause = projectionClause.join(',')

		let orderClause = []
		if (searchFilter.sortQuery !== '') {
			orderClause.push(searchFilter.sortQuery)
		}
		orderClause.push('start_date ASC')
		orderClause = orderClause.join(',')

		const query = `
		SELECT 
			${projectionClause}
		FROM
			${common.materializedViewsPrefix + Session.tableName}
		WHERE
			mentor_id != :userId
			${saasFilterClause}
			${filterClause}
			AND status IN ('${common.PUBLISHED_STATUS}', '${common.LIVE_STATUS}')
			${publicSessionFilter}
			${searchFilter.whereClause}
			${defaultFilterClause}
		ORDER BY
			${orderClause}
		OFFSET
			:offset
		LIMIT
			:limit;
	`

		const replacements = {
			search: `%${searchText}%`,
			userId: userId,
			currentEpochTime: currentEpochTime,
			offset: limit * (page - 1),
			limit: limit,
			...filter.replacements,
		}

		if (filter && typeof filter === 'object') {
			for (const key in filter) {
				if (Array.isArray(filter[key])) {
					replacements[key] = filter[key]
				}
			}
		}

		const sessionIds = await Sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: replacements,
		})
		const countQuery = `
		SELECT count(*) AS "count"
		FROM
			${common.materializedViewsPrefix + Session.tableName}
		WHERE
			mentor_id != :userId
			${saasFilterClause}
			${filterClause}
			AND status IN ('${common.PUBLISHED_STATUS}', '${common.LIVE_STATUS}')
			${publicSessionFilter}
			${searchFilter.whereClause}
			${defaultFilterClause}
		;
	`
		const count = await Sequelize.query(countQuery, {
			type: QueryTypes.SELECT,
			replacements: replacements,
		})

		return {
			rows: sessionIds,
			count: Number(count[0].count),
		}
	} catch (error) {
		console.error(error)
		throw error
	}
}

exports.findAllByIds = async (ids) => {
	try {
		return await Session.findAll({
			where: {
				id: ids,
			},
			raw: true,
			order: [['created_at', 'DESC']],
		})
	} catch (error) {
		return error
	}
}

exports.getMentorsUpcomingSessionsFromView = async (
	page,
	limit,
	search,
	mentorId,
	filter,
	saasFilter = '',
	defaultFilter = ''
) => {
	try {
		const currentEpochTime = Math.floor(Date.now() / 1000)

		const filterClause = filter?.query.length > 0 ? `AND ${filter.query}` : ''

		const saasFilterClause = saasFilter != '' ? saasFilter : ''

		const defaultFilterClause = defaultFilter != '' ? 'AND ' + defaultFilter : ''

		const query = `
		SELECT
			id,
			title,
			description,
			start_date,
			end_date,
			status,
			image,
			mentor_id,
			meeting_info,
			visibility,
			mentor_organization_id
		FROM
				${common.materializedViewsPrefix + Session.tableName}
		WHERE
			mentor_id = :mentorId
			AND status = 'PUBLISHED'
			AND start_date > :currentEpochTime
			AND started_at IS NULL
			AND (
				LOWER(title) LIKE :search
			)
			${filterClause}
			${saasFilterClause}
			${defaultFilterClause}
		ORDER BY
			start_date ASC
		OFFSET
			:offset
		LIMIT
			:limit;
	`

		const replacements = {
			mentorId: mentorId,
			currentEpochTime: currentEpochTime,
			search: `%${search.toLowerCase()}%`,
			offset: limit * (page - 1),
			limit: limit,
			...filter.replacements, // Add filter parameters to replacements
		}

		const sessionAttendeesData = await Sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: replacements,
		})
		const countQuery = `
		SELECT count(*) AS "count"
		FROM
		${common.materializedViewsPrefix + Session.tableName}
		WHERE
			mentor_id = :mentorId
			AND status = 'PUBLISHED'
			AND start_date > :currentEpochTime
			AND started_at IS NULL
			AND (
				LOWER(title) LIKE :search
			)
			${filterClause}
			${saasFilterClause}
			${defaultFilterClause};
	`
		const count = await Sequelize.query(countQuery, {
			type: QueryTypes.SELECT,
			replacements: replacements,
		})
		return {
			data: sessionAttendeesData,
			count: Number(count[0].count),
		}
	} catch (error) {
		throw error
	}
}

exports.deactivateAndReturnMentorSessions = async (userId) => {
	try {
		const currentEpochTime = moment().unix()
		const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ssZ')

		const filter = {
			user_id: userId,
		}

		const option = {
			attributes: ['session_id'],
		}
		const sessionIds = await sessionOwnership.findAll(filter, option, true)
		const foundSessions = await Session.findAll({
			where: {
				id: { [Op.in]: sessionIds },
				[Op.or]: [{ start_date: { [Op.gt]: currentEpochTime } }, { status: common.PUBLISHED_STATUS }],
			},
			raw: true,
		})

		const sessionIdAndTitle = foundSessions.map((session) => {
			return { id: session.id, title: session.title }
		})
		const upcomingSessionIds = foundSessions.map((session) => session.id)

		const updatedSessions = await Session.update(
			{
				status: common.INACTIVE_STATUS,
			},
			{
				where: {
					id: { [Op.in]: upcomingSessionIds },
				},
			}
		)
		const removedSessions = updatedSessions[0] > 0 ? sessionIdAndTitle : []
		return removedSessions
	} catch (error) {
		return error
	}
}

exports.getUpcomingSessionsOfMentee = async (menteeUserId, sessionType) => {
	try {
		// Get private sessions where the deleted mentee was enrolled and session is in future
		const query = `
			SELECT s.id, s.title, s.mentor_id, s.start_date, s.end_date, s.type, s.created_by
			FROM sessions s
			INNER JOIN  session_attendees sa ON s.id = sa.session_id
			WHERE sa.mentee_id = :menteeUserId
			AND s.type = :sessionType
			AND s.start_date > :currentTime
			AND s.deleted_at IS NULL
		`

		const privateSessions = await Sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: {
				menteeUserId,
				sessionType,
				currentTime: Math.floor(Date.now() / 1000),
			},
		})

		return privateSessions || []
	} catch (error) {
		throw error
	}
}

exports.getUpcomingSessionsForMentor = async (mentorUserId) => {
	try {
		const currentTime = Math.floor(Date.now() / 1000)

		const upcomingSessions = await Session.findAll({
			where: {
				mentor_id: mentorUserId,
				start_date: { [Op.gt]: currentTime },
				deleted_at: null,
				created_by: {
					[Op.and]: [{ [Op.ne]: null }, { [Op.ne]: mentorUserId }],
				},
			},
			raw: true,
		})

		return upcomingSessions || []
	} catch (error) {
		throw error
	}
}

exports.getSessionsCreatedByMentor = async (mentorUserId) => {
	try {
		const query = `
				SELECT s.*, sa.mentee_id
				FROM ${Session.tableName} s
				INNER JOIN session_attendees sa ON s.id = sa.session_id
				WHERE s.mentor_id = :mentorUserId 
				AND s.start_date > :currentTime
				AND s.deleted_at IS NULL
				AND s.created_by = :mentorUserId
			`

		const sessionsToDelete = await Sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: {
				mentorUserId,
				currentTime: Math.floor(Date.now() / 1000),
			},
		})

		return sessionsToDelete
	} catch (error) {
		throw error
	}
}

exports.getSessionsAssignedToMentor = async (mentorUserId) => {
	try {
		const query = `
				SELECT s.*, sa.mentee_id
				FROM ${Session.tableName} s
				INNER JOIN session_attendees sa ON s.id = sa.session_id
				WHERE s.mentor_id = :mentorUserId 
				AND s.start_date > :currentTime
				AND s.deleted_at IS NULL
			`

		const sessionsToDelete = await Sequelize.query(query, {
			type: QueryTypes.SELECT,
			replacements: {
				mentorUserId,
				currentTime: Math.floor(Date.now() / 1000),
			},
		})

		return sessionsToDelete
	} catch (error) {
		throw error
	}
}

exports.addOwnership = async (sessionId, mentorId) => {
	try {
		await sessionOwnership.create({
			user_id: mentorId,
			session_id: sessionId,
			type: common.SESSION_OWNERSHIP_TYPE.MENTOR,
		})
		return true
	} catch (error) {
		return error
	}
}

// Session Manager Deletion Flow Codes

// exports.replaceSessionManagerAndReturn = async (userId, newUserId, orgAdminUserId) => {
// 	try {
// 		const currentEpochTime = moment().unix()
// 		const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ssZ')

// 		// Get session_ids where user is CREATOR
// 		const creatorSessions = await sessionOwnership.findAll(
// 			{ user_id: userId, type: common.SESSION_OWNERSHIP_TYPE.CREATOR },
// 			{ attributes: ['session_id'] },
// 			true
// 		)
// 		const creatorSessionIds = creatorSessions.map((s) => s.session_id)

// 		// Get session_ids where user is MENTOR
// 		const mentorSessions = await sessionOwnership.findAll(
// 			{ user_id: userId, type: common.SESSION_OWNERSHIP_TYPE.MENTOR },
// 			{ attributes: ['session_id'] },
// 			true
// 		)
// 		const mentorSessionIds = mentorSessions.map((s) => s.session_id)

// 		// Sessions where user is both MENTOR and CREATOR
// 		const bothRolesSessionIds = creatorSessionIds.filter((id) => mentorSessionIds.includes(id))

// 		// Sessions where user is only CREATOR
// 		const onlyCreatorSessionIds = creatorSessionIds.filter((id) => !bothRolesSessionIds.includes(id))

// 		// ----- Handle bothRolesSessionIds -----
// 		let removedSessions = []

// 		if (bothRolesSessionIds.length > 0) {
// 			const foundSessions = await Session.findAll({
// 				where: {
// 					id: { [Op.in]: bothRolesSessionIds },
// 					[Op.or]: [
// 						{ start_date: { [Op.gt]: currentEpochTime } },
// 						{ status: common.PUBLISHED_STATUS },
// 					],
// 				},
// 				raw: true,
// 			})

// 			const sessionIdAndTitle = foundSessions.map((session) => ({
// 				id: session.id,
// 				title: session.title,
// 			}))
// 			const upcomingSessionIds = foundSessions.map((session) => session.id)

// 			if (upcomingSessionIds.length > 0) {
// 				await Session.update(
// 					{ deleted_at: currentDateTime },
// 					{ where: { id: { [Op.in]: upcomingSessionIds } } }
// 				)
// 				await SessionOwnership.update(
// 					{ deleted_at: currentDateTime },
// 					{ where: { session_id: { [Op.in]: upcomingSessionIds } } }
// 				)
// 			}

// 			removedSessions = sessionIdAndTitle
// 		}

// 		// ----- Handle onlyCreatorSessionIds -----
// 		if (onlyCreatorSessionIds.length > 0) {
// 			const onlyCreatorSessions = await Session.findAll({
// 				where: {
// 					id: { [Op.in]: onlyCreatorSessionIds },
// 				},
// 				attributes: ['id', 'status'],
// 				raw: true,
// 			})

// 			const publishedOrLiveSessionIds = onlyCreatorSessions
// 				.filter((s) => [common.PUBLISHED_STATUS, common.LIVE_STATUS].includes(s.status))
// 				.map((s) => s.id)

// 			const completedSessionIds = onlyCreatorSessions
// 				.filter((s) => s.status === common.COMPLETED_STATUS)
// 				.map((s) => s.id)

// 			// Update user_id to newUserId for PUBLISHED or LIVE sessions
// 			if (publishedOrLiveSessionIds.length > 0) {
// 				await SessionOwnership.update(
// 					{ user_id: newUserId },
// 					{
// 						where: {
// 							user_id: userId,
// 							session_id: { [Op.in]: publishedOrLiveSessionIds },
// 							type: common.SESSION_OWNERSHIP_TYPE.CREATOR,
// 						},
// 					}
// 				)

// 				await Session.update(
// 					{ created_by: newUserId ,
// 					  updated_by: newUserId },
// 					{
// 						where: {
// 							id: { [Op.in]: publishedOrLiveSessionIds }
// 						},
// 					}
// 				)
// 			}

// 			// Update user_id to orgAdminUserId for COMPLETED sessions
// 			if (completedSessionIds.length > 0) {
// 				await SessionOwnership.update(
// 					{ user_id: orgAdminUserId },
// 					{
// 						where: {
// 							user_id: userId,
// 							session_id: { [Op.in]: completedSessionIds },
// 							type: common.SESSION_OWNERSHIP_TYPE.CREATOR,
// 						},
// 					}
// 				)
// 				await Session.update(
// 					{
// 					  created_by: orgAdminUserId ,
// 					  updated_by: orgAdminUserId
// 					},
// 					{
// 						where: {
// 							id: { [Op.in]: completedSessionIds }						},
// 					}
// 				)
// 			}
// 		}

// 		return {
// 			removedSessions,
// 			bothRolesSessionIds,
// 			onlyCreatorSessionIds,
// 		}
// 	} catch (error) {
// 		console.error('Error in removeAndReturnMentorSessions:', error)
// 		return error
// 	}
// }

// exports.replaceSessionManagerAndReturn = async (oldSMUserId, newSMUserId, orgUserId) => {
// 	try {
// 		const currentEpochTime = moment().unix()
// 		const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ssZ')

// 		const getSessionIds = async (type) => {
// 			const filter = {
// 			  user_id: oldSMUserId, // Ensure it's a string
// 			  type: type,
// 			}

// 			const options = {
// 			  attributes: ['session_id'],
// 			}

// 			const sessionIds = await sessionOwnership.findAll(filter, options, true) // third param = true to get only session_ids
// 			return sessionIds
// 		  }

// 		const updateSessionOwnerships = async (ids, uid) => {
// 			try {
// 				return await SessionOwnership.update(
// 					{ user_id: uid },
// 					{
// 						where: {
// 							user_id: oldSMUserId,
// 							session_id: { [Op.in]: ids },
// 							type: common.SESSION_OWNERSHIP_TYPE.CREATOR,
// 						},
// 					}
// 				);
// 			} catch (error) {
// 				console.error('Error updating session ownerships:', error);
// 				throw error;
// 			}
// 		};

// 		const updateSessions = (ids, uid) => {
// 			return Session.update(
// 				{ created_by: uid, updated_by: uid },
// 				{ where: { id: { [Op.in]: ids } } }
// 			)
// 		}

// 		const softDeleteSessions = (ids) => {
// 			return Promise.all([
// 				Session.update(
// 					{ deleted_at: currentDateTime },
// 					{ where: { id: { [Op.in]: ids } } }
// 				),
// 				SessionOwnership.update(
// 					{ deleted_at: currentDateTime },
// 					{ where: { session_id: { [Op.in]: ids } } }
// 				)
// 			])
// 		}

// 		// Fetch creator and mentor session IDs
// 		const [creatorSessionIds, mentorSessionIds] = await Promise.all([
// 			getSessionIds(common.SESSION_OWNERSHIP_TYPE.CREATOR),
// 			getSessionIds(common.SESSION_OWNERSHIP_TYPE.MENTOR),
// 		])

// 		// Identify bothRoles and onlyCreator session IDs
// 		const bothRolesSessionIds = creatorSessionIds.filter(id => mentorSessionIds.includes(id))
// 		const onlyCreatorSessionIds = creatorSessionIds.filter(id => !mentorSessionIds.includes(id))

// 		let removedSessions = []

// 		// Handle sessions where user is both MENTOR and CREATOR
// 		if (bothRolesSessionIds.length > 0) {
// 			const foundSessions = await Session.findAll({
// 				where: {
// 					id: { [Op.in]: bothRolesSessionIds },
// 					[Op.or]: [
// 						{ start_date: { [Op.gt]: currentEpochTime } },
// 						{ status: common.PUBLISHED_STATUS },
// 					],
// 				},
// 				raw: true,
// 			})

// 			const upcomingSessionIds = foundSessions.map(s => s.id)
// 			removedSessions = foundSessions.map(({ id, title }) => ({ id, title }))

// 			if (upcomingSessionIds.length > 0) {
// 				await softDeleteSessions(upcomingSessionIds);
// 			}
// 		}

// 		// Handle sessions where user is only CREATOR
// 		if (onlyCreatorSessionIds.length > 0) {
// 			const onlyCreatorSessions = await Session.findAll({
// 				where: { id: { [Op.in]: onlyCreatorSessionIds } },
// 				attributes: ['id', 'status'],
// 				raw: true,
// 			})

// 			const publishedOrLiveSessionIds = []
// 			const completedSessionIds = []

// 			for (const s of onlyCreatorSessions) {
// 				if ([common.PUBLISHED_STATUS, common.LIVE_STATUS].includes(s.status)) {
// 					publishedOrLiveSessionIds.push(s.id)
// 				} else if (s.status === common.COMPLETED_STATUS) {
// 					completedSessionIds.push(s.id)
// 				}
// 			}
// 			if (publishedOrLiveSessionIds.length > 0) {
// 				const result1 = await updateSessionOwnerships(publishedOrLiveSessionIds, newSMUserId);

// 				const result2 = await updateSessions(publishedOrLiveSessionIds, newSMUserId);
// 			}

// 			if (completedSessionIds.length > 0) {
// 				const result3 = await updateSessionOwnerships(completedSessionIds, orgUserId);

// 				const result4 = await updateSessions(completedSessionIds, orgUserId);
// 			}

// 		}

// 		return {
// 			removedSessions,
// 			bothRolesSessionIds,
// 			onlyCreatorSessionIds,
// 		};
// 	} catch (error) {
// 		console.error('Error in replaceSessionManagerAndReturn:', error)
// 		return error
// 	}
// }
