/**
 * name : bigBlueButton.js
 * author : Aman Karki
 * created-date : 09-Nov-2021
 * Description : bigBlueButton methods.
 */

// Dependencies
const bigBlueButtonUrl = process.env.BIG_BLUE_BUTTON_URL + process.env.BIB_BLUE_BUTTON_BASE_URL
const request = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const utils = require('@generics/utils')
const userRequests = require('@requests/user')

/**
 * Create Meeting with enhanced tenant isolation.
 * @method
 * @name createMeeting
 * @param {String} meetingId - meeting Id (also used as session ID for isolation).
 * @param {String} meetingName - meeting name.
 * @param {String} attendeePW - Attendee Password.
 * @param {String} moderatorPW - Moderator Password.
 * @param {Number} sessionDuration - session duration in minutes.
 * @param {String} tenantCode - tenant code for domain resolution and isolation.
 * @returns {String} - Meeting success message.
 * @description Includes sessionId and tenantCode in callback URLs for enhanced isolation and DC benefits.
 */

const createMeeting = function (meetingId, meetingName, attendeePW, moderatorPW, sessionDuration, tenantCode) {
	return new Promise(async (resolve, reject) => {
		try {
			let endMeetingCallBackUrl
			let sessionEndUrl

			// Generate domain-based URLs if tenantCode is provided
			if (tenantCode) {
				try {
					const domain = await userRequests.getTenantDomain(tenantCode)
					// Enhanced isolation: Include both sessionId and tenantCode for better DC routing and caching
					endMeetingCallBackUrl = `https://${domain}/mentoring/v1/sessions/completed/${meetingId}?source=BBB&sessionId=${meetingId}&tenantCode=${tenantCode}`
					sessionEndUrl = `https://${domain}/mentoring/v1/sessions/end?sessionId=${meetingId}&tenantCode=${tenantCode}`

					// URL encode the callback URL for BBB
					endMeetingCallBackUrl = encodeURIComponent(endMeetingCallBackUrl)
				} catch (error) {
					// Error resolving tenant domain, falling back to env vars
					// Fallback to environment variables with enhanced isolation parameters
					endMeetingCallBackUrl =
						process.env.MEETING_END_CALLBACK_EVENTS +
						'%2F' +
						meetingId +
						'%3Fsource%3DBBB%26sessionId%3D' +
						meetingId +
						'%26tenantCode%3D' +
						encodeURIComponent(tenantCode)
					sessionEndUrl =
						process.env.BIG_BLUE_BUTTON_SESSION_END_URL +
						'?sessionId=' +
						meetingId +
						'&tenantCode=' +
						tenantCode
				}
			} else {
				// Fallback to environment variables if no tenantCode provided
				// Include sessionId for basic isolation even without tenantCode
				endMeetingCallBackUrl =
					process.env.MEETING_END_CALLBACK_EVENTS +
					'%2F' +
					meetingId +
					'%3Fsource%3DBBB%26sessionId%3D' +
					meetingId
				sessionEndUrl = process.env.BIG_BLUE_BUTTON_SESSION_END_URL + '?sessionId=' + meetingId
			}
			let lastUserTimeout = process.env.BIG_BLUE_BUTTON_LAST_USER_TIMEOUT_MINUTES || 15

			const hostname = String(tenantUrl || '')
				.replace(/^https?:\/\//i, '')
				.replace(/\/+$/, '')
			if (!hostname) return reject(new Error('TENANT_URL_REQUIRED'))
			let sessionEndUrl = encodeURIComponent(`https://${hostname}/`)

			let lastUserTimeout = process.env.BIG_BLUE_BUTTON_LAST_USER_TIMEOUT_MINUTES || 15
			meetingName = encodeURIComponent(meetingName)
			let query =
				'name=' +
				meetingName +
				'&meetingID=' +
				meetingId +
				'&record=true' +
				'&autoStartRecording=true' +
				'&meta_endCallbackUrl=' +
				endMeetingCallBackUrl +
				'&attendeePW=' +
				attendeePW +
				'&moderatorPW=' +
				moderatorPW +
				'&logoutURL=' +
				sessionEndUrl +
				'&meetingExpireIfNoUserJoinedInMinutes=' +
				sessionDuration +
				'&meetingExpireWhenLastUserLeftInMinutes=' +
				lastUserTimeout

			let checkSumGeneration = 'create' + query + process.env.BIG_BLUE_BUTTON_SECRET_KEY
			const checksum = utils.generateCheckSum(checkSumGeneration)

			const createUrl = bigBlueButtonUrl + endpoints.CREATE_MEETING + '?' + query + '&checksum=' + checksum
			let response = await request.get(createUrl)
			return resolve(response)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Get meeting recordings.
 * @method
 * @name getRecordings
 * @param {String} meetingId - meeting Id.
 * @returns {JSON} - Recording response.
 */

const getRecordings = function (meetingId) {
	return new Promise(async (resolve, reject) => {
		try {
			let checkSumGeneration = 'getRecordingsmeetingID=' + meetingId + process.env.BIG_BLUE_BUTTON_SECRET_KEY
			const checksum = utils.generateCheckSum(checkSumGeneration)

			const meetingInfoUrl =
				bigBlueButtonUrl + endpoints.GET_RECORDINGS + '?meetingID=' + meetingId + '&checksum=' + checksum
			let response = await request.get(meetingInfoUrl)
			return resolve(response)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Get recording ready callback URL with enhanced tenant isolation.
 * @method
 * @name getRecordingReadyCallbackUrl
 * @param {String} tenantCode - Tenant code for domain resolution and isolation.
 * @param {String} meetingId - Meeting ID (also used as session ID for isolation).
 * @returns {String} - Recording ready callback URL with isolation parameters.
 * @description Includes meetingID, sessionId and tenantCode in callback URLs for enhanced isolation and DC benefits.
 */
const getRecordingReadyCallbackUrl = async function (tenantCode, meetingId) {
	try {
		if (tenantCode) {
			try {
				const domain = await userRequests.getTenantDomain(tenantCode)
				// Enhanced isolation: Include both meetingID, sessionId and tenantCode for better DC routing and caching
				const recordingCallbackUrl = `https://${domain}/mentoring/v1/recordings/ready?meetingID=${meetingId}&sessionId=${meetingId}&tenantCode=${tenantCode}`
				return encodeURIComponent(recordingCallbackUrl)
			} catch (error) {
				// Error resolving tenant domain for recording callback, falling back to env var
				// Enhanced fallback with isolation parameters
				const baseUrl = process.env.RECORDING_READY_CALLBACK_URL || ''
				if (baseUrl) {
					const separator = baseUrl.includes('?') ? '&' : '?'
					return (
						baseUrl +
						separator +
						`meetingID=${meetingId}&sessionId=${meetingId}&tenantCode=${encodeURIComponent(tenantCode)}`
					)
				}
				return baseUrl
			}
		} else {
			// Fallback to environment variable with sessionId for basic isolation
			const baseUrl = process.env.RECORDING_READY_CALLBACK_URL || ''
			if (baseUrl && meetingId) {
				const separator = baseUrl.includes('?') ? '&' : '?'
				return baseUrl + separator + `meetingID=${meetingId}&sessionId=${meetingId}`
			}
			return baseUrl
		}
	} catch (error) {
		// Error getting recording ready callback URL
		const baseUrl = process.env.RECORDING_READY_CALLBACK_URL || ''
		if (baseUrl && meetingId) {
			const separator = baseUrl.includes('?') ? '&' : '?'
			return baseUrl + separator + `meetingID=${meetingId}&sessionId=${meetingId}`
		}
		return baseUrl
	}
}

module.exports = {
	createMeeting,
	getRecordings,
	getRecordingReadyCallbackUrl,
}
