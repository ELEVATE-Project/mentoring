// services/helpers/sessionCreationHelper.js

const sessionQueries = require('@database/queries/sessions')
const mentorExtensionQueries = require('@database/queries/mentorExtension')
const menteeExtensionQueries = require('@database/queries/userExtension')
const entityTypeQueries = require('@database/queries/entityType')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const userRequests = require('@requests/user')
const utils = require('@generics/utils')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const moment = require('moment-timezone')
const { getDefaultOrgId } = require('@helpers/getDefaultOrgId')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const { Op } = require('sequelize')

class SessionCreationHelper {
	/**
	 * Create session specifically for session request acceptance
	 * This is a simplified version without circular dependencies
	 */
	static async createSessionFromRequest(bodyData, mentorUserId, orgId, isMentor = true) {
		try {
			// Basic validation
			if (bodyData?.mentees?.includes(bodyData?.mentor_id)) {
				return responses.failureResponse({
					message: 'SESSION_MENTOR_ADDED_TO_MENTEE_LIST',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Set required fields
			bodyData.created_by = mentorUserId
			bodyData.updated_by = mentorUserId
			bodyData.type = bodyData.type?.toUpperCase() || common.SESSION_TYPE.PRIVATE
			bodyData.status = common.PUBLISHED_STATUS

			// Validate mentor
			const mentorDetails = await mentorExtensionQueries.getMentorExtension(mentorUserId)
			if (!mentorDetails) {
				return responses.failureResponse({
					message: 'INVALID_PERMISSION',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Validate duration
			const duration = moment.duration(moment.unix(bodyData.end_date).diff(moment.unix(bodyData.start_date)))
			const elapsedMinutes = duration.asMinutes()

			if (elapsedMinutes < 30) {
				return responses.failureResponse({
					message: 'BELOW_MINIMUM_SESSION_TIME',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (elapsedMinutes > 1440) {
				return responses.failureResponse({
					message: 'EXCEEDED_MAXIMUM_SESSION_TIME',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Check time slot availability
			const timeSlot = await this.isTimeSlotAvailable(mentorUserId, bodyData.start_date, bodyData.end_date)
			if (timeSlot.isTimeSlotAvailable === false) {
				return responses.failureResponse({
					message: { key: 'INVALID_TIME_SELECTION', interpolation: { sessionName: timeSlot.sessionName } },
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Get mentor name
			const userDetails = await mentorExtensionQueries.getMentorExtension(mentorUserId, ['name', 'email'], true)
			if (userDetails && userDetails.name) {
				bodyData.mentor_name = userDetails.name
			}

			// Set default meeting info if not provided
			if (!bodyData.meeting_info) {
				bodyData.meeting_info = {
					platform: process.env.DEFAULT_MEETING_SERVICE,
					value: process.env.DEFAULT_MEETING_SERVICE,
				}
				if (process.env.DEFAULT_MEETING_SERVICE === common.BBB_VALUE) {
					bodyData.meeting_info = {
						platform: common.BBB_PLATFORM,
						value: common.BBB_VALUE,
					}
				}
			}

			// Set organization data
			bodyData['mentor_organization_id'] = orgId

			// Get organization details
			const userOrgDetails = await userRequests.fetchOrgDetails({ organizationId: orgId })
			if (!userOrgDetails.success || !userOrgDetails.data || !userOrgDetails.data.result) {
				return responses.failureResponse({
					message: 'ORGANISATION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Get organization policy
			const organisationPolicy = await organisationExtensionQueries.findOrInsertOrganizationExtension(
				orgId,
				userOrgDetails.data.result.name
			)

			bodyData.visibility = organisationPolicy.session_visibility_policy
			bodyData.visible_to_organizations = userOrgDetails.data.result.related_orgs
				? userOrgDetails.data.result.related_orgs.concat([orgId])
				: [orgId]

			if (organisationPolicy.mentee_feedback_question_set) {
				bodyData.mentee_feedback_question_set = organisationPolicy.mentee_feedback_question_set
			}
			if (organisationPolicy.mentor_feedback_question_set) {
				bodyData.mentor_feedback_question_set = organisationPolicy.mentor_feedback_question_set
			}

			// Entity validation (simplified)
			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId) {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const sessionModelName = await sessionQueries.getModelName()
			const entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_id: { [Op.in]: [orgId, defaultOrgId] },
				model_names: { [Op.contains]: [sessionModelName] },
			})

			const validationData = removeDefaultOrgEntityTypes(entityTypes, orgId)
			const res = utils.validateInput(bodyData, validationData, sessionModelName, true) // skipValidation = true for private sessions

			if (!res.success) {
				return responses.failureResponse({
					message: 'SESSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}

			const sessionModel = await sessionQueries.getColumns()
			bodyData = utils.restructureBody(bodyData, validationData, sessionModel)

			// Create session
			const sessionData = await sessionQueries.create(bodyData)

			if (!sessionData?.id) {
				return responses.failureResponse({
					message: 'SESSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Set passwords
			await this.setSessionPasswords(sessionData.id, mentorUserId, sessionData.created_at)

			// Process response
			const processDbResponse = utils.processDbResponse(sessionData.toJSON(), validationData)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'SESSION_CREATED_SUCCESSFULLY',
				result: processDbResponse,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	/**
	 * Check if time slot is available for mentor
	 */
	static async isTimeSlotAvailable(mentorId, startDate, endDate, sessionId = null) {
		try {
			const sessions = await sessionQueries.getSessionByUserIdAndTime(mentorId, startDate, endDate, sessionId)

			if (
				!sessions ||
				(sessions.startDateResponse.length < process.env.SESSION_CREATION_MENTOR_LIMIT &&
					sessions.endDateResponse.length < process.env.SESSION_CREATION_MENTOR_LIMIT)
			) {
				return { isTimeSlotAvailable: true }
			}

			const startDateResponse = sessions.startDateResponse?.[0]
			const endDateResponse = sessions.endDateResponse?.[0]

			if (startDateResponse && endDateResponse && startDateResponse.id !== endDateResponse.id) {
				return {
					isTimeSlotAvailable: false,
					sessionName: `${startDateResponse.title} and ${endDateResponse.title}`,
				}
			}

			if (startDateResponse || endDateResponse) {
				return {
					isTimeSlotAvailable: false,
					sessionName: (startDateResponse || endDateResponse).title,
				}
			}

			return { isTimeSlotAvailable: true }
		} catch (error) {
			console.error('Error checking time slot availability:', error)
			throw error
		}
	}

	/**
	 * Set passwords for session
	 */
	static async setSessionPasswords(sessionId, mentorId, createdAt) {
		try {
			const mentorPassword = utils.hash('' + sessionId + mentorId + '')
			const menteePassword = utils.hash(sessionId + createdAt)

			await sessionQueries.updateOne(
				{ id: sessionId },
				{
					mentor_password: mentorPassword,
					mentee_password: menteePassword,
				}
			)

			return { mentorPassword, menteePassword }
		} catch (error) {
			console.error('Error setting session passwords:', error)
			throw error
		}
	}
}

module.exports = SessionCreationHelper
