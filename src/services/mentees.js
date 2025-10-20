// Dependencies
const userRequests = require('@requests/user')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const feedbackHelper = require('./feedback')
const utils = require('@generics/utils')
const { elevateLog } = require('elevate-logger')

const { UniqueConstraintError } = require('sequelize')
const menteeQueries = require('@database/queries/userExtension')
const sessionAttendeesQueries = require('@database/queries/sessionAttendees')
const sessionQueries = require('@database/queries/sessions')
const _ = require('lodash')
const entityTypeQueries = require('@database/queries/entityType')
const bigBlueButtonService = require('./bigBlueButton')
const organizationService = require('@services/organization')
const orgAdminService = require('@services/org-admin')
const mentorQueries = require('@database/queries/mentorExtension')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const entityTypeService = require('@services/entity-type')
const { getEnrolledMentees } = require('@helpers/getEnrolledMentees')
const responses = require('@helpers/responses')
const permissions = require('@helpers/getPermissions')
const { buildSearchFilter } = require('@helpers/search')
const { defaultRulesFilter, validateDefaultRulesFilter } = require('@helpers/defaultRules')

const defaultSearchConfig = require('@configs/search.json')
const emailEncryption = require('@utils/emailEncryption')
const cacheHelper = require('@generics/cacheHelper')
const communicationHelper = require('@helpers/communications')
const menteeExtensionQueries = require('@database/queries/userExtension')
const { checkIfUserIsAccessible } = require('@helpers/saasUserAccessibility')
const connectionQueries = require('@database/queries/connection')
const getOrgIdAndEntityTypes = require('@helpers/getOrgIdAndEntityTypewithEntitiesBasedOnPolicy')
const searchConfig = require('@root/config.json')

