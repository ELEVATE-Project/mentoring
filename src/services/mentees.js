// Dependencies
const userRequests = require('@requests/user')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const feedbackHelper = require('./feedback')

const cloudUtils = require('@utils/cloud')
const dateTimeUtils = require('@utils/dateTime')
const requestUtils = require('@utils/request')
const entityHelpers = require('@helpers/entity')

const { UniqueConstraintError } = require('sequelize')
const menteeQueries = require('@database/queries/userExtension')
const sessionAttendeesQueries = require('@database/queries/sessionAttendees')
const sessionQueries = require('@database/queries/sessions')
const _ = require('lodash')
const entityTypeQueries = require('@database/queries/entityType')
const bigBlueButtonService = require('./bigBlueButton')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const orgAdminService = require('@services/org-admin')
const mentorQueries = require('@database/queries/mentorExtension')
const { getDefaultOrgId } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')
const entityTypeService = require('@services/entity-type')
const { getEnrolledMentees } = require('@helpers/getEnrolledMentees')
const responses = require('@helpers/responses')
const permissions = require('@helpers/getPermissions')

module.exports = class MenteesHelper {
	/**
	 * Profile.
	 * @method
	 * @name profile
	 * @param {String} userId - user id.
	 * @returns {JSON} - profile details
	 */
	static async read(id, orgId) {
		const menteeDetails = await userRequests.details('', id)
		const mentee = await menteeQueries.getMenteeExtension(id)
		delete mentee.user_id
		delete mentee.visible_to_organizations

		const defaultOrgId = await getDefaultOrgId()
		if (!defaultOrgId)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_ID_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		const userExtensionsModelName = await menteeQueries.getModelName()

		let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
			status: 'ACTIVE',
			organization_id: {
				[Op.in]: [orgId, defaultOrgId],
			},
			model_names: { [Op.contains]: [userExtensionsModelName] },
		})
		const validationData = entityHelpers.removeDefaultOrgEntityTypes(entityTypes, orgId)
		//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))

		const processDbResponse = entityHelpers.processDbResponse(mentee, validationData)

		const totalSession = await sessionAttendeesQueries.countEnrolledSessions(id)

		const menteePermissions = await permissions.getPermissions(menteeDetails.data.result.user_roles)
		if (!Array.isArray(menteeDetails.data.result.permissions)) {
			menteeDetails.data.result.permissions = []
		}
		menteeDetails.data.result.permissions.push(...menteePermissions)

		return responses.successResponse({
			statusCode: httpStatusCode.ok,
			message: 'PROFILE_FTECHED_SUCCESSFULLY',
			result: {
				sessions_attended: totalSession,
				...menteeDetails.data.result,
				...processDbResponse,
			},
		})
	}

	/**
	 * Sessions list. Includes upcoming and enrolled sessions.
	 * @method
	 * @name sessions
	 * @param {String} userId - user id.
	 * @param {Boolean} enrolledSessions - true/false.
	 * @param {Number} page - page No.
	 * @param {Number} limit - page limit.
	 * @param {String} search - search field.
	 * @returns {JSON} - List of sessions
	 */

	static async sessions(userId, page, limit, search = '') {
		try {
			/** Upcoming user's enrolled sessions {My sessions}*/
			/* Fetch sessions if it is not expired or if expired then either status is live or if mentor 
				delays in starting session then status will remain published for that particular interval so fetch that also */

			/* TODO: Need to write cron job that will change the status of expired sessions from published to cancelled if not hosted by mentor */
			const sessions = await this.getMySessions(page, limit, search, userId)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSION_FETCHED_SUCCESSFULLY',
				result: { data: sessions.rows, count: sessions.count },
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Mentees reports.
	 * @method
	 * @name reports
	 * @param {String} userId - user id.
	 * @param {String} filterType - MONTHLY/WEEKLY/QUARTERLY.
	 * @returns {JSON} - Mentees reports
	 */

	static async reports(userId, filterType) {
		try {
			let filterStartDate, filterEndDate

			switch (filterType) {
				case 'MONTHLY':
					;[filterStartDate, filterEndDate] = dateTimeUtils.getCurrentMonthRange()
					break
				case 'WEEKLY':
					;[filterStartDate, filterEndDate] = dateTimeUtils.getCurrentWeekRange()
					break
				case 'QUARTERLY':
					;[filterStartDate, filterEndDate] = dateTimeUtils.getCurrentQuarterRange()
					break
				default:
					throw new Error('Invalid filterType')
			}

			const totalSessionsEnrolled = await sessionAttendeesQueries.getEnrolledSessionsCountInDateRange(
				filterStartDate.toISOString(),
				filterEndDate.toISOString(),
				userId
			)

			const totalSessionsAttended = await sessionAttendeesQueries.getAttendedSessionsCountInDateRange(
				filterStartDate.toISOString(),
				filterEndDate.toISOString(),
				userId
			)

			const result = {
				total_session_enrolled: totalSessionsEnrolled,
				total_session_attended: totalSessionsAttended,
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTEES_REPORT_FETCHED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Mentees homeFeed.
	 * @method
	 * @name homeFeed
	 * @param {String} userId - user id.
	 * @param {Boolean} isAMentor - true/false.
	 * @returns {JSON} - Mentees homeFeed.
	 */

	static async homeFeed(userId, isAMentor, page, limit, search, queryParams) {
		try {
			/* All Sessions */

			let allSessions = await this.getAllSessions(page, limit, search, userId, queryParams, isAMentor)

			/* My Sessions */

			let mySessions = await this.getMySessions(page, limit, search, userId)

			const result = {
				all_sessions: allSessions.rows,
				my_sessions: mySessions.rows,
			}
			const feedbackData = await feedbackHelper.pending(userId, isAMentor)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSION_FETCHED_SUCCESSFULLY',
				result: result,
				meta: {
					type: 'feedback',
					data: feedbackData.result,
				},
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Join session as Mentees.
	 * @method
	 * @name joinSession
	 * @param {String} sessionId - session id.
	 * @param {String} token - Mentees token.
	 * @returns {JSON} - Mentees join session link.
	 */

	static async joinSession(sessionId, token) {
		try {
			const mentee = await userRequests.details(token)

			if (mentee.data.responseCode !== 'OK') {
				return responses.failureResponse({
					message: 'USER_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const session = await sessionQueries.findById(sessionId)

			if (!session) {
				return responses.failureResponse({
					message: 'SESSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (session.status == 'COMPLETED') {
				return responses.failureResponse({
					message: 'SESSION_ENDED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (session.status !== 'LIVE') {
				return responses.failureResponse({
					message: 'JOIN_ONLY_LIVE_SESSION',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let menteeDetails = mentee.data.result
			const sessionAttendee = await sessionAttendeesQueries.findAttendeeBySessionAndUserId(
				menteeDetails.id,
				sessionId
			)
			if (!sessionAttendee) {
				return responses.failureResponse({
					message: 'USER_NOT_ENROLLED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			let meetingInfo
			if (session?.meeting_info?.value !== common.BBB_VALUE) {
				meetingInfo = session.meeting_info

				await sessionAttendeesQueries.updateOne(
					{
						id: sessionAttendee.id,
					},
					{
						meeting_info: meetingInfo,
						joined_at: dateTimeUtils.utcFormat(),
					}
				)
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'SESSION_START_LINK',
					result: meetingInfo,
				})
			}
			if (sessionAttendee?.meeting_info?.link) {
				meetingInfo = sessionAttendee.meeting_info
			} else {
				const attendeeLink = await bigBlueButtonService.joinMeetingAsAttendee(
					sessionId,
					menteeDetails.name,
					session.mentee_password
				)
				meetingInfo = {
					value: common.BBB_VALUE,
					platform: common.BBB_PLATFORM,
					link: attendeeLink,
				}
				await sessionAttendeesQueries.updateOne(
					{
						id: sessionAttendee.id,
					},
					{
						meeting_info: meetingInfo,
						joined_at: dateTimeUtils.utcFormat(),
					}
				)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSION_START_LINK',
				result: meetingInfo,
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Get all upcoming unenrolled session.
	 * @method
	 * @name getAllSessions
	 * @param {Number} page - page No.
	 * @param {Number} limit - page limit.
	 * @param {String} search - search session.
	 * @param {String} userId - user id.
	 * @returns {JSON} - List of all sessions
	 */

	static async getAllSessions(page, limit, search, userId, queryParams, isAMentor) {
		let additionalProjectionString = ''

		// check for fields query
		if (queryParams.fields && queryParams.fields !== '') {
			additionalProjectionString = queryParams.fields
			delete queryParams.fields
		}
		let query = requestUtils.processQueryParametersWithExclusions(queryParams)
		const sessionModelName = await sessionQueries.getModelName()

		let validationData = await entityTypeQueries.findAllEntityTypesAndEntities({
			status: 'ACTIVE',
			allow_filtering: true,
			model_names: { [Op.contains]: [sessionModelName] },
		})

		let filteredQuery = requestUtils.validateFilters(query, validationData, sessionModelName)

		// Create saas filter for view query
		const saasFilter = await this.filterSessionsBasedOnSaasPolicy(userId, isAMentor)

		const sessions = await sessionQueries.getUpcomingSessionsFromView(
			page,
			limit,
			search,
			userId,
			filteredQuery,
			saasFilter,
			additionalProjectionString
		)
		if (sessions.rows.length > 0) {
			const uniqueOrgIds = [...new Set(sessions.rows.map((obj) => obj.mentor_organization_id))]
			sessions.rows = await entityTypeService.processEntityTypesToAddValueLabels(
				sessions.rows,
				uniqueOrgIds,
				common.sessionModelName,
				'mentor_organization_id'
			)
		}

		sessions.rows = await this.menteeSessionDetails(sessions.rows, userId)

		sessions.rows = await this.sessionMentorDetails(sessions.rows)

		return sessions
	}

	/**
	 * @description 							- filter sessions based on user's saas policy.
	 * @method
	 * @name filterSessionsBasedOnSaasPolicy
	 * @param {Number} userId 					- User id.
	 * @param {Boolean} isAMentor 				- user mentor or not.
	 * @returns {JSON} 							- List of filtered sessions
	 */
	static async filterSessionsBasedOnSaasPolicy(userId, isAMentor) {
		try {
			const mentorExtension = await mentorQueries.getMentorExtension(userId, [
				'external_session_visibility',
				'organization_id',
			])

			const menteeExtension = await menteeQueries.getMenteeExtension(userId, [
				'external_session_visibility',
				'organization_id',
			])

			if (!mentorExtension && !menteeExtension) {
				throw responses.failureResponse({
					statusCode: httpStatusCode.unauthorized,
					message: 'USER_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}
			const organizationName = mentorExtension
				? (await userRequests.fetchDefaultOrgDetails(mentorExtension.organization_id))?.data?.result?.name
				: ''
			if ((isAMentor && menteeExtension) || (!isAMentor && mentorExtension))
				throw responses.failureResponse({
					statusCode: httpStatusCode.unauthorized,
					message: `Congratulations! You are now a mentor to the organisation ${organizationName}. Please re-login to start your journey as a mentor.`,
					responseCode: 'CLIENT_ERROR',
				})
			const userPolicyDetails = menteeExtension || mentorExtension
			let filter = ''
			if (userPolicyDetails.external_session_visibility && userPolicyDetails.organization_id) {
				// generate filter based on condition
				if (userPolicyDetails.external_session_visibility === common.CURRENT) {
					/**
					 * If {userPolicyDetails.external_session_visibility === CURRENT} user will be able to sessions-
					 *  -created by his/her organization mentors.
					 * So will check if mentor_organization_id equals user's  organization_id
					 */
					filter = `AND "mentor_organization_id" = ${userPolicyDetails.organization_id}`
				} else if (userPolicyDetails.external_session_visibility === common.ASSOCIATED) {
					/**
					 * user external_session_visibility is ASSOCIATED
					 * user can see sessions where session's visible_to_organizations contain user's organization_id and -
					 *  - session's visibility not CURRENT (In case of same organization session has to be fetched for that we added OR condition {"mentor_organization_id" = ${userPolicyDetails.organization_id}})
					 */
					filter = `AND ((${userPolicyDetails.organization_id} = ANY("visible_to_organizations") AND "visibility" != 'CURRENT') OR "mentor_organization_id" = ${userPolicyDetails.organization_id})`
				} else if (userPolicyDetails.external_session_visibility === common.ALL) {
					/**
					 * user's external_session_visibility === ALL (ASSOCIATED sessions + sessions whose visibility is ALL)
					 */
					filter = `AND ((${userPolicyDetails.organization_id} = ANY("visible_to_organizations") AND "visibility" != 'CURRENT' ) OR "visibility" = 'ALL' OR "mentor_organization_id" = ${userPolicyDetails.organization_id})`
				}
			}
			return filter
		} catch (err) {
			console.log(err)
			throw err
		}
	}

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

	static async getMySessions(page, limit, search, userId) {
		try {
			const upcomingSessions = await sessionQueries.getUpcomingSessions(page, limit, search, userId)
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

			let sessionDetails = await sessionQueries.findAndCountAll(
				{ id: usersUpcomingSessionIds },
				{ order: [['start_date', 'ASC']] }
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

	static async menteeSessionDetails(sessions, userId) {
		try {
			if (sessions.length > 0) {
				const sessionIds = sessions.map((session) => session.id)

				const attendees = await sessionAttendeesQueries.findAll({
					session_id: sessionIds,
					mentee_id: userId,
				})

				await Promise.all(
					sessions.map(async (session) => {
						const attendee = attendees.find((attendee) => attendee.session_id === session.id)
						if (attendee) session.enrolled_type = attendee.type
						session.is_enrolled = !!attendee
					})
				)

				return sessions
			} else {
				return sessions
			}
		} catch (err) {
			return err
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
			const mentorDetails = (await userRequests.getListOfUserDetails(mentorIds)).result
			// Map mentor names to sessions
			sessions.forEach((session) => {
				const mentor = mentorDetails.find((mentorDetail) => mentorDetail.id === session.mentor_id)
				if (mentor) {
					session.mentor_name = mentor.name
					session.organization = mentor.organization
				}
			})

			// Fetch and update image URLs in parallel
			await Promise.all(
				sessions.map(async (session) => {
					if (session.image && session.image.length > 0) {
						session.image = await Promise.all(
							session.image.map(async (imgPath) =>
								imgPath ? await cloudUtils.getDownloadableUrl(imgPath) : null
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
	// Functions for new APIs
	/**
	 * Create a new mentee extension.
	 * @method
	 * @name createMenteeExtension
	 * @param {Object} data - Mentee extension data to be created.
	 * @param {String} userId - User ID of the mentee.
	 * @returns {Promise<Object>} - Created mentee extension details.
	 */
	static async createMenteeExtension(data, userId, orgId) {
		try {
			// Call user service to fetch organisation details --SAAS related changes
			let userOrgDetails = await userRequests.fetchDefaultOrgDetails(orgId)
			// Return error if user org does not exists
			if (!userOrgDetails.success || !userOrgDetails.data || !userOrgDetails.data.result) {
				return responses.failureResponse({
					message: 'ORGANISATION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			// Find organisation policy from organisation_extension table
			let organisationPolicy = await organisationExtensionQueries.findOrInsertOrganizationExtension(orgId)

			data.user_id = userId

			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const userExtensionsModelName = await menteeQueries.getModelName()

			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_id: {
					[Op.in]: [orgId, defaultOrgId],
				},
				model_names: { [Op.contains]: [userExtensionsModelName] },
			})

			//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = entityHelpers.removeDefaultOrgEntityTypes(entityTypes, orgId)

			let res = entityHelpers.validateInput(data, validationData, userExtensionsModelName)
			if (!res.success) {
				return responses.failureResponse({
					message: 'MENTEE_EXTENSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}
			let menteeExtensionsModel = await menteeQueries.getColumns()
			data = entityHelpers.restructureBody(data, validationData, menteeExtensionsModel)

			// construct policy object
			let saasPolicyData = await orgAdminService.constructOrgPolicyObject(organisationPolicy, true)

			userOrgDetails.data.result.related_orgs = userOrgDetails.data.result.related_orgs
				? userOrgDetails.data.result.related_orgs.concat([saasPolicyData.organization_id])
				: [saasPolicyData.organization_id]

			// Update mentee extension creation data
			data = {
				...data,
				...saasPolicyData,
				visible_to_organizations: userOrgDetails.data.result.related_orgs,
			}

			const response = await menteeQueries.createMenteeExtension(data)
			const processDbResponse = entityHelpers.processDbResponse(response.toJSON(), validationData)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTEE_EXTENSION_CREATED',
				result: processDbResponse,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'MENTEE_EXTENSION_EXITS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return error
		}
	}

	/**
	 * Update a mentee extension.
	 * @method
	 * @name updateMenteeExtension
	 * @param {String} userId - User ID of the mentee.
	 * @param {Object} data - Updated mentee extension data excluding user_id.
	 * @returns {Promise<Object>} - Updated mentee extension details.
	 */
	static async updateMenteeExtension(data, userId, orgId) {
		try {
			// Remove certain data in case it is getting passed
			const dataToRemove = [
				'user_id',
				'visibility',
				'visible_to_organizations',
				'external_session_visibility',
				'external_mentor_visibility',
			]

			dataToRemove.forEach((key) => {
				if (data[key]) {
					delete data[key]
				}
			})

			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const userExtensionsModelName = await menteeQueries.getModelName()
			const filter = {
				status: 'ACTIVE',
				organization_id: {
					[Op.in]: [orgId, defaultOrgId],
				},
				model_names: { [Op.contains]: [userExtensionsModelName] },
			}
			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(filter)

			//validationData = entityHelpers.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = entityHelpers.removeDefaultOrgEntityTypes(entityTypes, orgId)
			let res = entityHelpers.validateInput(data, validationData, userExtensionsModelName)
			if (!res.success) {
				return responses.failureResponse({
					message: 'PROFILE_UPDATE_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}

			let userExtensionModel = await menteeQueries.getColumns()

			data = entityHelpers.restructureBody(data, validationData, userExtensionModel)

			const [updateCount, updatedUser] = await menteeQueries.updateMenteeExtension(userId, data, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				const fallbackUpdatedUser = await menteeQueries.getMenteeExtension(userId)
				console.log(fallbackUpdatedUser)
				if (!fallbackUpdatedUser) {
					return responses.failureResponse({
						statusCode: httpStatusCode.not_found,
						message: 'MENTEE_EXTENSION_NOT_FOUND',
					})
				}
				const processDbResponse = entityHelpers.processDbResponse(fallbackUpdatedUser, validationData)

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MENTEE_EXTENSION_UPDATED',
					result: processDbResponse,
				})
			}

			const processDbResponse = entityHelpers.processDbResponse(updatedUser[0], validationData)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTEE_EXTENSION_UPDATED',
				result: processDbResponse,
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Get mentee extension details by user ID.
	 * @method
	 * @name getMenteeExtension
	 * @param {String} userId - User ID of the mentee.
	 * @returns {Promise<Object>} - Mentee extension details.
	 */
	static async getMenteeExtension(userId, orgId) {
		try {
			const mentee = await menteeQueries.getMenteeExtension(userId)
			if (!mentee) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTEE_EXTENSION_NOT_FOUND',
				})
			}

			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const userExtensionsModelName = await menteeQueries.getModelName()
			const filter = {
				status: 'ACTIVE',
				organization_id: {
					[Op.in]: [orgId, defaultOrgId],
				},
				model_names: { [Op.contains]: [userExtensionsModelName] },
			}

			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities(filter)

			//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = entityHelpers.removeDefaultOrgEntityTypes(entityTypes, orgId)
			const processDbResponse = entityHelpers.processDbResponse(mentee, validationData)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTEE_EXTENSION_FETCHED',
				result: processDbResponse,
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Delete a mentee extension by user ID.
	 * @method
	 * @name deleteMenteeExtension
	 * @param {String} userId - User ID of the mentee.
	 * @returns {Promise<Object>} - Indicates if the mentee extension was deleted successfully.
	 */
	static async deleteMenteeExtension(userId) {
		try {
			const deleteCount = await menteeQueries.deleteMenteeExtension(userId)
			if (deleteCount === '0') {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTEE_EXTENSION_NOT_FOUND',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTEE_EXTENSION_DELETED',
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Get entities and organization filter
	 * @method
	 * @name getFilterList
	 * @param {String} tokenInformation - token information
	 * @param {Boolean} queryParams - queryParams
	 * @returns {JSON} - Filter list.
	 */
	static async getFilterList(entity_type, filterType, tokenInformation) {
		try {
			let result = {
				organizations: [],
				entity_types: {},
			}

			const filter_type = filterType !== '' ? filterType : common.MENTOR_ROLE

			let organization_ids = []
			const organizations = await this.getOrganizationIdBasedOnPolicy(
				tokenInformation.id,
				tokenInformation.organization_id,
				filter_type
			)

			if (organizations.success && organizations.result.length > 0) {
				organization_ids = [...organizations.result]

				if (organization_ids.length > 0) {
					//get organization list
					const organizationList = await userRequests.listOrganization(organization_ids)
					if (organizationList.success && organizationList.data?.result?.length > 0) {
						result.organizations = organizationList.data.result
					}

					const defaultOrgId = await getDefaultOrgId()

					// get entity type with entities list
					const getEntityTypesWithEntities = await this.getEntityTypeWithEntitiesBasedOnOrg(
						organization_ids,
						entity_type,
						defaultOrgId ? defaultOrgId : ''
					)

					if (getEntityTypesWithEntities.success && getEntityTypesWithEntities.result) {
						let entityTypesWithEntities = getEntityTypesWithEntities.result
						if (entityTypesWithEntities.length > 0) {
							let convertedData = convertEntitiesForFilter(entityTypesWithEntities)
							let doNotRemoveDefaultOrg = false
							if (organization_ids.includes(defaultOrgId)) {
								doNotRemoveDefaultOrg = true
							}
							result.entity_types = filterEntitiesBasedOnParent(
								convertedData,
								defaultOrgId,
								doNotRemoveDefaultOrg
							)
						}
					}
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FILTER_FETCHED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			return error
		}
	}

	static async getOrganizationIdBasedOnPolicy(userId, organization_id, filterType) {
		try {
			let organizationIds = []
			filterType = filterType.toLowerCase()
			const attributes =
				filterType == common.MENTEE_ROLE
					? ['organization_id', 'session_visibility_policy']
					: ['organization_id', 'external_mentor_visibility_policy']

			const orgExtension = await organisationExtensionQueries.findOne(
				{ organization_id },
				{
					attributes: attributes,
				}
			)

			const visibilityPolicy =
				filterType == common.MENTEE_ROLE
					? orgExtension.session_visibility_policy
					: orgExtension.external_mentor_visibility_policy

			if (orgExtension?.organization_id) {
				if (visibilityPolicy === common.CURRENT) {
					organizationIds.push(orgExtension.organization_id)
				} else if (visibilityPolicy === common.ASSOCIATED || visibilityPolicy === common.ALL) {
					organizationIds.push(orgExtension.organization_id)
					let relatedOrgs = []
					let userOrgDetails = await userRequests.fetchDefaultOrgDetails(orgExtension.organization_id)
					if (userOrgDetails.success && userOrgDetails.data?.result?.related_orgs?.length > 0) {
						relatedOrgs = userOrgDetails.data.result.related_orgs
					}
					if (visibilityPolicy === common.ASSOCIATED) {
						const associatedAdditionalFilter =
							filterType == common.MENTEE_ROLE
								? {
										external_session_visibility_policy: {
											[Op.ne]: 'CURRENT',
										},
								  }
								: {
										mentor_visibility_policy: {
											[Op.ne]: 'CURRENT',
										},
								  }

						const organizationExtension = await organisationExtensionQueries.findAll(
							{
								[Op.and]: [
									{
										organization_id: {
											[Op.in]: [...relatedOrgs],
										},
									},
									associatedAdditionalFilter,
								],
							},
							{
								attributes: ['organization_id'],
							}
						)
						organizationIds.push(orgExtension.organization_id)
						if (organizationExtension) {
							const organizationIdsFromOrgExtension = organizationExtension.map(
								(orgExt) => orgExt.organization_id
							)
							organizationIds.push(...organizationIdsFromOrgExtension)
						}
					} else {
						// filter out the organizations
						// CASE 1 : in case of mentee listing filterout organizations with external_session_visibility_policy = ALL
						// CASE 2 : in case of mentor listing filterout organizations with mentor_visibility_policy = ALL
						const filterQuery =
							filterType == common.MENTEE_ROLE
								? {
										external_session_visibility_policy: common.ALL,
								  }
								: {
										mentor_visibility_policy: common.ALL,
								  }

						// this filter is applied for the below condition
						// SM session_visibility_policy (in case of mentee list) or external_mentor_visibility policy (in case of mentor list) = ALL
						//  and CASE 1 (mentee list) : Mentees is related to the SM org but external_session_visibility is CURRENT (exclude these mentees)
						//  CASE 2 : (mentor list) : Mentors is related to SM Org but mentor_visibility set to CURRENT  (exclude these mentors)
						const additionalFilter =
							filterType == common.MENTEE_ROLE
								? {
										external_session_visibility_policy: {
											[Op.ne]: 'CURRENT',
										},
								  }
								: {
										mentor_visibility_policy: {
											[Op.ne]: 'CURRENT',
										},
								  }
						const organizationExtension = await organisationExtensionQueries.findAll(
							{
								[Op.or]: [
									filterQuery,
									{
										[Op.and]: [
											{
												organization_id: {
													[Op.in]: [...relatedOrgs],
												},
											},
											additionalFilter,
										],
									},
								],
							},
							{
								attributes: ['organization_id'],
							}
						)
						organizationIds.push(orgExtension.organization_id)
						if (organizationExtension) {
							const organizationIdsFromOrgExtension = organizationExtension.map(
								(orgExt) => orgExt.organization_id
							)
							organizationIds.push(...organizationIdsFromOrgExtension)
						}
					}
				}
			}

			return {
				success: true,
				result: organizationIds,
			}
		} catch (error) {
			return {
				success: false,
				message: error.message,
			}
		}
	}

	static async getEntityTypeWithEntitiesBasedOnOrg(organization_ids, entity_types, defaultOrgId = '') {
		try {
			let filter = {
				status: common.ACTIVE_STATUS,
				allow_filtering: true,
				has_entities: true,
				organization_id: {
					[Op.in]: defaultOrgId ? [...organization_ids, defaultOrgId] : organization_ids,
				},
			}

			let entityTypes = []
			if (entity_types) {
				entityTypes = entity_types.split(',')
				filter.value = {
					[Op.in]: entityTypes,
				}
			}

			//fetch entity types and entities
			let entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter)

			return {
				success: true,
				result: entityTypesWithEntities,
			}
		} catch (error) {
			return {
				success: false,
				message: error.message,
			}
		}
	}

	/* List mentees and search with name , email
	 * @method
	 * @name list
	 * @param {String} userId - User ID of the mentee.
	 * @param {Number} pageNo - Page No.
	 * @param {Number} pageSize - Page Size.
	 * @param {String} searchText
	 * @param {String} queryParams
	 * @param {String} userId
	 * @param {Boolean} isAMentor - true/false.
	 * @returns {Promise<Object>} - returns the list of mentees
	 */
	static async list(pageNo, pageSize, searchText, queryParams, userId, isAMentor) {
		try {
			let additionalProjectionString = ''

			// check for fields query
			if (queryParams.fields && queryParams.fields !== '') {
				additionalProjectionString = queryParams.fields
				delete queryParams.fields
			}
			let userServiceQueries = {}
			let organization_ids = []
			let designation = []
			let searchQuery = ''

			const [sortBy, order] = ['name'].includes(queryParams.sort_by)
				? [queryParams.sort_by, queryParams.order || 'ASC']
				: [false, 'ASC']

			for (let key in queryParams) {
				if (queryParams.hasOwnProperty(key) & (key === 'search')) {
					searchQuery = queryParams[key]
				}
				if (queryParams.hasOwnProperty(key) & (key === 'organization_ids')) {
					organization_ids = queryParams[key].split(',')
				}
			}

			const query = requestUtils.processQueryParametersWithExclusions(queryParams)
			const userExtensionModelName = await menteeQueries.getModelName()
			const mentorExtensionModelName = await menteeQueries.getModelName()

			let validationData = await entityTypeQueries.findAllEntityTypesAndEntities({
				status: common.ACTIVE_STATUS,
				model_names: { [Op.overlap]: [userExtensionModelName, mentorExtensionModelName] },
			})

			let filteredQuery = requestUtils.validateFilters(
				query,
				JSON.parse(JSON.stringify(validationData)),
				userExtensionModelName
			)

			const userType = [common.MENTEE_ROLE, common.MENTOR_ROLE]

			const saasFilter = await this.filterMenteeListBasedOnSaasPolicy(userId, isAMentor, organization_ids)
			let extensionDetails = await menteeQueries.getUsersByUserIdsFromView(
				[],
				null,
				null,
				filteredQuery,
				saasFilter,
				additionalProjectionString,
				true
			)

			let mentorExtensionDetails = await mentorQueries.getMentorsByUserIdsFromView(
				[],
				null,
				null,
				filteredQuery,
				saasFilter,
				additionalProjectionString,
				true
			)

			extensionDetails.data = [...extensionDetails.data, ...mentorExtensionDetails.data]
			extensionDetails.count += mentorExtensionDetails.count

			if (extensionDetails.count == 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MENTEE_LIST',
					result: {
						data: [],
						count: 0,
					},
				})
			}

			const menteeIds = extensionDetails.data.map((item) => item.user_id)
			if (menteeIds) {
				userServiceQueries['user_ids'] = menteeIds
			}

			const userDetails = await userRequests.search(userType, pageNo, pageSize, searchText, userServiceQueries)
			if (userDetails.data.result.count == 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MENTEE_LIST',
					result: {
						data: [],
						count: 0,
					},
				})
			}

			const userIds = userDetails.data.result.data.map((item) => item.id)
			extensionDetails = await menteeQueries.getUsersByUserIdsFromView(
				userIds,
				null,
				null,
				filteredQuery,
				saasFilter,
				additionalProjectionString,
				false
			)

			mentorExtensionDetails = await mentorQueries.getMentorsByUserIdsFromView(
				userIds,
				null,
				null,
				filteredQuery,
				saasFilter,
				additionalProjectionString,
				false
			)

			extensionDetails.data = [...extensionDetails.data, ...mentorExtensionDetails.data]
			extensionDetails.count += mentorExtensionDetails.count

			if (extensionDetails.data.length > 0) {
				const uniqueOrgIds = [...new Set(extensionDetails.data.map((obj) => obj.organization_id))]
				extensionDetails.data = await entityTypeService.processEntityTypesToAddValueLabels(
					extensionDetails.data,
					uniqueOrgIds,
					common.mentorExtensionModelName,
					'organization_id'
				)
			}
			const extensionDataMap = new Map(extensionDetails.data.map((newItem) => [newItem.user_id, newItem]))
			userDetails.data.result.data = userDetails.data.result.data
				.map((value) => {
					// Map over each value in the values array of the current group
					const user_id = value.id
					// Check if extensionDataMap has an entry with the key equal to the user_id
					if (extensionDataMap.has(user_id)) {
						const newItem = extensionDataMap.get(user_id)
						value = { ...value, ...newItem }
						delete value.user_id
						delete value.visibility
						delete value.organization_id
						delete value.meta
						delete value.rating
						return value
					}
					return null
				})
				.filter((value) => value !== null)

			if (queryParams.session_id) {
				const enrolledMentees = await getEnrolledMentees(queryParams.session_id, '', userId)

				userDetails.data.result.data.forEach((user) => {
					user.is_enrolled = false
					const enrolledUser = _.find(enrolledMentees, { id: user.id })
					if (enrolledUser) {
						user.is_enrolled = true
						user.enrolled_type = enrolledUser.type
					}
				})
			}

			// Check if sortBy have values before applying sorting
			if (sortBy) {
				userDetails.data.result.data = userDetails.data.result.data.sort((a, b) => {
					// Determine the sorting order based on the 'order' value
					const sortOrder = order.toLowerCase() === 'asc' ? 1 : order.toLowerCase() === 'desc' ? -1 : 1

					// Customize the sorting based on the provided sortBy field
					return sortOrder * a[sortBy].localeCompare(b[sortBy])
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: userDetails.data.message,
				result: userDetails.data.result,
			})
		} catch (error) {
			throw error
		}
	}
	static async filterMenteeListBasedOnSaasPolicy(userId, isAMentor, organization_ids = []) {
		try {
			let extensionColumns = isAMentor ? await mentorQueries.getColumns() : await menteeQueries.getColumns()
			// check for external_mentee_visibility else fetch external_mentor_visibility
			extensionColumns = extensionColumns.includes('external_mentee_visibility')
				? ['external_mentee_visibility', 'organization_id']
				: ['external_mentor_visibility', 'organization_id']

			const userPolicyDetails = isAMentor
				? await mentorQueries.getMentorExtension(userId, ['organization_id'])
				: await menteeQueries.getMenteeExtension(userId, ['organization_id'])

			const getOrgPolicy = await organisationExtensionQueries.findOne(
				{
					organization_id: userPolicyDetails.organization_id,
				},
				{
					attributes: ['session_visibility_policy', 'organization_id'],
				}
			)
			// Throw error if mentor/mentee extension not found
			if (!userPolicyDetails || Object.keys(userPolicyDetails).length === 0) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: isAMentor ? 'MENTORS_NOT_FOUND' : 'MENTEE_EXTENSION_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}

			let filter = ''
			// searching for specific organization
			let additionalFilter = ``
			if (organization_ids.length !== 0) {
				additionalFilter = `AND "organization_id" in (${organization_ids.join(',')})`
			}
			if (getOrgPolicy.session_visibility_policy && userPolicyDetails.organization_id) {
				const visibilityPolicy = getOrgPolicy.session_visibility_policy

				// Filter user data based on policy
				// generate filter based on condition
				if (visibilityPolicy === common.CURRENT) {
					/**
					 * if user external_mentor_visibility is current. He can only see his/her organizations mentors
					 * so we will check mentor's organization_id and user organization_id are matching
					 */
					filter = `AND "organization_id" = ${userPolicyDetails.organization_id}`
				} else if (visibilityPolicy === common.ASSOCIATED) {
					/**
					 * If user external_mentor_visibility is associated
					 * <<point**>> first we need to check if mentor's visible_to_organizations contain the user organization_id and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 */
					filter =
						additionalFilter +
						`AND ( (${userPolicyDetails.organization_id} = ANY("visible_to_organizations") AND "external_session_visibility" != 'CURRENT')`

					if (additionalFilter.length === 0)
						filter += ` OR organization_id = ${userPolicyDetails.organization_id} )`
					else filter += `)`
				} else if (visibilityPolicy === common.ALL) {
					/**
					 * We need to check if mentor's visible_to_organizations contain the user organization_id and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 * OR if mentor visibility is ALL that mentor is also accessible
					 */
					filter =
						additionalFilter +
						`AND ((${userPolicyDetails.organization_id} = ANY("visible_to_organizations") AND "external_session_visibility" != 'CURRENT' ) OR "external_session_visibility" = 'ALL' OR "organization_id" = ${userPolicyDetails.organization_id})`
				}
			}

			return filter
		} catch (err) {
			return err
		}
	}
}
function convertEntitiesForFilter(entityTypes) {
	const result = {}

	entityTypes.forEach((entityType) => {
		const key = entityType.value

		if (!result[key]) {
			result[key] = []
		}

		const newObj = {
			id: entityType.id,
			label: entityType.label,
			value: entityType.value,
			parent_id: entityType.parent_id,
			organization_id: entityType.organization_id,
			entities: entityType.entities || [],
		}

		result[key].push(newObj)
	})
	return result
}

function filterEntitiesBasedOnParent(data, defaultOrgId, doNotRemoveDefaultOrg) {
	let result = {}

	for (let key in data) {
		let countWithParentId = 0
		let countOfEachKey = data[key].length
		data[key].forEach((obj) => {
			if (obj.parent_id !== null && obj.organization_id != defaultOrgId) {
				countWithParentId++
			}
		})

		let outputArray = data[key]
		if (countOfEachKey > 1 && countWithParentId == countOfEachKey - 1 && !doNotRemoveDefaultOrg) {
			outputArray = data[key].filter((obj) => !(obj.organization_id === defaultOrgId && obj.parent_id === null))
		}

		result[key] = outputArray
	}
	return result
}
