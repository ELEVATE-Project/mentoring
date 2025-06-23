const common = require('@constants/common')
const utils = require('@generics/utils')

const menteeQueries = require('@database/queries/userExtension')
const sessionAttendeesQueries = require('@database/queries/sessionAttendees')
const sessionQueries = require('@database/queries/sessions')
const _ = require('lodash')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const { Op } = require('sequelize')
const entityTypeService = require('@services/entity-type')

module.exports = class SessionFetcherHelper {
	/**
	 * Get all enrolled session.
	 * @method
	 * @name getMySessions
	 * @param {Number} page - page No.
	 * @param {Number} limit - page limit.
	 * @param {String} search - search session.
	 * @param {String} userId - user id.
	 * @returns {JSON} - List of enrolled sessions
	 */

	static async getMySessions(page, limit, search, userId, startDate, endDate) {
		try {
			const upcomingSessions = await sessionQueries.getUpcomingSessions(
				page,
				limit,
				search,
				userId,
				startDate,
				endDate
			)
			const upcomingSessionIds = upcomingSessions.rows.map((session) => session.id)
			const usersUpcomingSessions = await sessionAttendeesQueries.usersUpcomingSessions(
				userId,
				upcomingSessionIds
			)
			let sessionAndMenteeMap = {}
			usersUpcomingSessions.forEach((session) => {
				sessionAndMenteeMap[session.session_id] = session.type
			})

			const usersUpcomingSessionIds = usersUpcomingSessions.map(
				(usersUpcomingSession) => usersUpcomingSession.session_id
			)

			const attributes = { exclude: ['mentee_password', 'mentor_password'] }
			let sessionDetails = await sessionQueries.findAndCountAll(
				{ id: usersUpcomingSessionIds },
				{ order: [['start_date', 'ASC']] },
				{ attributes: attributes }
			)
			if (sessionDetails.rows.length > 0) {
				sessionDetails.rows.forEach((session) => {
					if (sessionAndMenteeMap.hasOwnProperty(session.id)) {
						session.enrolled_type = sessionAndMenteeMap[session.id]
					}
				})

				const uniqueOrgIds = [...new Set(sessionDetails.rows.map((obj) => obj.mentor_organization_id))]
				sessionDetails.rows = await entityTypeService.processEntityTypesToAddValueLabels(
					sessionDetails.rows,
					uniqueOrgIds,
					common.sessionModelName,
					'mentor_organization_id'
				)
			}
			sessionDetails.rows = await this.sessionMentorDetails(sessionDetails.rows)

			return sessionDetails
		} catch (error) {
			throw error
		}
	}

	static async sessionMentorDetails(sessions) {
		try {
			if (sessions.length === 0) {
				return sessions
			}

			// Extract unique mentor_ids
			const mentorIds = [...new Set(sessions.map((session) => session.mentor_id))]

			// Fetch mentor details
			// const mentorDetails = (await userRequests.getListOfUserDetails(mentorIds)).result
			const mentorDetails = await menteeQueries.getUsersByUserIds(
				mentorIds,
				{
					attributes: ['user_id', 'organization_id'],
				},
				true
			)

			let organizationIds = []
			mentorDetails.forEach((element) => {
				organizationIds.push(element.organization_id)
			})
			const organizationDetails = await organisationExtensionQueries.findAll(
				{
					organization_id: {
						[Op.in]: [...organizationIds],
					},
				},
				{
					attributes: ['name', 'organization_id'],
				}
			)

			// Map mentor names to sessions
			sessions.forEach((session) => {
				const mentor = mentorDetails.find((mentorDetail) => mentorDetail.user_id === session.mentor_id)
				if (mentor) {
					const orgnization = organizationDetails.find(
						(organizationDetail) => organizationDetail.organization_id === mentor.organization_id
					)
					session.mentor_name = mentor.name
					session.organization = orgnization.name
				}
			})

			// Fetch and update image URLs in parallel
			await Promise.all(
				sessions.map(async (session) => {
					if (session.image && session.image.length > 0) {
						session.image = await Promise.all(
							session.image.map(async (imgPath) =>
								imgPath ? await utils.getDownloadableUrl(imgPath) : null
							)
						)
					}
				})
			)

			return sessions
		} catch (error) {
			throw error
		}
	}
}
