// Dependencies
const utils = require('@generics/utils')
const userRequests = require('@requests/user')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const mentorQueries = require('@database/queries/mentorExtension')
const menteeQueries = require('@database/queries/userExtension')
const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const { UniqueConstraintError } = require('sequelize')
const _ = require('lodash')
const sessionAttendeesQueries = require('@database/queries/sessionAttendees')
const sessionQueries = require('@database/queries/sessions')
const entityTypeQueries = require('@database/queries/entityType')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const orgAdminService = require('@services/org-admin')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const moment = require('moment')
const menteesService = require('@services/mentees')
const entityTypeService = require('@services/entity-type')
const responses = require('@helpers/responses')
const permissions = require('@helpers/getPermissions')
const { buildSearchFilter } = require('@helpers/search')
const searchConfig = require('@configs/search.json')
const emailEncryption = require('@utils/emailEncryption')
const { defaultRulesFilter, validateDefaultRulesFilter } = require('@helpers/defaultRules')
const connectionQueries = require('@database/queries/connection')
const communicationHelper = require('@helpers/communications')
const userExtensionQueries = require('@database/queries/userExtension')
module.exports = class MentorsHelper {
	/**
	 * upcomingSessions.
	 * @method
	 * @name upcomingSessions
	 * @param {String} id - user id.
	 * @param {String} page - Page No.
	 * @param {String} limit - Page size limit.
	 * @param {String} search - Search text.
	 * @returns {JSON} - mentors upcoming session details
	 */
	static async upcomingSessions(
		id,
		page,
		limit,
		search = '',
		menteeUserId,
		queryParams,
		isAMentor,
		roles,
		orgCode,
		tenantCode
	) {
		try {
			let requestedMentorExtension = false
			if (id !== '' && isAMentor !== '' && roles !== '') {
				requestedMentorExtension = await mentorQueries.getMentorExtension(id, [], false, tenantCode)
				if (!requestedMentorExtension) {
					return responses.failureResponse({
						statusCode: httpStatusCode.bad_request,
						message: 'MENTORS_NOT_FOUND',
						responseCode: 'CLIENT_ERROR',
					})
				}
			}
			const query = utils.processQueryParametersWithExclusions(queryParams)
			const sessionModelName = await sessionQueries.getModelName()

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
			let validationData = await entityTypeQueries.findAllEntityTypesAndEntities(
				{
					status: 'ACTIVE',
					allow_filtering: true,
					model_names: { [Op.contains]: [sessionModelName] },
				},
				{ [Op.in]: [tenantCode, defaults.tenantCode] }
			)

			if (!orgCode) {
				return responses.failureResponse({
					message: 'ORGANIZATION_CODE_REQUIRED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const defaultRuleFilter = await defaultRulesFilter({
				ruleType: common.DEFAULT_RULES.SESSION_TYPE,
				requesterId: menteeUserId,
				roles: roles,
				requesterOrganizationCode: orgCode,
				tenantCode: { [Op.in]: [tenantCode, defaults.tenantCode] },
			})

			if (defaultRuleFilter.error && defaultRuleFilter.error.missingField) {
				return responses.failureResponse({
					message: 'PROFILE_NOT_UPDATED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const filteredQuery = utils.validateAndBuildFilters(query, validationData, sessionModelName)

			// Filter upcoming sessions based on saas policy
			const saasFilter = await menteesService.filterSessionsBasedOnSaasPolicy(menteeUserId, isAMentor, tenantCode)

			let upcomingSessions = await sessionQueries.getMentorsUpcomingSessionsFromView(
				page,
				limit,
				search,
				id,
				filteredQuery,
				tenantCode,
				saasFilter,
				defaultRuleFilter
			)

			if (!upcomingSessions.data.length) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'UPCOMING_SESSION_FETCHED',
					result: {
						data: [],
						count: upcomingSessions.count,
					},
				})
			}

			// Process entity types to add value labels.
			const uniqueOrgIds = [...new Set(upcomingSessions.data.map((obj) => obj.mentor_organization_id))]
			upcomingSessions.data = await entityTypeService.processEntityTypesToAddValueLabels(
				upcomingSessions.data,
				uniqueOrgIds,
				common.sessionModelName,
				'mentor_organization_id',
				[],
				[tenantCode]
			)

			upcomingSessions.data = await this.sessionMentorDetails(upcomingSessions.data, tenantCode)
			if (menteeUserId && id != menteeUserId) {
				upcomingSessions.data = await this.menteeSessionDetails(upcomingSessions.data, menteeUserId, tenantCode)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'UPCOMING_SESSION_FETCHED',
				result: upcomingSessions,
			})
		} catch (err) {
			return err
		}
	}

	/**
	 * Profile.
	 * @method
	 * @name profile
	 * @param {String} userId - user id.
	 * @returns {JSON} - profile details
	 */
	/* 	static async profile(id) {
		try {
			const mentorsDetails = await userRequests.fetchUserDetails('', id)
			if (mentorsDetails.data.result.isAMentor && mentorsDetails.data.result.deleted === false) {
				const _id = mentorsDetails.data.result._id
				const filterSessionAttended = { userId: _id, isSessionAttended: true }
				const totalSessionsAttended = await sessionAttendees.countAllSessionAttendees(filterSessionAttended)
				const filterSessionHosted = { userId: _id, status: 'completed', isStarted: true, delete: false }
				const totalSessionHosted = await sessionsData.findSessionHosted(filterSessionHosted)
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'PROFILE_FTECHED_SUCCESSFULLY',
					result: {
						sessionsAttended: totalSessionsAttended,
						sessionsHosted: totalSessionHosted,
						...mentorsDetails.data.result,
					},
				})
			} else {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'MENTORS_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}
		} catch (err) {
			return err
		}
	} */

	/**
	 * Mentors reports.
	 * @method
	 * @name reports
	 * @param {String} userId - user id.
	 * @param {String} filterType - MONTHLY/WEEKLY/QUARTERLY.
	 * @returns {JSON} - Mentors reports
	 */

	static async reports(userId, filterType, roles, organizationId, tenantCode) {
		try {
			if (!utils.isAMentor(roles)) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'MENTORS_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}

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

			const totalSessionsCreated = await sessionQueries.getCreatedSessionsCountInDateRange(
				userId,
				filterStartDate.toISOString(),
				filterEndDate.toISOString(),
				tenantCode
			)

			const totalSessionsAssigned = await sessionQueries.getAssignedSessionsCountInDateRange(
				userId,
				filterStartDate.toISOString(),
				filterEndDate.toISOString(),
				tenantCode
			)

			const totalSessionsHosted = await sessionQueries.getHostedSessionsCountInDateRange(
				userId,
				Date.parse(filterStartDate) / 1000, // Converts milliseconds to seconds
				Date.parse(filterEndDate) / 1000,
				tenantCode
			)

			const result = {
				total_session_created: totalSessionsCreated,
				total_session_hosted: totalSessionsHosted,
				total_session_assigned: totalSessionsAssigned,
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTORS_REPORT_FETCHED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Shareable mentor profile link.
	 * @method
	 * @name share
	 * @param {String} _id - Mentors user id.
	 * @returns {JSON} - Returns sharable link of the mentor.
	 */
	static async share(id, userId, organizationId, tenantCode) {
		try {
			const mentorsDetails = await mentorQueries.getMentorExtension(id, [], false, tenantCode)
			if (!mentorsDetails) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'MENTORS_NOT_FOUND',
					responseCode: 'CLIENT_ERROR',
				})
			}
			const shareLink = await userRequests.share(id)
			return shareLink
		} catch (error) {
			return error
		}
	}

	static async sessionMentorDetails(session, tenantCode) {
		try {
			if (session.length > 0) {
				const userIds = _.uniqBy(session, 'mentor_id').map((item) => item.mentor_id)

				let mentorDetails = await userRequests.getUserDetailedList(userIds, tenantCode)

				mentorDetails = mentorDetails.result

				for (let i = 0; i < session.length; i++) {
					let mentorIndex = mentorDetails.findIndex((x) => x.user_id === session[i].mentor_id)

					session[i].mentor_name = mentorDetails[mentorIndex].name
					session[i].organization = mentorDetails[mentorIndex].organization
				}

				await Promise.all(
					session.map(async (sessions) => {
						if (sessions.image && sessions.image.length > 0) {
							sessions.image = sessions.image.map(async (imgPath) => {
								if (imgPath && imgPath != '') {
									return await utils.getDownloadableUrl(imgPath)
								}
							})
							sessions.image = await Promise.all(sessions.image)
						}
					})
				)

				return session
			} else {
				return session
			}
		} catch (error) {
			throw error
		}
	}

	static async menteeSessionDetails(sessions, userId, tenantCode) {
		try {
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

	//Functions for new APIS
	/**
	 * Create a new mentor extension.
	 * @method
	 * @name createMentorExtension
	 * @param {Object} data - Mentor extension data to be created.
	 * @param {String} userId - User ID of the mentor.
	 * @returns {Promise<Object>} - Created mentor extension details.
	 */
	static async createMentorExtension(data, userId, orgCode, tenantCode, orgId) {
		try {
			let skipValidation = data.skipValidation ? data.skipValidation : false
			if (data.email) {
				data.email = emailEncryption.encrypt(data.email.toLowerCase())
			}
			// Use organization code as temporary name and let findOrInsertOrganizationExtension handle creation
			const organization_name = orgCode // Temporary fallback, can be updated later

			// Find organisation policy from organisation_extension table
			let organisationPolicy = await organisationExtensionQueries.findOrInsertOrganizationExtension(
				orgId,
				orgCode,
				organization_name,
				tenantCode
			)

			data.user_id = userId
			data.organization_code = orgCode

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
			const mentorExtensionsModelName = await mentorQueries.getModelName()

			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_code: {
					[Op.in]: [orgCode, defaults.orgCode],
				},
				tenant_code: {
					[Op.in]: [tenantCode, defaults.tenantCode],
				},
				model_names: { [Op.contains]: [mentorExtensionsModelName] },
			})

			//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = removeDefaultOrgEntityTypes(entityTypes, defaults.orgCode)
			let res = utils.validateInput(data, validationData, mentorExtensionsModelName, skipValidation)
			if (!res.success) {
				return responses.failureResponse({
					message: 'SESSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}
			let mentorExtensionsModel = await mentorQueries.getColumns()
			data = utils.restructureBody(data, validationData, mentorExtensionsModel)

			// construct saas policy data
			let saasPolicyData = await orgAdminService.constructOrgPolicyObject(organisationPolicy, true)

			// Set related_orgs to include current organization
			const related_orgs = [saasPolicyData.organization_id]

			// update mentee extension data
			data = {
				...data,
				...saasPolicyData,
				visible_to_organizations: related_orgs,
			}
			const response = await mentorQueries.createMentorExtension(data, tenantCode)

			const processDbResponse = utils.processDbResponse(response.toJSON(), validationData)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTOR_EXTENSION_CREATED',
				result: processDbResponse,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'MENTOR_EXTENSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return error
		}
	}

	/**
	 * Update a mentor extension.
	 * @method
	 * @name updateMentorExtension
	 * @param {String} userId - User ID of the mentor.
	 * @param {Object} data - Updated mentor extension data excluding user_id.
	 * @returns {Promise<Object>} - Updated mentor extension details.
	 */
	static async updateMentorExtension(data, userId, orgCode, tenantCode) {
		try {
			// Fetch current mentee extension data
			const currentUser = await mentorQueries.getMentorExtension(userId, [], false, tenantCode)
			if (!currentUser) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTOR_EXTENSION_NOT_FOUND',
				})
			}
			if (data.email) data.email = emailEncryption.encrypt(data.email.toLowerCase())
			let skipValidation = data.skipValidation ? data.skipValidation : false
			// Remove certain data in case it is getting passed
			const dataToRemove = [
				'user_id',
				'mentor_visibility',
				'mentee_visibility',
				'visible_to_organizations',
				'external_session_visibility',
				'external_mentor_visibility',
				'external_mentee_visibility',
			]

			dataToRemove.forEach((key) => {
				if (data[key]) {
					delete data[key]
				}
			})

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
			const mentorExtensionsModelName = await mentorQueries.getModelName()

			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_code: {
					[Op.in]: [orgCode, defaults.orgCode],
				},
				tenant_code: {
					[Op.in]: [tenantCode, defaults.tenant_code],
				},
				model_names: { [Op.contains]: [mentorExtensionsModelName] },
			})
			const validationData = removeDefaultOrgEntityTypes(entityTypes, defaults.orgCode)
			let mentorExtensionsModel = await mentorQueries.getColumns()

			let res = utils.validateInput(data, validationData, mentorExtensionsModelName, skipValidation)
			if (!res.success) {
				return responses.failureResponse({
					message: 'PROFILE_UPDATE_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}

			data = utils.restructureBody(data, validationData, mentorExtensionsModel)

			if (data?.organization?.id) {
				//Do a org policy update for the user only if the data object explicitly includes an
				//organization.id. This is added for the users/update workflow where
				//both both user data and organisation can change at the same time.
				let userOrgDetails = await userRequests.fetchOrgDetails({ organizationCode: orgCode })
				const orgPolicies = await organisationExtensionQueries.findOrInsertOrganizationExtension(
					data.organization.id,
					orgCode,
					tenantCode,
					userOrgDetails.data.result.name
				)
				if (!orgPolicies?.organization_id) {
					return responses.failureResponse({
						message: 'ORG_EXTENSION_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				data.organization_id = data.organization.id
				const newPolicy = await orgAdminService.constructOrgPolicyObject(orgPolicies, true)
				data = _.merge({}, data, newPolicy)
				data.visible_to_organizations = Array.from(
					new Set([...userOrgDetails.data.result.related_orgs, data.organization.id])
				)
			}

			const [updateCount, updatedMentor] = await mentorQueries.updateMentorExtension(
				userId,
				data,
				{
					returning: true,
					raw: true,
				},
				{},
				false,
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
				const fallbackUpdatedUser = await mentorQueries.getMentorExtension(userId, [], false, tenantCode)
				if (!fallbackUpdatedUser) {
					return responses.failureResponse({
						statusCode: httpStatusCode.not_found,
						message: 'MENTOR_EXTENSION_NOT_FOUND',
					})
				}

				const processDbResponse = utils.processDbResponse(fallbackUpdatedUser, validationData)
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MENTOR_EXTENSION_UPDATED',
					result: processDbResponse,
				})
			}

			//validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))

			const processDbResponse = utils.processDbResponse(updatedMentor[0], validationData)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTOR_EXTENSION_UPDATED',
				result: processDbResponse,
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Get mentor extension details by user ID.
	 * @method
	 * @name getMentorExtension
	 * @param {String} userId - User ID of the mentor.
	 * @returns {Promise<Object>} - Mentor extension details.
	 */
	static async getMentorExtension(userId, tenantCode) {
		try {
			const mentor = await mentorQueries.getMentorExtension(userId, [], false, tenantCode)
			if (!mentor) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTOR_EXTENSION_NOT_FOUND',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTOR_EXTENSION_FETCHED',
				result: mentor,
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Delete a mentor extension by user ID.
	 * @method
	 * @name deleteMentorExtension
	 * @param {String} userId - User ID of the mentor.
	 * @returns {Promise<Object>} - Indicates if the mentor extension was deleted successfully.
	 */
	static async deleteMentorExtension(userId, tenantCode) {
		try {
			const deleteCount = await mentorQueries.deleteMentorExtension(userId, tenantCode, false)
			if (deleteCount === '0') {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTOR_EXTENSION_NOT_FOUND',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTOR_EXTENSION_DELETED',
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Read.
	 * @method
	 * @name read
	 * @param {Number} id 						- mentor id.
	 * @param {Number} orgId 					- org id
	 * @param {Number} userId 					- User id.
	 * @param {Boolean} isAMentor 				- user mentor or not.
	 * @returns {JSON} 							- profile details
	 */
	static async read(id, orgCode, userId = '', isAMentor = '', roles = '', tenantCode) {
		try {
			// Get mentor profile first to ensure we have organization_code
			let mentorProfile = await userRequests.getUserDetails(id, tenantCode)
			if (!mentorProfile.data.result) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTORS_NOT_FOUND',
				})
			}

			// Set orgCode if not provided
			if (!orgCode) {
				orgCode = mentorProfile.data.result.organization_code
			}

			let requestedMentorExtension = false
			if (userId !== '' && isAMentor !== '' && roles !== '') {
				// Get mentor visibility and org id
				requestedMentorExtension = await mentorQueries.getMentorExtension(id, [], false, tenantCode)

				const validateDefaultRules = await validateDefaultRulesFilter({
					ruleType: common.DEFAULT_RULES.MENTOR_TYPE,
					requesterId: userId,
					roles: roles,
					requesterOrganizationCode: orgCode,
					data: requestedMentorExtension,
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
						message: 'MENTORS_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				// Throw error if extension not found
				if (!requestedMentorExtension || Object.keys(requestedMentorExtension).length === 0) {
					return responses.failureResponse({
						statusCode: httpStatusCode.not_found,
						message: 'MENTORS_NOT_FOUND',
					})
				}

				// Check for accessibility for reading shared mentor profile
				const isAccessible = await this.checkIfMentorIsAccessible(
					[requestedMentorExtension],
					userId,
					isAMentor,
					tenantCode
				)

				// Throw access error
				if (!isAccessible) {
					return responses.failureResponse({
						statusCode: httpStatusCode.not_found,
						message: 'PROFILE_RESTRICTED',
					})
				}
			}

			let mentorExtension
			if (requestedMentorExtension) mentorExtension = requestedMentorExtension
			else mentorExtension = await mentorQueries.getMentorExtension(id, [], false, tenantCode)

			// If no mentor extension found, but user has admin/mentor roles, check if user extension exists and update it
			if (!mentorExtension && roles && roles.some((role) => role.title === 'admin' || role.title === 'mentor')) {
				// Try to get user extension without is_mentor filter
				const userExtension = await mentorQueries.getMentorExtension(id, [], true, tenantCode)
				if (userExtension) {
					// Update using unscoped updateMentorExtension with custom filter to bypass is_mentor constraint
					await mentorQueries.updateMentorExtension(
						id,
						{ is_mentor: true },
						{},
						{ user_id: id },
						true,
						tenantCode
					)
					// Get the updated mentor extension
					mentorExtension = await mentorQueries.getMentorExtension(id, [], false, tenantCode)
				}
			}

			if (!mentorProfile.data.result || !mentorExtension) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTORS_NOT_FOUND',
				})
			}
			mentorProfile = utils.deleteProperties(mentorProfile.data.result, ['created_at', 'updated_at'])

			mentorExtension = utils.deleteProperties(mentorExtension, ['user_id', 'visible_to_organizations'])

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
			const mentorExtensionsModelName = await mentorQueries.getModelName()

			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_code: {
					[Op.in]: [orgCode, defaults.orgCode],
				},
				tenant_code: {
					[Op.in]: [tenantCode, defaults.tenantCode],
				},
				model_names: { [Op.contains]: [mentorExtensionsModelName] },
			})

			if (mentorExtension.image) {
				delete mentorExtension.image
			}

			// validationData = utils.removeParentEntityTypes(JSON.parse(JSON.stringify(validationData)))
			const validationData = removeDefaultOrgEntityTypes(entityTypes, defaults.orgCode)
			const processDbResponse = utils.processDbResponse(mentorExtension, validationData)
			const totalSessionHosted = await sessionQueries.countHostedSessions(id, tenantCode)

			const totalSession = await sessionAttendeesQueries.countEnrolledSessions(id, tenantCode)
			const mentorPermissions = await permissions.getPermissions(roles)
			if (!Array.isArray(mentorProfile.permissions)) {
				mentorProfile.permissions = []
			}
			mentorProfile.permissions.push(...mentorPermissions)

			const profileMandatoryFields = await utils.validateProfileData(processDbResponse, validationData)
			mentorProfile.profile_mandatory_fields = profileMandatoryFields

			let communications = null

			if (mentorExtension?.meta?.communications_user_id) {
				try {
					const chat = await communicationHelper.login(id, tenantCode)
					communications = chat
				} catch (error) {}
			}
			processDbResponse.meta = {
				...processDbResponse.meta,
				communications,
			}

			if (!mentorProfile.organization) {
				const orgDetails = await organisationExtensionQueries.findOne({ organization_code: orgCode }, null, {
					attributes: ['name'],
				})
				mentorProfile['organization'] = {
					code: orgCode,
					name: orgDetails.name,
				}
			}
			// Conditionally fetch profile details if token exists
			let userProfile = {}
			if (tenantCode && id) {
				const profileResponse = await userRequests.getProfileDetails({ tenantCode, userId: id })
				// If profileResponse.data.result exists, include it; otherwise, keep userProfile empty
				if (profileResponse.data.result) {
					userProfile = profileResponse.data.result
				}
				// No failure response; proceed with available data
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROFILE_FETCHED_SUCCESSFULLY',
				result: {
					sessions_attended: totalSession,
					sessions_hosted: totalSessionHosted,
					...mentorProfile,
					...processDbResponse,
					...userProfile, // Include userProfile only if token was provided
				},
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * @description 							- check if mentor is accessible based on user's saas policy.
	 * @method
	 * @name checkIfMentorIsAccessible
	 * @param {Number} userId 					- User id.
	 * @param {Array}							- Session data
	 * @param {Boolean} isAMentor 				- user mentor or not.
	 * @returns {JSON} 							- List of filtered sessions
	 */
	static async checkIfMentorIsAccessible(userData, userId, isAMentor, tenantCode) {
		try {
			// user can be mentor or mentee, based on isAMentor key get policy details
			const userPolicyDetails = isAMentor
				? await mentorQueries.getMentorExtension(
						userId,
						['external_mentor_visibility', 'organization_id'],
						false,
						tenantCode
				  )
				: await menteeQueries.getMenteeExtension(
						userId,
						['external_mentor_visibility', 'organization_id'],
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
			let isAccessible = false
			if (userPolicyDetails.external_mentor_visibility && userPolicyDetails.organization_id) {
				const { external_mentor_visibility, organization_id } = userPolicyDetails
				const mentor = userData[0]
				switch (external_mentor_visibility) {
					/**
					 * if user external_mentor_visibility is current. He can only see his/her organizations mentors
					 * so we will check mentor's organization_id and user organization_id are matching
					 */
					case common.CURRENT:
						isAccessible = mentor.organization_id === organization_id
						break
					/**
					 * If user external_mentor_visibility is associated
					 * <<point**>> first we need to check if mentor's visible_to_organizations contain the user organization_id and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 */
					case common.ASSOCIATED:
						isAccessible =
							(mentor.visible_to_organizations.includes(organization_id) &&
								mentor.mentor_visibility != common.CURRENT) ||
							mentor.organization_id === organization_id
						break
					/**
					 * We need to check if mentor's visible_to_organizations contain the user organization_id and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 * OR if mentor visibility is ALL that mentor is also accessible
					 */
					case common.ALL:
						isAccessible =
							(mentor.visible_to_organizations.includes(organization_id) &&
								mentor.mentor_visibility != common.CURRENT) ||
							mentor.mentor_visibility === common.ALL ||
							mentor.organization_id === organization_id
						break
					default:
						break
				}
			}
			return isAccessible
		} catch (err) {
			return err
		}
	}
	/**
	 * Get user list.
	 * @method
	 * @name create
	 * @param {Number} pageSize -  Page size.
	 * @param {Number} pageNo -  Page number.
	 * @param {String} searchText -  Search text.
	 * @param {JSON} queryParams -  Query params.
	 * @param {Boolean} isAMentor -  Is a mentor.
	 * @returns {JSON} - User list.
	 */

	static async list(
		pageNo,
		pageSize,
		searchText,
		searchOn,
		queryParams,
		userId,
		isAMentor,
		roles,
		orgCode,
		tenantCode
	) {
		try {
			let additionalProjectionString = ''
			let userServiceQueries = {}

			// check for fields query (Adds to the projection)
			if (queryParams.fields && queryParams.fields !== '') {
				additionalProjectionString = queryParams.fields
				delete queryParams.fields
			}

			let organization_codes = []
			let directory = false

			const [sortBy, order] = ['name'].includes(queryParams.sort_by)
				? [queryParams.sort_by, queryParams.order || 'ASC']
				: [false, 'ASC']

			for (let key in queryParams) {
				if (queryParams.hasOwnProperty(key) & ((key === 'email') | (key === 'name'))) {
					userServiceQueries[key] = queryParams[key]
				}
				if (queryParams.hasOwnProperty(key) & (key === 'organization_codes')) {
					organization_codes = queryParams[key].split(',')
				}

				if (
					queryParams.hasOwnProperty(key) &
					(key === 'directory') &
					((queryParams[key] == 'true') | (queryParams[key] == true))
				) {
					directory = true
				}
			}

			const emailIds = []
			const searchTextArray = searchText ? searchText.split(',') : []

			searchTextArray.forEach((element) => {
				if (utils.isValidEmail(element)) {
					emailIds.push(emailEncryption.encrypt(element.toLowerCase()))
				}
			})
			const hasValidEmails = emailIds.length > 0

			const query = utils.processQueryParametersWithExclusions(queryParams)
			const mentorExtensionsModelName = await mentorQueries.getModelName()

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

			let validationData = await entityTypeQueries.findAllEntityTypesAndEntities(
				{
					status: 'ACTIVE',
					allow_filtering: true,
					model_names: { [Op.contains]: [mentorExtensionsModelName] },
				},
				{ [Op.in]: [tenantCode, defaults.tenantCode] }
			)

			const filteredQuery = utils.validateAndBuildFilters(query, validationData, mentorExtensionsModelName)
			const saasFilter = await this.filterMentorListBasedOnSaasPolicy(
				userId,
				isAMentor,
				organization_codes,
				tenantCode
			)

			let searchFilter
			if (!hasValidEmails) {
				searchFilter = await buildSearchFilter({
					searchOn: searchOn ? searchOn.split(',') : false,
					searchConfig: searchConfig.search.mentor,
					search: searchText,
					modelName: mentorExtensionsModelName,
					tenantCode: tenantCode,
				})

				if (!searchFilter) {
					return responses.successResponse({
						statusCode: httpStatusCode.ok,
						message: 'MENTOR_LIST',
						result: {
							data: [],
							count: 0,
						},
					})
				}
			}
			if (!orgCode) {
				return responses.failureResponse({
					message: 'ORGANIZATION_CODE_REQUIRED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const defaultRuleFilter = await defaultRulesFilter({
				ruleType: 'mentor',
				requesterId: queryParams.menteeId ? queryParams.menteeId : userId,
				roles: roles,
				requesterOrganizationCode: orgCode,
				tenantCode: { [Op.in]: [tenantCode, defaults.tenantCode] },
			})

			if (defaultRuleFilter.error && defaultRuleFilter.error.missingField) {
				return responses.failureResponse({
					message: 'PROFILE_NOT_UPDATED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let connectedMentorsIds = []

			if (queryParams.connected_mentors === 'true') {
				const connectedQueryParams = { ...queryParams }
				delete connectedQueryParams.connected_mentors
				const connectedQuery = utils.processQueryParametersWithExclusions(connectedQueryParams)

				const connectionDetails = await connectionQueries.getConnectionsDetails(
					pageNo,
					pageSize,
					connectedQuery,
					searchText,
					queryParams.mentorId ? queryParams.mentorId : userId,
					organization_codes,
					[] // roles can be passed if needed
				)

				if (connectionDetails?.data?.length > 0) {
					connectedMentorsIds = connectionDetails.data.map((item) => item.user_id)
					if (!connectedMentorsIds.includes(userId)) {
						connectedMentorsIds.push(userId)
					}
				}

				// If there are no connected mentees, short-circuit and return empty
				if (connectedMentorsIds.length === 0) {
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

			// Fetch mentor data
			let extensionDetails = await mentorQueries.getMentorsByUserIdsFromView(
				connectedMentorsIds ? connectedMentorsIds : [],
				pageNo,
				pageSize,
				filteredQuery,
				saasFilter,
				additionalProjectionString,
				false,
				searchFilter,
				hasValidEmails ? emailIds : searchText,
				defaultRuleFilter,
				tenantCode
			)
			// Early return for empty results
			if (extensionDetails.count === 0 || extensionDetails.data.length === 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MENTOR_LIST',
					result: {
						data: [],
						count: extensionDetails.count,
					},
				})
			}

			const mentorIds = extensionDetails.data.map((item) => item.user_id)
			const userDetails = await userRequests.getUserDetailedList(mentorIds, tenantCode)

			//Extract unique organization_codes
			const organizationCodes = [...new Set(extensionDetails.data.map((user) => user.organization_code))]

			//Query organization table (only if there are codes to query)
			let organizationDetails = []
			if (organizationCodes.length > 0) {
				const orgFilter = {
					organization_code: {
						[Op.in]: organizationCodes,
					},
				}
				organizationDetails = await organisationExtensionQueries.findAll(orgFilter, tenantCode, {
					attributes: ['name', 'organization_code'],
					raw: true, // Ensure plain objects
				})
			}

			//Create a map of organization_code to organization details
			const orgMap = {}
			organizationDetails.forEach((org) => {
				orgMap[org.organization_code] = {
					id: org.organization_code,
					name: org.name,
				}
			})

			//Attach organization details and decrypt email for each user
			extensionDetails.data = await Promise.all(
				extensionDetails.data.map(async (user) => ({
					...user,
					id: user.user_id, // Add 'id' key, to be removed later
					email: user.email ? (await emailEncryption.decryptAndValidate(user.email)) || user.email : null, // Decrypt email
					organization: orgMap[user.organization_code] || null,
				}))
			)

			const connectedUsers = await connectionQueries.getConnectionsByUserIds(userId, mentorIds, tenantCode)
			const connectedMentorIds = new Set(connectedUsers.map((connectedUser) => connectedUser.friend_id))

			if (extensionDetails.data.length > 0) {
				extensionDetails.data = await entityTypeService.processEntityTypesToAddValueLabels(
					extensionDetails.data,
					organizationCodes,
					mentorExtensionsModelName,
					'organization_code',
					[],
					[tenantCode]
				)
			}

			// Create a map from userDetails.result for quick lookups
			const userDetailsMap = new Map(userDetails.result.map((userDetail) => [userDetail.user_id, userDetail]))

			// Map over extensionDetails.data to merge with the corresponding userDetail
			extensionDetails.data = extensionDetails.data
				.map((extensionDetail) => {
					const user_id = `${extensionDetail.user_id}`
					const isConnected = connectedMentorIds.has(extensionDetail.user_id)

					if (userDetailsMap.has(user_id)) {
						let userDetail = userDetailsMap.get(user_id)
						// Merge userDetail with extensionDetail, prioritize extensionDetail properties
						userDetail = { ...userDetail, ...extensionDetail, is_connected: isConnected }
						delete userDetail.user_id
						delete userDetail.mentor_visibility
						delete userDetail.mentee_visibility
						delete userDetail.organization_code
						delete userDetail.meta
						return userDetail
					}
					return null
				})
				.filter((extensionDetail) => extensionDetail !== null)
			if (directory) {
				let foundKeys = {}
				let result = []
				for (let user of extensionDetails.data) {
					let firstChar = user.name.charAt(0)
					firstChar = firstChar.toUpperCase()

					if (!foundKeys[firstChar]) {
						result.push({
							key: firstChar,
							values: [user],
						})
						foundKeys[firstChar] = result.length
					} else {
						let index = foundKeys[firstChar] - 1
						result[index].values.push(user)
					}
				}

				const sortedData = _.sortBy(result, 'key') || []
				extensionDetails.data = sortedData
			} else {
				// Check if sortBy and order have values before applying sorting
				if (sortBy) {
					extensionDetails.data = extensionDetails.data.sort((a, b) => {
						// Determine the sorting order based on the 'order' value
						const sortOrder = order.toLowerCase() === 'asc' ? 1 : order.toLowerCase() === 'desc' ? -1 : 1

						// Customize the sorting based on the provided sortBy field
						return sortOrder * a[sortBy].localeCompare(b[sortBy])
					})
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTOR_LIST',
				result: extensionDetails,
			})
		} catch (error) {
			throw error
		}
	}
	/**
	 * @description 							- Filter mentor list based on user's saas policy.
	 * @method
	 * @name filterMentorListBasedOnSaasPolicy
	 * @param {Number} userId 					- User id.
	 * @param {Boolean} isAMentor 				- user mentor or not.
	 * @returns {JSON} 							- List of filtered sessions
	 */
	static async filterMentorListBasedOnSaasPolicy(userId, isAMentor, organization_codes = [], tenantCode) {
		try {
			// Always query mentee extension for mentor list filtering policy
			// Even if user is also a mentor/admin, we need their mentee visibility policy
			const userPolicyDetails = await menteeQueries.getMenteeExtension(
				userId,
				['external_mentor_visibility', 'organization_code'],
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

			let filter = ''
			// searching for specific organization
			let additionalFilter = ``
			if (organization_codes.length !== 0) {
				additionalFilter = `AND "organization_code" in (${organization_codes
					.map((code) => `'${code}'`)
					.join(',')}) `
			}

			if (userPolicyDetails.external_mentor_visibility && userPolicyDetails.organization_code) {
				// Filter user data based on policy
				// generate filter based on condition
				if (userPolicyDetails.external_mentor_visibility === common.CURRENT) {
					/**
					 * if user external_mentor_visibility is current. He can only see his/her organizations mentors
					 * so we will check mentor's organization_code and user organization_code are matching
					 */
					filter = `AND "organization_code" = '${userPolicyDetails.organization_code}'`
				} else if (userPolicyDetails.external_mentor_visibility === common.ASSOCIATED) {
					/**
					 * If user external_mentor_visibility is associated
					 * <<point**>> first we need to check if mentor's visible_to_organizations contain the user organization_code and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 */

					filter =
						additionalFilter +
						`AND ( ('${userPolicyDetails.organization_code}' = ANY("visible_to_organizations") AND "mentor_visibility" != 'CURRENT')`

					if (additionalFilter.length === 0)
						filter += ` OR organization_code = '${userPolicyDetails.organization_code}' )`
					else filter += `)`
				} else if (userPolicyDetails.external_mentor_visibility === common.ALL) {
					/**
					 * We need to check if mentor's visible_to_organizations contain the user organization_code and verify mentor's visibility is not current (if it is ALL and ASSOCIATED it is accessible)
					 * OR if mentor visibility is ALL that mentor is also accessible
					 */
					filter =
						additionalFilter +
						`AND (('${userPolicyDetails.organization_code}' = ANY("visible_to_organizations") AND "mentor_visibility" != 'CURRENT' ) OR "mentor_visibility" = 'ALL' OR "organization_code" = '${userPolicyDetails.organization_code}')`
				}
			}

			return filter
		} catch (err) {
			return err
		}
	}

	/**
	 * Sessions list
	 * @method
	 * @name list
	 * @param {Object} req -request data.
	 * @param {String} req.decodedToken.id - User Id.
	 * @param {String} req.pageNo - Page No.
	 * @param {String} req.pageSize - Page size limit.
	 * @param {String} req.searchText - Search text.
	 * @returns {JSON} - Session List.
	 */

	static async createdSessions(
		loggedInUserId,
		page,
		limit,
		search,
		status,
		roles,
		organizationId,
		tenantCode,
		startDate,
		endDate
	) {
		try {
			if (!utils.isAMentor(roles)) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'NOT_A_MENTOR',
					responseCode: 'CLIENT_ERROR',
				})
			}

			const currentDate = Math.floor(moment.utc().valueOf() / 1000)

			let arrayOfStatus = []
			if (status && status != '') {
				arrayOfStatus = status.split(',')
			}

			let filters = {
				mentor_id: loggedInUserId,
			}
			if (arrayOfStatus.length > 0) {
				// if (arrayOfStatus.includes(common.COMPLETED_STATUS) && arrayOfStatus.length == 1) {
				// 	filters['endDateUtc'] = {
				// 		$lt: moment().utc().format(),
				// 	}
				// } else
				if (arrayOfStatus.includes(common.PUBLISHED_STATUS) && arrayOfStatus.includes(common.LIVE_STATUS)) {
					filters['end_date'] = {
						[Op.gte]: currentDate,
					}
				}

				filters['status'] = arrayOfStatus
			}

			// Apply custom startDate and endDate filter only if both are provided
			if (startDate && endDate) {
				filters['start_date'] = { [Op.gte]: startDate }
				filters['end_date'] = { ...(filters['end_date'] || {}), [Op.lte]: endDate }
			}
			const sessionDetails = await sessionQueries.findAllSessions(page, limit, search, filters, tenantCode)

			if (
				!sessionDetails ||
				sessionDetails.count == 0 ||
				!sessionDetails.rows ||
				sessionDetails.rows.length == 0
			) {
				return responses.successResponse({
					message: 'SESSION_FETCHED_SUCCESSFULLY',
					statusCode: httpStatusCode.ok,
					result: [],
				})
			}

			sessionDetails.rows = await this.sessionMentorDetails(sessionDetails.rows, tenantCode)

			//remove meeting_info details except value and platform and add is_assigned flag
			sessionDetails.rows.forEach((item) => {
				if (item.meeting_info) {
					item.meeting_info = {
						value: item.meeting_info.value,
						platform: item.meeting_info.platform,
					}
				}
				item.is_assigned = item.mentor_id !== item.created_by
			})
			// const uniqueOrgIds = [...new Set(sessionDetails.rows.map((obj) => obj.mentor_organization_id))]
			const uniqueOrgIds = [...new Set(sessionDetails.rows.map((obj) => obj.organization.organization_code))]

			sessionDetails.rows = await entityTypeService.processEntityTypesToAddValueLabels(
				sessionDetails.rows,
				uniqueOrgIds,
				common.sessionModelName,
				'mentor_organization_id',
				[],
				[tenantCode]
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSION_FETCHED_SUCCESSFULLY',
				result: { count: sessionDetails.count, data: sessionDetails.rows },
			})
		} catch (error) {
			throw error
		}
	}
}
