'use strict'
// Dependenices
const common = require('@constants/common')
const mentorQueries = require('@database/queries/mentorExtension')
const menteeQueries = require('@database/queries/userExtension')
const httpStatusCode = require('@generics/http-status')
const sessionQueries = require('@database/queries/sessions')
const adminService = require('./admin')
const entityTypeQueries = require('@database/queries/entityType')
const userRequests = require('@requests/user')
const utils = require('@generics/utils')
const _ = require('lodash')
const questionSetQueries = require('../database/queries/question-set')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const cacheHelper = require('@generics/cacheHelper')
const cacheService = require('@helpers/cache')

module.exports = class OrgAdminService {
	/**
	 * @description 					- Change user's role based on the current role.
	 * @method
	 * @name 							- roleChange
	 * @param {Object} bodyData 		- The request body containing user data.
	 * @returns {Promise<Object>} 		- A Promise that resolves to a response object.
	 */

	static async roleChange(bodyData, updateData = {}, tenantCode) {
		try {
			bodyData.user_id = bodyData.user_id.toString()
			if (
				utils.validateRoleAccess(bodyData.current_roles, common.MENTOR_ROLE) &&
				utils.validateRoleAccess(bodyData.new_roles, common.MENTEE_ROLE)
			) {
				return await this.changeRoleToMentee(bodyData, updateData, tenantCode)
			} else if (
				utils.validateRoleAccess(bodyData.current_roles, common.MENTEE_ROLE) &&
				utils.validateRoleAccess(bodyData.new_roles, common.MENTOR_ROLE)
			) {
				return await this.changeRoleToMentor(bodyData, updateData, tenantCode)
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * @description 				- Change user's role to Mentee.
	 * @method
	 * @name 						- changeRoleToMentee
	 * @param {Object} bodyData 	- The request body.
	 * @returns {Object} 			- A Promise that resolves to a response object.
	 */
	static async changeRoleToMentee(bodyData, updateData = {}, tenantCode) {
		try {
			// Check current role based on that swap data
			// If current role is mentor validate data from mentor_extenion table
			let mentorDetails = await cacheService.getMentorExtensionCached(bodyData.user_id, [], true, tenantCode)
			// If such mentor return error
			if (!mentorDetails) {
				return responses.failureResponse({
					message: 'MENTOR_EXTENSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (bodyData.organization_id) {
				bodyData.organization_id = bodyData.organization_id.toString()
				mentorDetails.organization_id = bodyData.organization_id
				const organizationDetails = await userRequests.fetchOrgDetails({
					organizationId: bodyData.organization_id,
					tenantCode,
				})
				if (!(organizationDetails.success && organizationDetails.data && organizationDetails.data.result)) {
					return responses.failureResponse({
						message: 'ORGANIZATION_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				const orgPolicies = await cacheService.findOrInsertOrganizationExtensionCached(
					bodyData.organization_id,
					bodyData.organization_code,
					organizationDetails.data.result.name,
					tenantCode
				)
				if (!orgPolicies?.organization_id) {
					return responses.failureResponse({
						message: 'ORG_EXTENSION_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				mentorDetails.organization_id = bodyData.organization_id
				const newPolicy = await this.constructOrgPolicyObject(orgPolicies)
				mentorDetails = _.merge({}, mentorDetails, newPolicy, updateData)
				mentorDetails.visible_to_organizations = Array.from(
					new Set([...(organizationDetails.data.result.related_orgs || []), bodyData.organization_id])
				)
			}
			mentorDetails.is_mentor = false
			if (mentorDetails.email) delete mentorDetails.email
			// Add fetched mentor details to user_extension table
			const menteeCreationData = await menteeQueries.updateMenteeExtension(
				bodyData.user_id,
				mentorDetails,
				{},
				{},
				tenantCode
			)
			if (!menteeCreationData) {
				return responses.failureResponse({
					message: 'MENTEE_EXTENSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
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
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			// Delete upcoming sessions of user as mentor
			const removedSessionsDetail = await sessionQueries.removeAndReturnMentorSessions(bodyData.user_id)
			const isAttendeesNotified = await adminService.unenrollAndNotifySessionAttendees(
				removedSessionsDetail,
				mentorDetails.organization_id ? mentorDetails.organization_id : '',
				{ [Op.in]: [bodyData.organization_code, defaults.orgCode] },
				{ [Op.in]: [tenantCode, defaults.tenantCode] },
				tenantCode,
				orgCode
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'USER_ROLE_UPDATED',
				result: {
					user_id: menteeCreationData.user_id,
					roles: bodyData.new_roles,
				},
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * @description 				- Change user's role to Mentor.
	 * @method
	 * @name 						- changeRoleToMentor
	 * @param {Object} bodyData 	- The request body containing user data.
	 * @returns {Promise<Object>} 	- A Promise that resolves to a response object.
	 */

	static async changeRoleToMentor(bodyData, updateData = {}, tenantCode) {
		try {
			// Get mentee_extension data
			let menteeDetails = await cacheService.getMenteeExtensionCached(bodyData.user_id, [], true, tenantCode)

			// If no mentee present return error
			if (!menteeDetails) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'MENTEE_EXTENSION_NOT_FOUND',
				})
			}

			if (bodyData.organization_id) {
				bodyData.organization_code = bodyData.organization_code.toString()
				let organizationDetails = await userRequests.fetchOrgDetails({
					organizationCode: bodyData.organization_code,
					tenantCode,
				})
				if (!(organizationDetails.success && organizationDetails.data && organizationDetails.data.result)) {
					return responses.failureResponse({
						message: 'ORGANIZATION_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				const orgPolicies = await cacheService.findOrInsertOrganizationExtensionCached(
					bodyData.organization_id,
					bodyData.organization_code,
					organizationDetails.data.result.name,
					tenantCode
				)
				if (!orgPolicies?.organization_id) {
					return responses.failureResponse({
						message: 'ORG_EXTENSION_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				menteeDetails.organization_id = bodyData.organization_id
				menteeDetails.organization_code = bodyData.organization_code
				const newPolicy = await this.constructOrgPolicyObject(orgPolicies)
				menteeDetails = _.merge({}, menteeDetails, newPolicy, updateData)
				menteeDetails.visible_to_organizations = Array.from(
					new Set([...(organizationDetails.data.result.related_orgs || []), bodyData.organization_id])
				)
			}

			if (menteeDetails.email) delete menteeDetails.email
			// Add fetched mentee details to mentor_extension table
			const mentorCreationData = await mentorQueries.updateMentorExtension(
				bodyData.user_id,
				menteeDetails,
				'',
				'',
				true,
				tenantCode
			)

			if (!mentorCreationData) {
				return responses.failureResponse({
					message: 'MENTOR_EXTENSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'USER_ROLE_UPDATED',
				result: {
					user_id: bodyData.user_id,
					roles: bodyData.new_roles,
				},
			})
		} catch (error) {
			throw error
		}
	}

	static async setOrgPolicies(decodedToken, policies, tenantCode) {
		try {
			const orgPolicies = await organisationExtensionQueries.upsert({
				organization_id: decodedToken.organization_id,
				...policies,
				created_by: decodedToken.id,
				updated_by: decodedToken.id,
			})
			const orgPolicyUpdated =
				new Date(orgPolicies.dataValues.created_at).getTime() !==
				new Date(orgPolicies.dataValues.updated_at).getTime()

			// If org policies updated update mentor and mentee extensions under the org
			if (orgPolicyUpdated) {
				// if org policy is updated update mentor extension and user extension
				let policyData = await this.constructOrgPolicyObject(orgPolicies.dataValues)

				if (
					policyData?.external_mentor_visibility == common.ASSOCIATED ||
					policyData?.mentor_visibility_policy == common.ASSOCIATED ||
					policyData?.external_mentee_visibility == common.ASSOCIATED ||
					policyData?.mentee_visibility_policy == common.ASSOCIATED
				) {
					const organizationDetails = await userRequests.fetchOrgDetails({
						organizationId: decodedToken.organization_id,
						tenantCode,
					})
					policyData.visible_to_organizations = organizationDetails.data.result.related_orgs || []

					if (!policyData.visible_to_organizations.includes(decodedToken.organization_id)) {
						policyData.visible_to_organizations.push(decodedToken.organization_id)
					}
				} else {
					policyData.visible_to_organizations = []
				}

				//Update all users belonging to the org with new policies
				await menteeQueries.updateMenteeExtension(
					'', //userId not required
					policyData, // data to update
					{}, //options
					{ organization_id: decodedToken.organization_id }, //custom filter for where clause
					tenantCode
				)
				// commenting as part of first level SAAS changes. will need this in the code next level
				// await sessionQueries.updateSession(
				// 	{
				// 		status: common.PUBLISHED_STATUS,
				// 		mentor_org_ id: decodedToken.organization _id
				// 	},
				// 	{
				// 		visibility: orgPolicies.dataValues.session_visibility_policy
				// 	}
				// )
			}

			delete orgPolicies.dataValues.deleted_at
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ORG_POLICIES_SET_SUCCESSFULLY',
				result: { ...orgPolicies.dataValues },
			})
		} catch (error) {
			throw new Error(`Error setting organisation policies: ${error.message}`)
		}
	}

	static async getOrgPolicies(decodedToken, tenantCode) {
		try {
			const orgPolicies = await cacheService.findOneOrganizationCached(
				{
					organization_code: decodedToken.organization_code,
				},
				tenantCode
			)
			if (orgPolicies) {
				delete orgPolicies.deleted_at
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ORG_POLICIES_FETCHED_SUCCESSFULLY',
					result: { ...orgPolicies },
				})
			} else {
				throw new Error(`No organisation extension found for organization_id ${decodedToken.organization_id}`)
			}
		} catch (error) {
			throw new Error(`Error reading organisation policies: ${error.message}`)
		}
	}

	/**
	 * @description 					- Inherit new entity type from an existing default org's entityType.
	 * @method
	 * @name 							- inheritEntityType
	 * @param {String} entityValue 		- Entity type value
	 * @param {String} entityLabel 		- Entity type label
	 * @param {Integer} userOrgId 		- User org id
	 * @param {Object} decodedToken 	- User token details
	 * @returns {Promise<Object>} 		- A Promise that resolves to a response object.
	 */

	static async inheritEntityType(entityValue, entityLabel, userOrgId, decodedToken, tenantCode) {
		try {
			// Get default organisation details
			let defaultOrgDetails = await userRequests.fetchOrgDetails({
				organizationCode: process.env.DEFAULT_ORGANISATION_CODE,
			})

			let defaultOrgId
			if (defaultOrgDetails.success && defaultOrgDetails.data && defaultOrgDetails.data.result) {
				defaultOrgId = defaultOrgDetails.data.result.id
			} else {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (defaultOrgId === userOrgId) {
				return responses.failureResponse({
					message: 'USER_IS_FROM_DEFAULT_ORG',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Fetch entity type data using defaultOrgId and entityValue
			const filter = {
				value: entityValue,
				organization_id: defaultOrgId,
				allow_filtering: true,
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
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			let entityTypeDetails = await cacheService.findOneEntityTypeCached(filter, {
				[Op.in]: [defaults.tenantCode, tenantCode],
			})

			// If no matching data found return failure response
			if (!entityTypeDetails) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Build data for inheriting entityType
			entityTypeDetails.parent_id = entityTypeDetails.id
			entityTypeDetails.label = entityLabel
			entityTypeDetails.organization_id = userOrgId
			entityTypeDetails.created_by = decodedToken.id
			entityTypeDetails.updated_by = decodedToken.id
			delete entityTypeDetails.id

			// Create new inherited entity type
			let inheritedEntityType = await entityTypeQueries.createEntityType(
				entityTypeDetails,
				decodedToken.tenant_code
			)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ENTITY_TYPE_CREATED_SUCCESSFULLY',
				result: inheritedEntityType,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Update User Organization.
	 * @method
	 * @name updateOrganization
	 * @param {Object} bodyData
	 * @returns {JSON} - User data.
	 */
	static async updateOrganization(bodyData, tenantCode) {
		try {
			bodyData.user_id = bodyData.user_id.toString()
			bodyData.organization_id = bodyData.organization_id.toString()
			const orgId = bodyData.organization_id
			// Get organization details
			let organizationDetails = await userRequests.fetchOrgDetails({ organizationId: orgId, tenantCode })
			if (!(organizationDetails.success && organizationDetails.data && organizationDetails.data.result)) {
				return responses.failureResponse({
					message: 'ORGANIZATION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
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
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			// Get organization policies
			const orgPolicies = await cacheService.findOrInsertOrganizationExtensionCached(
				orgId,
				bodyData.organization_code,
				organizationDetails.data.result.name,
				tenantCode
			)
			if (!orgPolicies?.organization_id) {
				return responses.failureResponse({
					message: 'ORG_EXTENSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//Update the policy
			const updateData = {
				organization_id: orgId,
				external_session_visibility: orgPolicies.external_session_visibility_policy,
				external_mentor_visibility: orgPolicies.external_mentor_visibility_policy,
				mentor_visibility: orgPolicies.mentor_visibility_policy,
				mentee_visibility: orgPolicies.mentee_visibility_policy,
				external_mentee_visibility: orgPolicies.external_mentee_visibility_policy,
				visible_to_organizations: organizationDetails.data.result.related_orgs || [],
			}
			if (!updateData.visible_to_organizations.includes(orgId)) {
				updateData.visible_to_organizations.push(orgId)
			}

			if (utils.validateRoleAccess(bodyData.roles, common.MENTOR_ROLE))
				await mentorQueries.updateMentorExtension(bodyData.user_id, updateData, {}, {}, false, tenantCode)
			else await menteeQueries.updateMenteeExtension(bodyData.user_id, updateData, {}, {}, tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'UPDATE_ORG_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Deactivate upcoming session.
	 * @method
	 * @name deactivateUpcomingSession
	 * @param {Object} bodyData
	 * @returns {JSON} - User data.
	 */
	static async deactivateUpcomingSession(userIds, tenantCode, orgCode) {
		try {
			userIds = userIds.map(String)
			let deactivatedIdsList = []
			let failedUserIds = []
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
			for (let key in userIds) {
				const userId = userIds[key]
				let mentorDetails = await cacheService.getMentorExtensionCached(userId, [], false, tenantCode)
				if (mentorDetails?.user_id) {
					// Deactivate upcoming sessions of user as mentor
					const removedSessionsDetail = await sessionQueries.deactivateAndReturnMentorSessions(
						userId,
						tenantCode
					)
					await adminService.unenrollAndNotifySessionAttendees(
						removedSessionsDetail,
						{ [Op.in]: [orgCode, defaults.orgCode] },
						{ [Op.in]: [tenantCode, defaults.tenantCode] },
						tenantCode,
						orgCode
					)
					deactivatedIdsList.push(userId)
				}

				//unenroll from upcoming session
				const menteeDetails = await cacheService.getMenteeExtensionCached(userId, [], false, tenantCode)
				if (menteeDetails?.user_id) {
					await adminService.unenrollFromUpcomingSessions(userId, tenantCode)
					deactivatedIdsList.push(userId)
				}

				if (!mentorDetails?.user_id && !menteeDetails?.user_id) {
					failedUserIds.push(userId)
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: failedUserIds.length > 0 ? 'SESSION_DEACTIVATION_FAILED' : 'SESSION_DEACTIVATED_SUCCESSFULLY',
				result: {
					deactivatedIdsList: deactivatedIdsList,
					failedUserIds: failedUserIds,
				},
			})
		} catch (error) {
			throw error
		}
	}
	/**
	 * @description 							- constuct organisation policy object for mentor_extension/user_extension.
	 * @method
	 * @name 									- constructOrgPolicyObject
	 * @param {Object} organisationPolicy 		- organisation policy data
	 * @param {Boolean} addOrgId 				- Boolean that specifies if org_ id needs to be added or not
	 * @returns {Object} 						- A object that reurn a response object.
	 */
	static async constructOrgPolicyObject(organisationPolicy, addOrgId = false) {
		const {
			mentor_visibility_policy,
			external_session_visibility_policy,
			external_mentor_visibility_policy,
			organization_id,
			external_mentee_visibility_policy,
			mentee_visibility_policy,
		} = organisationPolicy
		// create policy object
		let policyData = {
			mentee_visibility: mentee_visibility_policy,
			mentor_visibility: mentor_visibility_policy,
			external_session_visibility: external_session_visibility_policy,
			external_mentor_visibility: external_mentor_visibility_policy,
			external_mentee_visibility: external_mentee_visibility_policy,
		}
		// add org_ id value if requested
		if (addOrgId) {
			policyData.organization_id = organization_id
		}
		return policyData
	}

	/**
	 * @description 							- update related organization of mentees and mentors if there is an update in the organization
	 * @method									- POST
	 * @name 									- updateRelatedOrgs
	 * @param {Array} relatedOrgs 		 		- Array of related organization passed
	 * @param {Number} orgId 					- Specific orgId which was updated
	 * @param {Object} organizationDetails 		- Object of organization details of the related org from user service.
	 * @returns {Object} 						- A object that reurn a response object.
	 */
	static async updateRelatedOrgs(deltaOrganizationIds, orgId, action, tenantCode) {
		try {
			orgId = orgId.toString()
			deltaOrganizationIds = deltaOrganizationIds.map(String)
			if (action === common.PUSH) {
				await menteeQueries.addVisibleToOrg(orgId, deltaOrganizationIds, tenantCode)
			} else if (action === common.POP) {
				await menteeQueries.removeVisibleToOrg(orgId, deltaOrganizationIds, tenantCode)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RELATED_ORG_UPDATED',
			})
		} catch (error) {
			throw error
		}
	}

	static async setDefaultQuestionSets(bodyData, decodedToken, tenantCode) {
		try {
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

			const questionSets = await questionSetQueries.findQuestionSets(
				{
					code: { [Op.in]: [bodyData.mentee_feedback_question_set, bodyData.mentor_feedback_question_set] },
					tenant_code: defaults.tenantCode,
				},
				['id', 'code']
			)
			if (
				questionSets.length === 0 ||
				(questionSets.length === 1 &&
					bodyData.mentee_feedback_question_set !== bodyData.mentor_feedback_question_set)
			) {
				return responses.failureResponse({
					message: 'QUESTIONS_SET_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			const extensionData = {
				organization_id: decodedToken.id,
				mentee_feedback_question_set: bodyData.mentee_feedback_question_set,
				mentor_feedback_question_set: bodyData.mentor_feedback_question_set,
				updated_by: decodedToken.id,
			}
			const orgExtension = await organisationExtensionQueries.upsert(extensionData, tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ORG_DEFAULT_QUESTION_SETS_SET_SUCCESSFULLY',
				result: {
					organization_id: orgExtension.organization_id,
					mentee_feedback_question_set: orgExtension.mentee_feedback_question_set,
					mentor_feedback_question_set: orgExtension.mentor_feedback_question_set,
					updated_by: orgExtension.updated_by,
				},
			})
		} catch (error) {
			return error
		}
	}

	static async uploadSampleCSV(filepath, orgCode, tenantCode) {
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

		const newData = { uploads: { session_csv_path: filepath } }
		if (orgId != defaults.orgCode) {
			let result = await organisationExtensionQueries.update(newData, orgCode, tenantCode)
			if (!result) {
				return responses.failureResponse({
					message: 'CSV_UPDATE_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CSV_UPLOADED_SUCCESSFULLY',
			})
		}
		return responses.failureResponse({
			message: 'CSV_UPDATE_FAILED',
			statusCode: httpStatusCode.bad_request,
			responseCode: 'CLIENT_ERROR',
		})
	}

	/**
	 * Update the theme for a specific organization.
	 * @method
	 * @name updateTheme
	 * @param {Object} data - The theme data to be updated.
	 * @param {String} orgId - The organization ID for which the theme needs to be updated.
	 * @returns {Object} - The result of the theme update, either success or error details.
	 */
	static async updateTheme(data, orgCode, tenantCode) {
		let organizationDetails = await userRequests.fetchOrgDetails({ organizationCode: orgCode, tenantCode })
		if (!(organizationDetails.success && organizationDetails.data && organizationDetails.data.result)) {
			return responses.failureResponse({
				message: 'ORGANIZATION_NOT_FOUND',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		const newData = { theme: data }
		let result = await organisationExtensionQueries.update(newData, orgCode, tenantCode)
		if (!result) {
			return responses.failureResponse({
				message: 'FAILED_TO_UPDATED_ORG_THEME',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
		return responses.successResponse({
			statusCode: httpStatusCode.ok,
			message: 'ORG_THEME_UPDATED_SUCCESSFULLY',
		})
	}

	static async themeDetails(orgCode, tenantCode) {
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
		let organizationDetails = await cacheService.findOneOrganizationCached(
			{
				organization_code: { [Op.in]: [defaults.orgCode, orgCode] },
			},
			tenantCode
		)

		if (!organizationDetails) {
			return responses.failureResponse({
				message: 'ORGANIZATION_NOT_FOUND',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		return responses.successResponse({
			statusCode: httpStatusCode.ok,
			message: 'ORG_THEME_FETCHED_SUCCESSFULLY',
			result: organizationDetails.theme,
		})
	}
}