module.exports = class MenteesHelper {
	/**
	 * Profile.
	 * @method
	 * @name profile
	 * @param {String} userId - user id.
	 * @param {String} organizationId - organization id.
	 * @param {String} roles - user roles.
	 * @returns {JSON} - profile details
	 */
	static async read(id, organizationId, organizationCode, roles, tenantCode) {
		const menteeDetails = await userRequests.getUserDetails(id, tenantCode)
		const mentee = menteeDetails.data.result

		if (!mentee) {
			return responses.failureResponse({
				message: 'MENTEE_NOT_FOUND',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		delete mentee.user_id
		delete mentee.visible_to_organizations
		delete mentee.image

		const defaults = await getDefaults()
		if (!defaults.orgCode)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})

		if (!defaults.tenantCode)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		const userExtensionsModelName = await menteeQueries.getModelName()

		let entityTypes = await entityTypeService.readUserEntityTypesAndEntitiesCached(
			{
				status: 'ACTIVE',
				organization_code: {
					[Op.in]: [organizationCode, defaults.orgCode],
				},
				model_names: { [Op.contains]: [userExtensionsModelName] },
			},
			organizationCode,
			tenantCode
		)
		if (entityTypes instanceof Error) {
			throw entityTypes
		}
		const validationData = removeDefaultOrgEntityTypes(entityTypes, organizationCode)
		//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))

		const processDbResponse = utils.processDbResponse(mentee, validationData)

		const totalSession = await sessionAttendeesQueries.countEnrolledSessions(id, tenantCode)

		const menteePermissions = await permissions.getPermissions(roles)
		if (!Array.isArray(menteeDetails.data.result.permissions)) {
			menteeDetails.data.result.permissions = []
		}

		// Check if menteePermissions is an array (success) or response object (error)
		if (Array.isArray(menteePermissions)) {
			menteeDetails.data.result.permissions.push(...menteePermissions)
		} else {
			// It's the error response object, extract the permissions array
			menteeDetails.data.result.permissions.push(...(menteePermissions.result?.permissions || []))
		}

		const profileMandatoryFields = await utils.validateProfileData(processDbResponse, validationData)
		menteeDetails.data.result.profile_mandatory_fields = profileMandatoryFields

		let communications = null

		if (mentee?.meta?.communications_user_id) {
			try {
				const chat = await communicationHelper.login(id, tenantCode)
				communications = chat
			} catch (error) {
				console.error('Failed to log in to communication service:', error)
			}
		}

		processDbResponse.meta = {
			...processDbResponse.meta,
			communications,
		}

		if (!menteeDetails.data.result.organization) {
			const orgDetails = await organizationService.findOneCached(
				{ organization_code: organizationCode },
				tenantCode,
				{ attributes: ['name'] }
			)
			menteeDetails.data.result['organization'] = {
				id: organizationCode,
				name: orgDetails.name,
			}
		}
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

	static async sessions(userId, page, limit, search = '', organizationId, tenantCode) {
		try {
			/** Upcoming user's enrolled sessions {My sessions}*/
			/* Fetch sessions if it is not expired or if expired then either status is live or if mentor 
				delays in starting session then status will remain published for that particular interval so fetch that also */

			/* TODO: Need to write cron job that will change the status of expired sessions from published to cancelled if not hosted by mentor */
			const sessions = await this.getMySessions(page, limit, search, userId, null, null, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSION_FETCHED_SUCCESSFULLY',
				result: { data: sessions.rows, count: sessions.count },
				tenantCode: tenantCode,
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

	static async reports(userId, filterType, organizationId, tenantCode) {
		try {
			let filterStartDate, filterEndDate

			switch (filterType) {
				case 'MONTHLY':
					;[filterStartDate, filterEndDate] = utils.getCurrentMonthRange()
					break
				case 'WEEKLY':
					;[filterStartDate, filterEndDate] = utils.getCurrentWeekRange()
					break
				case 'QUARTERLY':
					;[filterStartDate, filterEndDate] = utils.getCurrentQuarterRange()
					break
				default:
					throw new Error('Invalid filterType')
			}

			const totalSessionsEnrolled = await sessionAttendeesQueries.getEnrolledSessionsCountInDateRange(
				filterStartDate.toISOString(),
				filterEndDate.toISOString(),
				userId,
				tenantCode
			)

			const totalSessionsAttended = await sessionAttendeesQueries.getAttendedSessionsCountInDateRange(
				filterStartDate.toISOString(),
				filterEndDate.toISOString(),
				userId,
				tenantCode
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

	static async homeFeed(
		userId,
		isAMentor,
		page,
		limit,
		search,
		queryParams,
		roles,
		organizationCode,
		start_date,
		end_date,
		tenantCode
	) {
		try {
			/* All Sessions */

			let result = {}

			let scope = ['all', 'my']
			if (queryParams.sessionScope) {
				scope = queryParams.sessionScope.split(',').map((s) => s.trim().toLowerCase())
				delete queryParams.sessionScope
			}
			let errors = []
			if (scope.includes('all')) {
				let allSessions = await this.getAllSessions(
					page,
					limit,
					search,
					userId,
					queryParams,
					isAMentor,
					'',
					roles,
					organizationCode,
					tenantCode
				)

				if (allSessions.error && allSessions.error.missingField) {
					errors.push({ scope: 'all', message: 'PROFILE_NOT_UPDATED' })
				} else {
					result.all_sessions = allSessions.rows
					result.allSessions_count = allSessions.count
				}
			}

			if (scope.includes('my')) {
				try {
					let mySessions = await this.getMySessions(
						page,
						limit,
						search,
						userId,
						start_date,
						end_date,
						tenantCode
					)
					result.my_sessions = mySessions.rows
					result.my_sessions_count = mySessions.count
				} catch (error) {
					// Handle error similarly to getAllSessions or add to errors array
					console.error('Error fetching my sessions:', error)
				}
			}

			const feedbackData = await feedbackHelper.pending(userId, isAMentor, organizationCode, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSION_FETCHED_SUCCESSFULLY',
				result: result,
				error: errors,
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

	static async joinSession(sessionId, userId, organizationCode, tenantCode) {
		try {
			const mentee = await menteeExtensionQueries.getMenteeExtension(
				userId,
				['name', 'user_id'],
				false,
				tenantCode
			)
			if (!mentee) throw createUnauthorizedResponse('USER_NOT_FOUND')

			// Optimized: Single query with JOIN to get session and attendee data together
			const sessionWithAttendee = await sessionQueries.findSessionWithAttendee(
				sessionId,
				mentee.user_id,
				tenantCode
			)

			if (!sessionWithAttendee) {
				return responses.failureResponse({
					message: 'SESSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const session = sessionWithAttendee
			const sessionAttendee = sessionWithAttendee.attendee_id
				? {
						id: sessionWithAttendee.attendee_id,
						type: sessionWithAttendee.enrolled_type,
						meeting_info: sessionWithAttendee.attendee_meeting_info,
						joined_at: sessionWithAttendee.joined_at,
						mentee_id: sessionWithAttendee.mentee_id,
				  }
				: null

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
						joined_at: utils.utcFormat(),
					},
					tenantCode
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
					mentee.name,
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
						joined_at: utils.utcFormat(),
					},
					tenantCode
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

	static async getAllSessions(
		page,
		limit,
		search,
		userId,
		queryParams,
		isAMentor,
		searchOn,
		roles,
		organizationCode,
		tenantCode
	) {
		let additionalProjectionString = ''

		// check for fields query
		if (queryParams.fields && queryParams.fields !== '') {
			additionalProjectionString = queryParams.fields
			delete queryParams.fields
		}
		let query = utils.processQueryParametersWithExclusions(queryParams)
		const sessionModelName = await sessionQueries.getModelName()

		const defaults = await getDefaults()

		if (!defaults.tenantCode)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})

		if (!defaults.orgCode)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})

		let validationData = await entityTypeService.readAllEntityTypesAndEntitiesCached(
			{
				status: 'ACTIVE',
				allow_filtering: true,
				organization_code: {
					[Op.in]: [organizationCode, defaults.orgCode],
				},
				model_names: { [Op.contains]: [sessionModelName] },
			},
			organizationCode,
			tenantCode
		)
		let filteredQuery = utils.validateAndBuildFilters(query, validationData, sessionModelName)

		// Create saas filter for view query
		const saasFilter = await this.filterSessionsBasedOnSaasPolicy(userId, isAMentor, tenantCode)

		let search_config = defaultSearchConfig
		if (searchConfig.search) {
			search_config = { search: searchConfig.search }
		}
		const searchFilter = await buildSearchFilter({
			searchOn: searchOn ? searchOn.split(',') : false,
			searchConfig: search_config.search.session,
			search,
			modelName: sessionModelName,
			tenantCode: tenantCode,
		})
		// return false response when buildSearchFilter() returns negative response
		// buildSearchFilter() false when search on only contains entity type and no valid matches.
		if (!searchFilter) {
			return {
				rows: [],
				count: 0,
			}
		}

		if (!organizationCode) {
			return responses.failureResponse({
				message: 'ORGANIZATION_CODE_REQUIRED',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		const defaultRuleFilter = await defaultRulesFilter({
			ruleType: 'session',
			requesterId: userId,
			roles: roles,
			requesterOrganizationCode: organizationCode,
			tenantCode: { [Op.in]: [tenantCode, defaults.tenantCode] },
		})

		if (defaultRuleFilter.error && defaultRuleFilter.error.missingField) {
			return defaultRuleFilter
		}

		// Create cache key for public sessions with ALL parameters that affect results
		const cacheKey = this._buildPublicSessionsCacheKey({
			page,
			limit,
			searchFilter,
			userId,
			filteredQuery,
			saasFilter,
			additionalProjectionString,
			search,
			defaultRuleFilter,
			organizationCode,
			tenantCode,
			roles: roles.join(','), // Include user roles as they affect visibility
		})

		let sessions
		try {
			sessions = await cacheHelper.getOrSet({
				tenantCode,
				orgCode: organizationCode,
				ns: 'upcoming-public-sessions',
				id: cacheKey,
				fetchFn: async () => {
					return await sessionQueries.getUpcomingSessionsFromView(
						page,
						limit,
						searchFilter,
						userId,
						filteredQuery,
						tenantCode,
						saasFilter,
						additionalProjectionString,
						search,
						defaultRuleFilter
					)
				},
			})
		} catch (cacheError) {
			console.warn('Cache system failed for public sessions, falling back to database:', cacheError.message)
			sessions = await sessionQueries.getUpcomingSessionsFromView(
				page,
				limit,
				searchFilter,
				userId,
				filteredQuery,
				tenantCode,
				saasFilter,
				additionalProjectionString,
				search,
				defaultRuleFilter
			)
		}
		if (sessions && sessions.rows && Array.isArray(sessions.rows) && sessions.rows.length > 0) {
			const uniqueOrgIds = [...new Set(sessions.rows.map((obj) => obj?.mentor_organization_id).filter(Boolean))]
			sessions.rows = await entityTypeService.processEntityTypesToAddValueLabels(
				sessions.rows,
				uniqueOrgIds,
				common.sessionModelName,
				'mentor_organization_id',
				[],
				[tenantCode]
			)
		}

		const sessionRows = sessions.rows || sessions
		const processedMenteeDetails = await this.menteeSessionDetails(sessionRows, userId, tenantCode)
		const processedMentorDetails = await this.sessionMentorDetails(processedMenteeDetails, tenantCode)

		if (sessions.rows !== undefined) {
			sessions.rows = processedMentorDetails
		} else {
			sessions = { rows: processedMentorDetails, count: processedMentorDetails.length }
		}

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
	static async filterSessionsBasedOnSaasPolicy(userId, isAMentor, tenantCode) {
		try {
			const menteeExtension = await menteeQueries.getMenteeExtension(
				userId,
				['external_session_visibility', 'organization_id', 'is_mentor'],
				false,
				tenantCode
			)

			if (!menteeExtension) {
				throw responses.failureResponse({
					statusCode: httpStatusCode.unauthorized,
					message: 'USER_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}
			const organizationName = menteeExtension
				? (await userRequests.getOrgDetails({ organizationId: menteeExtension.organization_id, tenantCode }))
						?.data?.result?.name
				: ''
			if (!isAMentor && menteeExtension.is_mentor == true) {
				throw responses.failureResponse({
					statusCode: httpStatusCode.unauthorized,
					message: `Congratulations! You are now a mentor in the ${organizationName} organization. Please log in again to begin your journey.`,
					responseCode: 'CLIENT_ERROR',
				})
			} else if (isAMentor && menteeExtension.is_mentor == false) {
				throw responses.failureResponse({
					statusCode: httpStatusCode.unauthorized,
					message: `You are now a mentee in the ${organizationName} organization. Please log in again to continue your journey.`,
					responseCode: 'CLIENT_ERROR',
				})
			}

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
					filter = `AND "mentor_organization_id" = '${userPolicyDetails.organization_id}'`
				} else if (userPolicyDetails.external_session_visibility === common.ASSOCIATED) {
					/**
					 * user external_session_visibility is ASSOCIATED
					 * user can see sessions where session's visible_to_organizations contain user's organization_id and -
					 *  - session's visibility not CURRENT (In case of same organization session has to be fetched for that we added OR condition {"mentor_organization_id" = ${userPolicyDetails.organization_id}})
					 */
					filter = `AND (('${userPolicyDetails.organization_id}' = ANY("visible_to_organizations") AND "visibility" != 'CURRENT') OR "mentor_organization_id" = '${userPolicyDetails.organization_id}')`
				} else if (userPolicyDetails.external_session_visibility === common.ALL) {
					/**
					 * user's external_session_visibility === ALL (ASSOCIATED sessions + sessions whose visibility is ALL)
					 */
					filter = `AND (('${userPolicyDetails.organization_id}' = ANY("visible_to_organizations") AND "visibility" != 'CURRENT' ) OR "visibility" = 'ALL' OR "mentor_organization_id" = '${userPolicyDetails.organization_id}')`
				}
			}
			return filter
		} catch (err) {
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

	static async getMySessions(page, limit, search, userId, startDate, endDate, tenantCode) {
		try {
			const upcomingSessions = await sessionQueries.getUpcomingSessions(
				page,
				limit,
				search,
				userId,
				startDate,
				endDate,
				tenantCode
			)
			const upcomingSessionIds =
				upcomingSessions && upcomingSessions.rows && Array.isArray(upcomingSessions.rows)
					? upcomingSessions.rows.map((session) => session.id).filter((id) => id != null)
					: []

			if (upcomingSessionIds.length === 0) {
				return { rows: [], count: 0 }
			}

			const usersUpcomingSessions = await sessionAttendeesQueries.usersUpcomingSessions(
				userId,
				upcomingSessionIds,
				tenantCode
			)

			let sessionAndMenteeMap = {}
			usersUpcomingSessions.forEach((session) => {
				sessionAndMenteeMap[session.session_id] = session.type
			})

			const usersUpcomingSessionIds = usersUpcomingSessions.map(
				(usersUpcomingSession) => usersUpcomingSession.session_id
			)

			const attributes = { exclude: ['mentee_password', 'mentor_password'] }
			let sessionDetails
			const cacheId = `sessions:${JSON.stringify(usersUpcomingSessionIds)}`
			try {
				sessionDetails = await cacheHelper.getOrSet({
					tenantCode,
					orgId: 'unknown',
					ns: common.CACHE_CONFIG.namespaces.sessions.name,
					id: cacheId,
					fetchFn: async () => {
						return await sessionQueries.findAndCountAll(
							{ id: usersUpcomingSessionIds },
							tenantCode,
							{ order: [['start_date', 'ASC']] },
							{ attributes: attributes }
						)
					},
				})
			} catch (cacheError) {
				console.warn('Cache system failed for session details, falling back to database:', cacheError.message)
				sessionDetails = await sessionQueries.findAndCountAll(
					{ id: usersUpcomingSessionIds },
					tenantCode,
					{ order: [['start_date', 'ASC']] },
					{ attributes: attributes }
				)
			}
			if (
				sessionDetails &&
				sessionDetails.rows &&
				Array.isArray(sessionDetails.rows) &&
				sessionDetails.rows.length > 0
			) {
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
					'mentor_organization_id',
					[],
					[tenantCode]
				)
			}
			if (sessionDetails && sessionDetails.rows) {
				sessionDetails.rows = await this.sessionMentorDetails(sessionDetails.rows, tenantCode)
				return sessionDetails
			} else {
				return { rows: [], count: 0 }
			}
		} catch (error) {
			throw error
		}
	}

	static async menteeSessionDetails(sessions, userId, tenantCode) {
		try {
			// Handle error objects or non-array data
			if (!Array.isArray(sessions)) {
				return sessions || []
			}

			if (sessions.length > 0) {
				const sessionIds = sessions.map((session) => session.id).filter((id) => id != null)

				if (sessionIds.length === 0) {
					return sessions
				}

				const attendees = await sessionAttendeesQueries.findAll(
					{
						session_id: sessionIds,
						mentee_id: userId,
					},
					tenantCode
				)

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

	static async sessionMentorDetails(sessions, tenantCode) {
		try {
			if (!sessions || sessions.length === 0) {
				return sessions || []
			}

			// Handle error objects or non-array data
			if (!Array.isArray(sessions)) {
				return sessions || []
			}

			// Extract unique mentor_ids
			const mentorIds = [...new Set(sessions.map((session) => session.mentor_id))]

			// Fetch mentor details
			const mentorDetails = await menteeQueries.getUsersByUserIds(
				mentorIds,
				{
					attributes: ['name', 'user_id', 'organization_id'],
				},
				tenantCode,
				true
			)

			// ✅ FIX 1: Add null check and filter out null organization_ids
			if (!mentorDetails || mentorDetails.length === 0) {
				return sessions // Return sessions without mentor details if no mentors found
			}

			let organizationIds = []
			mentorDetails.forEach((element) => {
				// ✅ FIX 2: Only push valid organization_ids
				if (element && element.organization_id) {
					organizationIds.push(element.organization_id)
				}
			})

			// ✅ FIX 3: Only fetch organizations if we have valid IDs
			let organizationDetails = []
			if (organizationIds.length > 0) {
				organizationDetails = await organizationService.findAllCached(
					{
						organization_id: {
							[Op.in]: [...organizationIds],
						},
					},
					tenantCode,
					{
						attributes: ['name', 'organization_id'],
					}
				)
			}

			// Map mentor names to sessions
			sessions.forEach((session) => {
				const mentor = mentorDetails.find((mentorDetail) => mentorDetail.user_id === session.mentor_id)
				if (mentor) {
					const organization = organizationDetails.find(
						(organizationDetail) => organizationDetail.organization_id === mentor.organization_id
					)
					session.mentor_name = mentor.name
					// ✅ FIX 4: Add null check for organization
					session.organization = organization ? organization.name : null
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
	// Functions for new APIs
	/**
	 * Create a new mentee extension.
	 * @method
	 * @name createMenteeExtension
	 * @param {Object} data - Mentee extension data to be created.
	 * @param {String} userId - User ID of the mentee.
	 * @returns {Promise<Object>} - Created mentee extension details.
	 */
	static async createMenteeExtension(data, userId, organizationCode, tenantCode, organizationId) {
		try {
			let skipValidation = data.skipValidation ? data.skipValidation : false
			if (data.email) {
				data.email = emailEncryption.encrypt(data.email.toLowerCase())
			}
			// Call user service to fetch organisation details --SAAS related changes
			let userOrgDetails = await userRequests.fetchOrgDetails({ organizationCode, tenantCode })

			// Return error if user org does not exists
			if (!userOrgDetails.success || !userOrgDetails.data || !userOrgDetails.data.result) {
				return responses.failureResponse({
					message: 'ORGANISATION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const organization_name = userOrgDetails.data.result.name

			// Find organisation policy from organisation_extension table
			let organisationPolicy = await organizationService.findOrInsertOrganizationExtensionCached(
				organizationId,
				organizationCode,
				organization_name,
				tenantCode
			)

			data.user_id = userId
			data.organization_code = organizationCode

			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const userExtensionsModelName = await menteeQueries.getModelName()

			let entityTypes = await entityTypeService.readUserEntityTypesAndEntitiesCached(
				{
					status: 'ACTIVE',
					organization_code: {
						[Op.in]: [organizationCode, defaults.orgCode],
					},
					model_names: { [Op.contains]: [userExtensionsModelName] },
				},
				organizationCode,
				tenantCode
			)
			if (entityTypes instanceof Error) {
				throw entityTypes
			}

			//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = removeDefaultOrgEntityTypes(entityTypes, organizationCode)

			let res = utils.validateInput(data, validationData, userExtensionsModelName, skipValidation)
			if (!res.success) {
				return responses.failureResponse({
					message: 'MENTEE_EXTENSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}
			let menteeExtensionsModel = await menteeQueries.getColumns()
			data = utils.restructureBody(data, validationData, menteeExtensionsModel)

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

			const response = await menteeQueries.createMenteeExtension(data, tenantCode)
			const processDbResponse = utils.processDbResponse(response.toJSON(), validationData)

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
	 * @param {Object} data - Updated mentee extension data excluding user_id.
	 * @param {String} userId - User ID of the mentee.
	 * @param {String} organizationId - Organization ID for validation.
	 * @returns {Promise<Object>} - Updated mentee extension details.
	 */
	static async updateMenteeExtension(data, userId, organizationCode, tenantCode) {
		try {
			// Encrypt email if provided
			if (data.email) data.email = emailEncryption.encrypt(data.email.toLowerCase())

			let skipValidation = data.skipValidation || false

			// Remove unnecessary data keys
			const dataToRemove = [
				'user_id',
				'mentor_visibility',
				'visible_to_organizations',
				'external_session_visibility',
				'external_mentor_visibility',
				'external_mentee_visibility',
				'mentee_visibility',
			]
			dataToRemove.forEach((key) => delete data[key])

			// Fetch current mentee extension data
			const currentUser = await menteeQueries.getMenteeExtension(userId, [], false, tenantCode)
			if (!currentUser) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTEE_EXTENSION_NOT_FOUND',
				})
			}

			// Perform validation

			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const userExtensionsModelName = await menteeQueries.getModelName()
			const filter = {
				status: 'ACTIVE',
				organization_code: { [Op.in]: [organizationCode, defaults.orgCode] },
				model_names: { [Op.contains]: [userExtensionsModelName] },
			}
			let entityTypes = await entityTypeService.readUserEntityTypesAndEntitiesCached(
				filter,
				organizationCode,
				tenantCode
			)
			if (entityTypes instanceof Error) {
				throw entityTypes
			}

			const validationData = removeDefaultOrgEntityTypes(entityTypes, organizationCode)
			let res = utils.validateInput(data, validationData, userExtensionsModelName, skipValidation)
			if (!res.success) {
				return responses.failureResponse({
					message: 'PROFILE_UPDATE_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}

			// Restructure the data
			let userExtensionModel = await menteeQueries.getColumns()
			data = utils.restructureBody(data, validationData, userExtensionModel)

			// Handle organization update logic if organization data is provided
			if (data?.organization?.id) {
				//Do a org policy update for the user only if the data object explicitly includes an
				//organization.id. This is added for the users/update workflow where
				//both both user data and organisation can change at the same time.
				let userOrgDetails = await userRequests.fetchOrgDetails({
					organizationCode: organizationCode,
					tenantCode,
				})
				const orgPolicies = await organizationService.findOrInsertOrganizationExtensionCached(
					data.organization_id,
					organizationCode,
					userOrgDetails.data.result.name,
					tenantCode
				)
				if (!orgPolicies?.organization_id) {
					return responses.failureResponse({
						message: 'ORG_EXTENSION_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				data.organization_id = data.organizationid
				const newPolicy = await orgAdminService.constructOrgPolicyObject(orgPolicies, true)
				data = _.merge({}, data, newPolicy)
				data.visible_to_organizations = Array.from(
					new Set([...userOrgDetails.data.result.related_orgs, data.organization.id])
				)
			}

			// Update the database
			const [updateCount, updatedUser] = await menteeQueries.updateMenteeExtension(
				userId,
				data,
				{
					returning: true,
					raw: true,
				},
				{},
				tenantCode
			)

			if (currentUser?.meta?.communications_user_id) {
				const promises = []
				if (data.name && data.name !== currentUser.name) {
					promises.push(communicationHelper.updateUser(userId, data.name, tenantCode))
				}

				if (data.image && data.image !== currentUser.image) {
					const downloadableUrl = (await userRequests.getDownloadableUrl(data.image))?.result
					promises.push(communicationHelper.updateAvatar(userId, downloadableUrl, tenantCode))
				}

				await Promise.all(promises)
			}

			if (updateCount === 0) {
				const fallbackUpdatedUser = await menteeQueries.getMenteeExtension(userId, [], false, tenantCode)
				if (!fallbackUpdatedUser) {
					return responses.failureResponse({
						statusCode: httpStatusCode.not_found,
						message: 'MENTEE_EXTENSION_NOT_FOUND',
					})
				}
				const processDbResponse = utils.processDbResponse(fallbackUpdatedUser, validationData)

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MENTEE_EXTENSION_UPDATED',
					result: processDbResponse,
				})
			}

			// Return updated data
			const processDbResponse = utils.processDbResponse(updatedUser[0], validationData)
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
	static async getMenteeExtension(userId, organizationId, tenantCode) {
		try {
			const mentee = await menteeQueries.getMenteeExtension(userId, [], false, tenantCode)
			if (!mentee) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTEE_EXTENSION_NOT_FOUND',
				})
			}

			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const userExtensionsModelName = await menteeQueries.getModelName()
			const filter = {
				status: 'ACTIVE',
				organization_code: { [Op.in]: [organizationCode, defaults.orgCode] },
				model_names: { [Op.contains]: [userExtensionsModelName] },
			}

			let entityTypes = await entityTypeService.readUserEntityTypesAndEntitiesCached(
				filter,
				organizationCode,
				tenantCode
			)

			//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = removeDefaultOrgEntityTypes(entityTypes, organizationId)
			const processDbResponse = utils.processDbResponse(mentee, validationData)

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
	 * Get mentee extension details by user ID with caching.
	 * @method
	 * @name getMenteeExtensionCached
	 * @param {String} userId - User ID of the mentee.
	 * @param {Array} attributes - Attributes to select (default: []).
	 * @param {Boolean} unScoped - Whether to use unscoped query (default: false).
	 * @param {String} tenantCode - Tenant code for isolation.
	 * @returns {Promise<Object>} - Cached mentee extension details.
	 */
	static async getMenteeExtensionCached(userId, attributes = [], unScoped = false, tenantCode) {
		try {
			// Create cache key based on query parameters
			const cacheKey = `mentee:${userId}:${attributes.sort().join(',')}:${unScoped}`

			return await cacheHelper.getOrSet({
				tenantCode,
				ns: 'user-extension',
				id: cacheKey,
				ttl: 300, // 5 minutes
				fetchFn: async () => {
					return await menteeQueries.getMenteeExtension(userId, attributes, unScoped, tenantCode)
				},
			})
		} catch (cacheError) {
			console.warn('Cache system failed for mentee extension, falling back to database:', cacheError.message)
			return await menteeQueries.getMenteeExtension(userId, attributes, unScoped, tenantCode)
		}
	}

	/**
	 * Delete a mentee extension by user ID.
	 * @method
	 * @name deleteMenteeExtension
	 * @param {String} userId - User ID of the mentee.
	 * @returns {Promise<Object>} - Indicates if the mentee extension was deleted successfully.
	 */
	static async deleteMenteeExtension(userId, tenantCode) {
		try {
			const deleteCount = await menteeQueries.deleteMenteeExtension(userId, tenantCode)
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
	 * Get users by user IDs with caching for bulk operations.
	 * @method
	 * @name getUsersByUserIdsCached
	 * @param {Array} ids - Array of user IDs.
	 * @param {Object} options - Query options (default: {}).
	 * @param {String} tenantCode - Tenant code for isolation.
	 * @param {Boolean} unscoped - Whether to use unscoped query (default: false).
	 * @returns {Promise<Array>} - Cached users data.
	 */
	static async getUsersByUserIdsCached(ids, options = {}, tenantCode, unscoped = false) {
		if (ids.length === 0) return []

		try {
			// Try to get cached individual users first
			const cachedResults = []
			const missingIds = []

			// Check cache for each user individually
			for (const id of ids) {
				const cacheKey = `mentee:${id}::${unscoped}`
				try {
					const cached = await cacheHelper.get(
						await cacheHelper.buildKey({ tenantCode, ns: 'user-extension', id: cacheKey })
					)
					if (cached) {
						cachedResults.push(cached)
					} else {
						missingIds.push(id)
					}
				} catch (cacheErr) {
					// If individual cache lookup fails, add to missing list
					missingIds.push(id)
				}
			}

			// Fetch missing users from database
			let dbResults = []
			if (missingIds.length > 0) {
				dbResults = await menteeQueries.getUsersByUserIds(missingIds, options, tenantCode, unscoped)

				// Cache individual results for future lookups
				for (const user of dbResults) {
					const cacheKey = `mentee:${user.user_id}::${unscoped}`
					try {
						await cacheHelper.setScoped({
							tenantCode,
							ns: 'user-extension',
							id: cacheKey,
							value: user,
							ttl: 300,
						})
					} catch (cacheErr) {
						console.warn('Failed to cache individual user:', cacheErr.message)
					}
				}
			}

			return [...cachedResults, ...dbResults]
		} catch (cacheError) {
			console.warn('Cache system failed for bulk users, falling back to database:', cacheError.message)
			return await menteeQueries.getUsersByUserIds(ids, options, tenantCode, unscoped)
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
	static async getFilterList(organization, entity_type, filterType, tokenInformation, tenantCode) {
		try {
			let result = {
				organizations: [],
				entity_types: {},
			}

			const filter_type = filterType !== '' ? filterType : common.MENTOR_ROLE

			let organization_codes = []
			let tenantCodes = []
			const organizations = await getOrgIdAndEntityTypes.getOrganizationIdBasedOnPolicy(
				tokenInformation.id,
				tokenInformation.organization_code,
				filter_type,
				tenantCode
			)

			const defaults = await getDefaults()

			if (organizations.success && organizations.result.organizationCodes?.length > 0) {
				organization_codes = organizations.result.organizationCodes
				tenantCodes = organizations.result.tenantCodes

				let orgCodesWithoutDefaultOrg = organization_codes
				if (organization_codes.length > 1) {
					orgCodesWithoutDefaultOrg = organization_codes.filter((orgCode) => orgCode != defaults.orgCode)
				}

				const organizationList = await userRequests.organizationList(orgCodesWithoutDefaultOrg, tenantCodes)
				if (organizationList.success && organizationList.data?.result?.length > 0) {
					result.organizations = organizationList.data.result
				}

				const modelName = []

				const queryMap = {
					[common.MENTEE_ROLE]: menteeQueries.getModelName,
					[common.MENTOR_ROLE]: mentorQueries.getModelName,
					[common.SESSION]: sessionQueries.getModelName,
				}

				if (queryMap[filter_type.toLowerCase()]) {
					const modelNameResult = await queryMap[filter_type.toLowerCase()]()
					modelName.push(modelNameResult)
				}
				// get entity type with entities list
				const getEntityTypesWithEntities = await getOrgIdAndEntityTypes.getEntityTypeWithEntitiesBasedOnOrg(
					organization_codes,
					entity_type,
					defaults.orgCode ? defaults.orgCode : '',
					modelName,
					{},
					tenantCodes,
					defaults.tenantCode ? defaults.tenantCode : ''
				)
				if (getEntityTypesWithEntities.success && getEntityTypesWithEntities.result) {
					let entityTypesWithEntities = getEntityTypesWithEntities.result
					if (entityTypesWithEntities.length > 0) {
						let convertedData = utils.convertEntitiesForFilter(entityTypesWithEntities)
						let doNotRemoveDefaultOrg = false
						if (organization_codes.includes(defaults.orgCode)) {
							doNotRemoveDefaultOrg = true
						}
						result.entity_types = utils.filterEntitiesBasedOnParent(
							convertedData,
							defaults.orgCode,
							doNotRemoveDefaultOrg
						)
					}
				}
			}

			if (organization.toLowerCase() === common.FALSE) {
				delete result.organizations
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
	static async list(pageNo, pageSize, searchText, queryParams, userId, isAMentor, organizationCode, tenantCode) {
		try {
			let additionalProjectionString = ''

			// check for fields query
			if (queryParams.fields && queryParams.fields !== '') {
				additionalProjectionString = queryParams.fields
				delete queryParams.fields
			}
			let organization_ids = []

			const [sortBy, order] = ['name'].includes(queryParams.sort_by)
				? [queryParams.sort_by, queryParams.order || 'ASC']
				: [false, 'ASC']

			if (queryParams.hasOwnProperty('organization_ids')) {
				organization_ids = queryParams['organization_ids'].split(',')
			}

			const query = utils.processQueryParametersWithExclusions(queryParams)
			const userExtensionModelName = await menteeQueries.getModelName()

			let connectedMenteeIds = []
			let connectedMenteesCount
			if (queryParams.connected_mentees === 'true') {
				const connectedQueryParams = { ...queryParams }
				delete connectedQueryParams.connected_mentees
				const connectedQuery = utils.processQueryParametersWithExclusions(connectedQueryParams)

				const connectionDetails = await connectionQueries.getConnectionsDetails(
					pageNo,
					pageSize,
					connectedQuery,
					searchText,
					queryParams.mentorId ? queryParams.mentorId : userId,
					organization_ids,
					[], // roles can be passed if needed
					tenantCode
				)

				if (connectionDetails?.data?.length > 0) {
					pageNo = null
					pageSize = null
					connectedMenteeIds = connectionDetails.data.map((item) => item.user_id)
					// if (!connectedMenteeIds.includes(userId)) {
					// 	connectedMenteeIds.push(userId)
					// }
				}
				if (typeof connectionDetails?.count === 'number') {
					connectedMenteesCount = connectionDetails.count
				}

				// If there are no connected mentees, short-circuit and return empty
				if (connectedMenteeIds.length === 0) {
					return responses.successResponse({
						statusCode: httpStatusCode.ok,
						message: 'MENTEE_LIST',
						result: {
							data: [],
							count: 0,
						},
					})
				}
			}

			let validationData = await entityTypeService.readAllEntityTypesAndEntitiesCached(
				{
					status: common.ACTIVE_STATUS,
					model_names: { [Op.overlap]: [userExtensionModelName] },
				},
				organizationCode,
				tenantCode
			)

			let filteredQuery = utils.validateAndBuildFilters(
				query,
				JSON.parse(JSON.stringify(validationData)),
				userExtensionModelName
			)

			const emailIds = []
			const searchTextArray = searchText ? searchText.split(',') : []

			searchTextArray.forEach((element) => {
				if (utils.isValidEmail(element)) {
					emailIds.push(emailEncryption.encrypt(element.toLowerCase()))
				}
			})
			const hasValidEmails = emailIds.length > 0

			const saasFilter = await this.filterMenteeListBasedOnSaasPolicy(
				userId,
				isAMentor,
				organization_ids,
				tenantCode
			)
			let extensionDetails = await menteeQueries.getAllUsers(
				connectedMenteeIds ? connectedMenteeIds : [],
				pageNo,
				pageSize,
				filteredQuery,
				saasFilter,
				additionalProjectionString,
				false,
				hasValidEmails ? emailIds : searchText,
				'', // defaultFilter
				tenantCode
			)

			if (extensionDetails?.data.length == 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MENTEE_LIST',
					result: extensionDetails,
				})
			}

			const organizationIds = [...new Set(extensionDetails.data.map((user) => user.organization_id))]

			// Step 2: Query organization table (only if there are IDs to query)
			let organizationDetails = []
			if (organizationIds.length > 0) {
				const orgFilter = {
					organization_id: {
						[Op.in]: organizationIds,
					},
				}
				organizationDetails = await organizationService.findAllCached(orgFilter, tenantCode, {
					attributes: ['name', 'organization_id'],
					raw: true,
				})
			}

			// Step 3: Create a map of organization_id to organization details
			const orgMap = {}
			organizationDetails.forEach((org) => {
				orgMap[org.organization_id] = {
					id: org.organization_id,
					name: org.name,
				}
			})

			//Attach organization details and decrypt email for each user
			extensionDetails.data = await Promise.all(
				extensionDetails.data.map(async (user) => {
					let decryptedEmail = null
					// Safely decrypt email with error handling
					if (user.email) {
						try {
							decryptedEmail = await emailEncryption.decrypt(user.email)
						} catch (decryptError) {
							// Keep original email or set to null if decryption fails
							decryptedEmail = null
						}
					}

					let imageUrl = null
					// Safely get downloadable URL for image with error handling
					if (user.image) {
						try {
							imageUrl = (await utils.getDownloadableUrl(user.image)) ?? null
						} catch (error) {
							console.error(`Failed to get downloadable URL for user ${user.user_id}:`, error)
							imageUrl = null
						}
					}

					return {
						...user,
						id: user.user_id, // Add 'id' key, to be removed later
						email: decryptedEmail,
						organization: orgMap[user.organization_id] || null,
						image: imageUrl,
					}
				})
			)

			// Step 5: Process entity types (reuse organizationIds) with error handling
			if (extensionDetails.data.length > 0) {
				try {
					const processedData = await entityTypeService.processEntityTypesToAddValueLabels(
						extensionDetails.data,
						organizationIds,
						userExtensionModelName,
						'organization_id',
						[],
						[tenantCode] // Pass tenantCode to the entity processing service
					)
					if (Array.isArray(processedData)) {
						extensionDetails.data = processedData
					} else {
						// Keep original data if processing fails
					}
				} catch (entityError) {
					// Keep original data if processing fails
				}
			}

			// Step 6: Handle session enrollment
			if (queryParams.session_id) {
				const enrolledMentees = await getEnrolledMentees(queryParams.session_id, '', userId, tenantCode)
				extensionDetails.data.forEach((user) => {
					user.is_enrolled = false
					const enrolledUser = _.find(enrolledMentees, { id: user.id })
					if (enrolledUser) {
						user.is_enrolled = true
						user.enrolled_type = enrolledUser.type
					}
				})
			}

			// Step 7: Apply sorting if sortBy is provided
			if (sortBy) {
				extensionDetails.data = extensionDetails.data.sort((a, b) => {
					const sortOrder = order.toLowerCase() === 'asc' ? 1 : order.toLowerCase() === 'desc' ? -1 : 1
					return sortOrder * a[sortBy].localeCompare(b[sortBy])
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTEE_LIST',
				result: {
					data: extensionDetails.data,
					count: queryParams.connected_mentees === 'true' ? connectedMenteesCount : extensionDetails.count,
				},
			})
		} catch (error) {
			throw error
		}
	}
	static async filterMenteeListBasedOnSaasPolicy(userId, isAMentor, organization_ids = [], tenantCode) {
		try {
			// let extensionColumns = isAMentor ? await mentorQueries.getColumns() : await menteeQueries.getColumns()
			// // check for external_mentee_visibility else fetch external_mentor_visibility
			// extensionColumns = extensionColumns.includes('external_mentee_visibility')
			// 	? ['external_mentee_visibility', 'organization_id']
			// 	: ['external_mentor_visibility', 'organization_id']

			let userPolicyDetails
			if (isAMentor) {
				try {
					userPolicyDetails = await cacheHelper.getOrSet({
						tenantCode,
						orgId: 'unknown',
						ns: common.CACHE_CONFIG.namespaces.mentor_profile.name,
						id: `mentor:${userId}:org_id`,
						fetchFn: async () => {
							return await mentorQueries.getMentorExtension(
								userId,
								['organization_id'],
								false,
								tenantCode
							)
						},
					})
				} catch (cacheError) {
					console.warn(
						'Cache system failed for mentor policy details, falling back to database:',
						cacheError.message
					)
					userPolicyDetails = await mentorQueries.getMentorExtension(
						userId,
						['organization_id'],
						false,
						tenantCode
					)
				}
			} else {
				userPolicyDetails = await menteeQueries.getMenteeExtension(
					userId,
					['organization_id'],
					false,
					tenantCode
				)
			}

			const getOrgPolicy = await organizationService.findOneCached(
				{
					organization_id: userPolicyDetails.organization_id,
				},
				tenantCode,
				{
					attributes: ['external_mentee_visibility_policy', 'organization_id'],
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
				additionalFilter = `AND "organization_id" in (${organization_ids.map((id) => `'${id}'`).join(',')}) `
			}
			if (getOrgPolicy.external_mentee_visibility_policy && userPolicyDetails.organization_id) {
				const visibilityPolicy = getOrgPolicy.external_mentee_visibility_policy

				// Filter user data based on policy
				// generate filter based on condition
				if (visibilityPolicy === common.CURRENT) {
					/**
					 * if user external_mentor_visibility is current. He can only see his/her organizations mentors
					 * so we will check mentor's organization_id and user organization_id are matching
					 */
					filter = `AND "organization_id" = '${userPolicyDetails.organization_id}'`
				} else if (visibilityPolicy === common.ASSOCIATED) {
					/**
					 * If user external_mentor_visibility is associated
					 * <<point**>> first we need to check if mentor's visible_to_organizations contain the user organization_id and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 */
					filter =
						additionalFilter +
						`AND ( (:userOrgId = ANY("visible_to_organizations") AND "mentee_visibility" != 'CURRENT')`

					if (additionalFilter.length === 0) filter += ` OR organization_id = :userOrgId )`
					else filter += `)`
				} else if (visibilityPolicy === common.ALL) {
					/**
					 * We need to check if mentor's visible_to_organizations contain the user organization_id and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 * OR if mentor visibility is ALL that mentor is also accessible
					 */
					filter =
						additionalFilter +
						`AND (('${userPolicyDetails.organization_id}' = ANY("visible_to_organizations") AND "mentee_visibility" != 'CURRENT' ) OR "mentee_visibility" = 'ALL' OR "organization_id" = '${userPolicyDetails.organization_id}')`
				}
			}

			return filter
		} catch (err) {
			return err
		}
	}

	/**
	 * @description 							- check if mentee is accessible based on user's saas policy.
	 * @method
	 * @name checkIfMenteeIsAccessible
	 * @param {Number} userId 					- User id.
	 * @param {Array} userData					- User data
	 * @param {Boolean} isAMentor 				- user mentor or not.
	 * @returns {Boolean} 						- user Accessible
	 */

	static async checkIfMenteeIsAccessible(userData, userId, isAMentor, tenantCode) {
		try {
			// user can be mentor or mentee, based on isAMentor key get policy details
			let userPolicyDetails
			if (isAMentor) {
				try {
					userPolicyDetails = await cacheHelper.getOrSet({
						tenantCode,
						orgId: 'unknown',
						ns: common.CACHE_CONFIG.namespaces.mentor_profile.name,
						id: `mentor:${userId}:ext_mentee_vis_org`,
						fetchFn: async () => {
							return await mentorQueries.getMentorExtension(
								userId,
								['external_mentee_visibility', 'organization_id'],
								false,
								tenantCode
							)
						},
					})
				} catch (cacheError) {
					console.warn(
						'Cache system failed for mentor policy details, falling back to database:',
						cacheError.message
					)
					userPolicyDetails = await mentorQueries.getMentorExtension(
						userId,
						['external_mentee_visibility', 'organization_id'],
						false,
						tenantCode
					)
				}
			} else {
				userPolicyDetails = await menteeQueries.getMenteeExtension(
					userId,
					['external_mentee_visibility', 'organization_id'],
					false,
					tenantCode
				)

				// Throw error if mentor/mentee extension not found
				if (!userPolicyDetails || Object.keys(userPolicyDetails).length === 0) {
					return responses.failureResponse({
						statusCode: httpStatusCode.not_found,
						message: isAMentor ? 'MENTORS_NOT_FOUND' : 'MENTEE_EXTENSION_NOT_FOUND',
						responseCode: 'CLIENT_ERROR',
					})
				}

				// check the accessibility conditions
				const accessibleUsers = userData.map((mentee) => {
					let isAccessible = false

					if (userPolicyDetails.external_mentee_visibility && userPolicyDetails.organization_id) {
						const { external_mentee_visibility, organization_id } = userPolicyDetails

						switch (external_mentee_visibility) {
							/**
							 * if user external_mentee_visibility is current. He can only see his/her organizations mentee
							 * so we will check mentee's organization_id and user organization_id are matching
							 */
							case common.CURRENT:
								isAccessible = mentee.organization_id === organization_id
								break
							/**
							 * If user external_mentee_visibility is associated
							 * <<point**>> first we need to check if mentee's visible_to_organizations contain the user organization_id and verify mentee's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
							 */
							case common.ASSOCIATED:
								isAccessible =
									(mentee.visible_to_organizations.includes(organization_id) &&
										mentee.mentee_visibility != common.CURRENT) ||
									mentee.organization_id === organization_id
								break
							/**
							 * We need to check if mentee's visible_to_organizations contain the user organization_id and verify mentee's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
							 * OR if mentee visibility is ALL that mentee is also accessible
							 */
							case common.ALL:
								isAccessible =
									(mentee.visible_to_organizations.includes(organization_id) &&
										mentee.mentee_visibility != common.CURRENT) ||
									mentee.mentee_visibility === common.ALL ||
									mentee.organization_id === organization_id
								break
							default:
								break
						}
					}
					return { mentee, isAccessible }
				})
				const isAccessible = accessibleUsers.some((user) => user.isAccessible)
				return isAccessible
			}
		} catch (error) {
			return error
		}
	}

	/**
	 * Retrieves a communication token for the logged in user.
	 *
	 * This asynchronous method logs in a user using their unique identifier (`id`)
	 * to obtain a communication token and other relevant details, then returns a
	 * standardized success response with the token, user ID, and metadata.
	 *
	 * @async
	 * @function getCommunicationToken
	 * @param {string} id - The unique identifier of the user for whom the communication token is to be retrieved.
	 * @returns {Promise<Object>} A promise that resolves to an object containing the response code, message, result data,
	 * and additional metadata.
	 *
	 * @throws {Error} If the communicationHelper login process fails, this method may throw an error.
	 *
	 * @example
	 * const response = await getCommunicationToken(123);

	 * // {
	 * //   responseCode: "OK",
	 * //   message: "Communication token fetched successfully!",
	 * //   result: {
	 * //     auth_token: "_GTFHENH422lGlLcgYQfu2GnnWO8bg6zY8ZHrXkcNmN",
	 * //     user_id: "Q9hz3jbPXkk3fXQoL"
	 * //   },
	 * //   meta: {
	 * //     correlation: "69893cb9-8b0c-44f9-945e-1bff2174af0d",
	 * //     meetingPlatform: "BBB"
	 * //   }
	 * // }
	 */
	static async getCommunicationToken(id, tenantCode) {
		try {
			const token = await communicationHelper.login(id, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'COMMUNICATION_TOKEN_FETCHED_SUCCESSFULLY',
				result: token,
			})
		} catch (error) {
			if (error.message == 'unauthorized' || error.message.includes('USER_NOT_FOUND')) {
				try {
					// Get user details for signup (unscoped to include encrypted email field)
					const user = await menteeQueries.getMenteeExtension(id, [], true, tenantCode)
					if (!user) {
						return responses.failureResponse({
							statusCode: httpStatusCode.not_found,
							message: 'USER_NOT_FOUND',
							responseCode: 'CLIENT_ERROR',
						})
					}

					// Check if email exists, if not try to get from decoded token or generate one
					if (!user.email) {
						return responses.failureResponse({
							statusCode: httpStatusCode.bad_request,
							message: 'USER_EMAIL_REQUIRED_FOR_COMMUNICATION_SIGNUP',
							responseCode: 'CLIENT_ERROR',
						})
					}

					// Attempt signup with user details
					await communicationHelper.create(id, user.name, user.email, user.image, tenantCode)

					// Retry login after successful signup
					const token = await communicationHelper.login(id, tenantCode)

					return responses.successResponse({
						statusCode: httpStatusCode.ok,
						message: 'COMMUNICATION_TOKEN_FETCHED_SUCCESSFULLY_AFTER_SIGNUP',
						result: token,
					})
				} catch (signupError) {
					return responses.failureResponse({
						statusCode: httpStatusCode.internal_server_error,
						message: 'COMMUNICATION_SIGNUP_AND_LOGIN_FAILED',
						responseCode: 'SERVER_ERROR',
					})
				}
			}

			// Handle all other errors
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'COMMUNICATION_TOKEN_FETCH_FAILED',
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Logs out a user by invoking the `communicationHelper.logout` function and
	 * returns a success response upon successful logout. If the logout fails due to
	 * an unauthorized error, returns a failure response indicating that the communication
	 * token was not found.
	 *
	 * @async
	 * @function logout
	 * @param {string} id - The ID of the user to be logged out.
	 * @returns {Promise<Object>} Resolves with a success response object if the logout is successful,
	 * or a failure response object if an unauthorized error occurs.
	 *
	 * @throws {Error} If an error other than 'unauthorized' occurs, it will not be caught here and may be handled upstream.
	 */
	static async logout(id, tenantCode) {
		try {
			const response = await communicationHelper.logout(id, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'USER_LOGGED_OUT',
				result: response,
			})
		} catch (error) {
			if (error.message === 'unauthorized') {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'COMMUNICATION_TOKEN_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error // rethrow other errors to be handled by a higher-level error handler
		}
	}

	static async details(id, organizationCode, userId = '', isAMentor = '', roles = '', tenantCode) {
		try {
			let requestedUserExtension = await menteeQueries.getMenteeExtension(id, [], false, tenantCode)
			if (!requestedUserExtension || (!isAMentor && requestedUserExtension.is_mentor == false)) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'USER_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}
			let totalSessionHosted
			if (requestedUserExtension.is_mentor == true) {
				// Get mentor visibility and org id
				const validateDefaultRules = await validateDefaultRulesFilter({
					ruleType: common.DEFAULT_RULES.MENTOR_TYPE,
					requesterId: userId,
					roles: roles,
					requesterOrganizationCode: organizationCode,
					data: requestedUserExtension,
					tenantCode: tenantCode,
				})
				if (validateDefaultRules.error && validateDefaultRules.error.missingField) {
					return responses.failureResponse({
						message: 'PROFILE_NOT_UPDATED',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				if (!validateDefaultRules) {
					return responses.failureResponse({
						message: 'USER_NOT_FOUND',
						statusCode: httpStatusCode.not_found,
						responseCode: 'CLIENT_ERROR',
					})
				}
				totalSessionHosted = await sessionQueries.countHostedSessions(id, tenantCode)
			}
			// Check for accessibility for reading shared mentor profile
			const isAccessible = await checkIfUserIsAccessible(userId, requestedUserExtension, tenantCode)

			// Throw access error
			if (!isAccessible) {
				return responses.failureResponse({
					statusCode: httpStatusCode.forbidden,
					message: 'PROFILE_RESTRICTED',
				})
			}

			let mentorExtension
			if (requestedUserExtension) {
				mentorExtension = requestedUserExtension
			} else {
				try {
					mentorExtension = await cacheHelper.getOrSet({
						tenantCode,
						orgId: 'unknown',
						ns: common.CACHE_CONFIG.namespaces.mentor_profile.name,
						id: `mentor:${id}:all`,
						fetchFn: async () => {
							return await mentorQueries.getMentorExtension(id, [], false, tenantCode)
						},
					})
				} catch (cacheError) {
					console.warn(
						'Cache system failed for mentor extension, falling back to database:',
						cacheError.message
					)
					mentorExtension = await mentorQueries.getMentorExtension(id, [], false, tenantCode)
				}
			}

			mentorExtension = utils.deleteProperties(mentorExtension, [
				'user_id',
				'visible_to_organizations',
				'image',
				'email',
				'phone',
				'settings',
			])

			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const menteeExtensionsModelName = await menteeQueries.getModelName()

			let entityTypes = await entityTypeService.readUserEntityTypesAndEntitiesCached(
				{
					status: 'ACTIVE',
					organization_code: {
						[Op.in]: [requestedUserExtension.organization_code, defaults.orgCode],
					},
					model_names: { [Op.contains]: [menteeExtensionsModelName] },
				},
				organizationCode,
				tenantCode
			)

			// validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = removeDefaultOrgEntityTypes(entityTypes, requestedUserExtension.organization_code)
			const processDbResponse = utils.processDbResponse(mentorExtension, validationData)

			const profileMandatoryFields = await utils.validateProfileData(processDbResponse, validationData)

			processDbResponse.profile_mandatory_fields = profileMandatoryFields

			const connection = await connectionQueries.getConnection(userId, id, tenantCode)

			const orgDetails = await organizationService.findOneCached(
				{ organization_code: requestedUserExtension.organization_code },
				tenantCode,
				{ attributes: ['name', 'organization_code', 'organization_id'] }
			)
			processDbResponse['organization'] = {
				id: orgDetails.organization_code,

				name: orgDetails.name,
			}

			const totalSession = await sessionAttendeesQueries.countEnrolledSessions(id, tenantCode)

			processDbResponse.sessions_attended = totalSession
			processDbResponse.sessions_hosted = totalSessionHosted

			processDbResponse.is_connected = Boolean(connection)

			if (processDbResponse.is_connected) {
				processDbResponse.connection_details = connection.meta
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROFILE_FTECHED_SUCCESSFULLY',
				result: {
					...processDbResponse,
				},
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Resolves an external user ID to an internal user ID using the communication helper.
	 * Returns a success response with the resolved user ID if successful,
	 * or a failure response if the token is unauthorized or not found.
	 *
	 * @async
	 * @static
	 * @function externalMapping
	 * @param {Object} body - The request payload containing the external user ID.
	 * @param {string} body.external_user_id - The external user identifier to resolve.
	 * @returns {Promise<Object>} A standardized success or failure response object.
	 *
	 * @example
	 * const response = await ClassName.externalMapping({ external_user_id: 'abc-123' });
	 * // response => { statusCode: 200, message: 'COMMUNICATION_TOKEN_FETCHED_SUCCESSFULLY', result: 'internal-user-id' }
	 */
	static async externalMapping(body, tenantCode) {
		try {
			const userId = await communicationHelper.resolve(body.external_user_id, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'COMMUNICATION_MAPPING_FETCHED_SUCCESSFULLY',
				result: userId,
			})
		} catch (error) {
			if (error.message == 'unauthorized') {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'COMMUNICATION_TOKEN_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}
		}
	}

	/**
	 * Build cache key for public sessions with all parameters that affect results
	 * @method
	 * @name _buildPublicSessionsCacheKey
	 * @param {Object} params - All parameters that affect query results
	 * @returns {String} - Unique cache key
	 */
	static _buildPublicSessionsCacheKey(params) {
		const crypto = require('crypto')

		// Create a deterministic hash of all parameters that affect query results
		const keyData = {
			page: params.page,
			limit: params.limit,
			search: params.search || '',
			organizationCode: params.organizationCode,
			roles: params.roles || '',
			// Hash complex objects to avoid key length issues
			searchFilter: this._hashObject(params.searchFilter),
			filteredQuery: this._hashObject(params.filteredQuery),
			saasFilter: this._hashObject(params.saasFilter),
			defaultRuleFilter: this._hashObject(params.defaultRuleFilter),
			additionalProjectionString: params.additionalProjectionString || '',
		}

		// Create deterministic string from parameters
		const keyString = Object.keys(keyData)
			.sort()
			.map((key) => `${key}:${keyData[key]}`)
			.join('|')

		// Hash the key string to create shorter, consistent cache key
		const hash = crypto.createHash('md5').update(keyString).digest('hex').substring(0, 16)

		return `page:${params.page}:limit:${params.limit}:${hash}`
	}

	/**
	 * Create consistent hash for complex objects
	 * @method
	 * @name _hashObject
	 * @param {Object} obj - Object to hash
	 * @returns {String} - Hash string
	 */
	static _hashObject(obj) {
		if (!obj || typeof obj !== 'object') return String(obj || '')

		const crypto = require('crypto')
		const jsonString = JSON.stringify(obj, Object.keys(obj).sort())
		return crypto.createHash('md5').update(jsonString).digest('hex').substring(0, 8)
	}

	/**
	 * Evict mentee-related caches after CUD operations
	 * Following the entity-type service pattern for comprehensive cache invalidation
	 */
	static async _invalidateMenteeCaches({ tenantCode, orgCode, menteeId }) {
		try {
			// Evict user-extension caches (new namespace for mentor/mentee extension data)
			if (menteeId) {
				// Invalidate specific mentee's cache entries
				await cacheHelper.evictNamespace({
					tenantCode,
					orgCode: orgCode,
					ns: 'user-extension',
					patternSuffix: `mentee:${menteeId}:*`,
				})
			} else {
				// Invalidate all mentee extension caches for the organization
				await cacheHelper.evictNamespace({
					tenantCode,
					orgCode: orgCode,
					ns: 'user-extension',
				})
			}

			// Evict mentee profile caches (if namespace exists in config)
			if (common.CACHE_CONFIG.namespaces.mentee_profile) {
				await cacheHelper.evictNamespace({
					tenantCode,
					orgCode: orgCode,
					ns: common.CACHE_CONFIG.namespaces.mentee_profile.name,
				})
			}

			// Evict sessions caches as mentee data affects sessions
			if (common.CACHE_CONFIG.namespaces.sessions) {
				await cacheHelper.evictNamespace({
					tenantCode,
					orgCode: orgCode,
					ns: common.CACHE_CONFIG.namespaces.sessions.name,
				})
			}
		} catch (err) {
			console.error('Mentee cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}
}
