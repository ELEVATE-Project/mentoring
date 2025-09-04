/**
 * name : sessions.js
 * author : Aman
 * created-date : 07-Oct-2021
 * Description : Sessions.
 */

// Dependencies
const sessionService = require('@services/sessions')
const { isAMentor } = require('@generics/utils')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')

module.exports = class Sessions {
	/**
	 * Update Sessions
	 * @method
	 * @name update
	 * @param {Object} req -request data.
	 * @param {String} [req.params.id] - Session id.
	 * @param {String} req.headers.timezone - Session timezone.
	 * @param {String} req.decodedToken._id - User Id.
	 * @param {Object} req.body - requested body data.
	 * @returns {JSON} - Create/update session.
	 */

	async update(req) {
		try {
			// check if notifyUser is true or false. By default true
			const notifyUser = req.query.notifyUser ? req.query.notifyUser.toLowerCase() === 'true' : true
			if (req.params.id) {
				if (req.headers.timezone) {
					req.body['time_zone'] = req.headers.timezone
				}

				const sessionUpdated = await sessionService.update(
					req.params.id,
					req.body,
					req.decodedToken.id,
					req.method,
					req.decodedToken.organization_id,
					req.decodedToken.organization_code,
					notifyUser,
					req.decodedToken.tenant_code
				)

				return sessionUpdated
			} else {
				if (req.headers.timezone) {
					req.body['time_zone'] = req.headers.timezone
				}
				const sessionCreated = await sessionService.create(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_id,
					req.decodedToken.organization_code,
					isAMentor(req.decodedToken.roles),
					notifyUser,
					req.decodedToken.tenant_code
				)

				return sessionCreated
			}
		} catch (error) {
			return error
		}
	}

	/**
	 * Sessions details
	 * @method
	 * @name details
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session id.
	 * @param {String} req.decodedToken._id - User Id.
	 * @returns {JSON} - Session Details.
	 */

	async details(req) {
		try {
			const sessionDetails = await sessionService.details(
				req.params.id,
				req.decodedToken ? req.decodedToken.id : '',
				req.decodedToken ? isAMentor(req.decodedToken.roles) : '',
				req.query,
				req.decodedToken.roles,
				req.decodedToken.organization_code,
				req.decodedToken ? req.decodedToken.tenant_code : ''
			)
			return sessionDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * Get all upcoming sessions by available mentors
	 * @method
	 * @name list
	 * @param {Object} req -request data.
	 * @param {String} req.decodedToken.id - User Id.
	 * @param {String} req.pageNo - Page No.
	 * @param {String} req.pageSize - Page size limit.
	 * @param {String} req.searchText - Search text.
	 * @returns {JSON} - Session List.
	 */

	async list(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const sessionDetails = await sessionService.list(
				userId,
				req.pageNo,
				req.pageSize,
				req.searchText,
				req.searchOn,
				req.query,
				isAMentor(req.decodedToken.roles),
				req.decodedToken.roles,
				organizationCode,
				tenantCode
			)
			return sessionDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * Share Session
	 * @method
	 * @name share
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @returns {JSON} - Share session.
	 */

	async share(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code

			const shareSessionDetails = await sessionService.share(req.params.id, tenantCode)
			return shareSessionDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * Enroll Session
	 * @method
	 * @name share
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @param {Object} req.decodedToken - token information.
	 * @param {String} req.headers.timeZone - timeZone.
	 * @returns {JSON} - Enroll session.
	 */

	async enroll(req) {
		try {
			const isSelfEnrolled = true
			const session = {}
			const enrolledSession = await sessionService.enroll(
				req.params.id,
				req.decodedToken,
				req.headers['timezone'],
				isAMentor(req.decodedToken.roles),
				isSelfEnrolled,
				session,
				req.decodedToken.roles,
				req.decodedToken.organization_id,
				req.decodedToken.organization_code,
				req.decodedToken.tenant_code
			)
			return enrolledSession
		} catch (error) {
			return error
		}
	}

	/**
	 * UnEnroll Session
	 * @method
	 * @name unEnroll
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @param {Object} req.decodedToken - token information.
	 * @returns {JSON} - UnEnroll user session.
	 */

	async unEnroll(req) {
		try {
			const unEnrolledSession = await sessionService.unEnroll(
				req.params.id,
				req.decodedToken,
				true,
				{},
				req.decodedToken.tenant_code
			)
			return unEnrolledSession
		} catch (error) {
			return error
		}
	}

	/**
	 * Start Session.
	 * @method
	 * @name start
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @param {Object} req.decodedToken - token information.
	 * @returns {JSON} - Started Mentor session.
	 */

	async start(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code

			const sessionsStarted = await sessionService.start(req.params.id, req.decodedToken, tenantCode)
			return sessionsStarted
		} catch (error) {
			return error
		}
	}

	/**
	 * Completed Session.
	 * @method
	 * @name completed
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @returns {JSON} - Completed session callback url.
	 */

	async completed(req) {
		try {
			console.log('=== SESSION COMPLETION CONTROLLER START ===')
			console.log('Session ID:', req.params.id)
			console.log('Request method:', req.method)
			console.log('Query params:', req.query)
			console.log('Has decodedToken:', !!req.decodedToken)

			let tenantCode = req.decodedToken?.tenant_code
			console.log('Initial tenantCode from JWT:', tenantCode)

			// For scheduled jobs or BBB callbacks without tokens, get tenant_code from session
			if (!tenantCode) {
				console.log('No tenantCode from JWT, fetching from session...')
				const sessionData = await sessionService.getSessionTenantCode(req.params.id)
				tenantCode = sessionData?.tenant_code
				console.log('TenantCode from session:', tenantCode)
			}

			const isBBB = req.query.source == common.BBB_VALUE ? true : false
			console.log('Is BBB callback:', isBBB)

			console.log('Calling sessionService.completed with params:', {
				sessionId: req.params.id,
				isBBB,
				tenantCode,
			})

			const sessionsCompleted = await sessionService.completed(req.params.id, isBBB, tenantCode)

			console.log('Session completion result status:', sessionsCompleted?.statusCode)
			console.log('=== SESSION COMPLETION CONTROLLER END ===')

			return sessionsCompleted
		} catch (error) {
			console.log('=== SESSION COMPLETION CONTROLLER ERROR ===')
			console.log('Error:', error.message)
			console.log('=== SESSION COMPLETION CONTROLLER ERROR END ===')
			return error
		}
	}

	/**
	 * Get session recording.
	 * @method
	 * @name getRecording
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @returns {JSON} - Session recorded url.
	 */

	async getRecording(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code

			const recording = await sessionService.getRecording(req.params.id, tenantCode)
			return recording
		} catch (error) {
			return error
		}
	}

	/**
	 * Session feedback.
	 * @method
	 * @name feedback
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @param {body} req.body - feedback body data.
	 * @returns {JSON} - Session feedback information.
	 */

	async feedback(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const sessionsFeedBack = await sessionService.feedback(
				req.params.id,
				req.body,
				userId,
				organizationCode,
				tenantCode
			)
			return sessionsFeedBack
		} catch (error) {
			return error
		}
	}

	/**
	 * Update recording link
	 * @method
	 * @name updateRecordingUrl
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - internalMeetingId
	 * @param {String} req.body.recordingUrl - Recording cloud storage url
	 * @returns {JSON} - Recording url updated
	 */

	async updateRecordingUrl(req) {
		const internalMeetingId = req.params.id
		const recordingUrl = req.body.recordingUrl
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const sessionUpdated = await sessionService.updateRecordingUrl(
				internalMeetingId,
				recordingUrl,
				userId,
				organizationCode,
				tenantCode
			)
			return sessionUpdated
		} catch (error) {
			return error
		}
	}

	/**
	 * Updates mentor names in bulk for sessions.
	 * @method
	 * @name bulkUpdateMentorNames
	 * @param {Object} req - Request data.
	 * @param {Array} req.body.mentor_id - Array of mentor IDs.
	 * @param {STRING} req.body.mentor_name - Array of corresponding mentor names.
	 * @returns {Object} - Information about the bulk update process.
	 * @throws {Error} - Throws an error if there's an issue during the bulk update.
	 */
	async bulkUpdateMentorNames(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const sessionUpdated = await sessionService.bulkUpdateMentorNames(
				req.body.mentor_id,
				req.body.mentor_name,
				userId,
				organizationCode,
				tenantCode
			)
			return sessionUpdated
		} catch (error) {
			return error
		}
	}
	/**
	 * Retrieves details of mentees enrolled in a session.
	 *
	 * @method
	 * @name enrolledMentees
	 * @param {Object} req - Request data.
	 * @param {string} req.params.id - ID of the session.
	 * @param {Object} req.query - Query parameters.
	 * @param {string} req.decodedToken.id - ID of the authenticated user.
	 * @returns {Promise<Object>} - A promise that resolves with the success response containing details of enrolled mentees.
	 * @throws {Error} - Throws an error if there's an issue during data retrieval.
	 */

	async enrolledMentees(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			return await sessionService.enrolledMentees(req.params.id, req.query, userId, organizationCode, tenantCode)
		} catch (error) {
			throw error
		}
	}

	/**
	 * Add mentees to session
	 * @method
	 * @name addMentees
	 * @param {Object} req 				- request data.
	 * @param {String} req.params.id 	- Session id.
	 * @returns {JSON} 					- enrollment status.
	 */

	async addMentees(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const sessionDetails = await sessionService.addMentees(
				req.params.id, // session id
				req.body.mentees, // Array of mentee ids
				req.headers['timezone'],
				userId,
				req.decodedToken.organization_id, // organizationId
				organizationCode, // organizationCode
				tenantCode
			)
			return sessionDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * Remove mentees from a session
	 * @method
	 * @name removeMentees
	 * @param {Object} req 				-request data.
	 * @param {String} req.params.id 	- Session id.
	 * @returns {JSON} 					- Unenroll Details.
	 */

	async removeMentees(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const sessionDetails = await sessionService.removeMentees(
				req.params.id, // session id
				req.body.mentees, // Array of mentee ids
				userId,
				organizationCode,
				tenantCode
			)
			return sessionDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * Bulk session upload
	 * @method
	 * @name BulkSessionCreation
	 * @param {String} req.body.file_path -Uploaded filr path .
	 * @returns {Object} - uploaded file response.
	 */
	async bulkSessionCreate(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const sessionUploadRes = await sessionService.bulkSessionCreate(
				req.body.file_path,
				userId,
				organizationCode,
				tenantCode,
				req.decodedToken.organizations[0].id
			)
			return sessionUploadRes
		} catch (error) {
			return error
		}
	}

	/**
	 * Get sample bulk upload csv downloadable Url
	 * @method
	 * @name getSampleCSV
	 * @param {JSON} req  request body.
	 * @returns {JSON} Response with status message and result.
	 */
	async getSampleCSV(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code

			const downloadUrlResponse = await sessionService.getSampleCSV(organizationCode, tenantCode)
			return downloadUrlResponse
		} catch (error) {
			return error
		}
	}

	/**
	 * Remove Sessions Of Multiple Mentors In One Go
	 * @method
	 * @name removeAllSessions
	 * @param {JSON} req request body.
	 * @returns {JSON} Response with status message and result.
	 */
	async removeAllSessions(req) {
		try {
			if (req.body.mentorIds && req.body.orgCode)
				return responses.failureResponse({
					message: 'Specify either mentorIds or orgId but not both.',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			else if (!req.body.mentorIds && !req.body.orgCode)
				return responses.failureResponse({
					message: 'Specify at-least mentorIds or orgCode.',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const removedSessionsResponse = await sessionService.removeAllSessions(
				{
					mentorIds: req.body.mentorIds,
					orgCode: req.body.orgCode,
				},
				userId,
				organizationCode,
				tenantCode
			)
			return removedSessionsResponse
		} catch (error) {
			return error
		}
	}
}
