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
 * Create Meeting.
 * @method
 * @name createMeeting
 * @param {String} meetingId - meeting Id.
 * @param {String} meetingName - meeting name.
 * @param {String} attendeePW - Attendee Password.
 * @param {String} moderatorPW - Moderator Password.
 * @param {Number} sessionDuration - session duration in minutes.
 * @param {String} tenantCode - tenant code for domain resolution.
 * @returns {String} - Meeting success message.
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
					endMeetingCallBackUrl = `https://${domain}/mentoring/v1/sessions/completed/${meetingId}?source=BBB`
					sessionEndUrl = `https://${domain}/mentoring/v1/sessions/end`

					// URL encode the callback URL for BBB
					endMeetingCallBackUrl = encodeURIComponent(endMeetingCallBackUrl)

					console.log('🔍 BBB DOMAIN-BASED URL DEBUG:')
					console.log('Tenant Code:', tenantCode)
					console.log('Resolved Domain:', domain)
					console.log('Constructed endMeetingCallBackUrl:', endMeetingCallBackUrl)
					console.log('Decoded URL:', decodeURIComponent(endMeetingCallBackUrl))
					console.log('Session End URL:', sessionEndUrl)
				} catch (error) {
					console.error('Error resolving tenant domain, falling back to env vars:', error)
					// Fallback to environment variables if domain resolution fails
					endMeetingCallBackUrl =
						process.env.MEETING_END_CALLBACK_EVENTS + '%2F' + meetingId + '%3Fsource%3DBBB'
					sessionEndUrl = process.env.BIG_BLUE_BUTTON_SESSION_END_URL
				}
			} else {
				// Fallback to environment variables if no tenantCode provided
				endMeetingCallBackUrl = process.env.MEETING_END_CALLBACK_EVENTS + '%2F' + meetingId + '%3Fsource%3DBBB'
				sessionEndUrl = process.env.BIG_BLUE_BUTTON_SESSION_END_URL

				console.log('🔍 BBB ENV-BASED URL DEBUG:')
				console.log('Environment var MEETING_END_CALLBACK_EVENTS:', process.env.MEETING_END_CALLBACK_EVENTS)
				console.log('Constructed endMeetingCallBackUrl:', endMeetingCallBackUrl)
				console.log('Decoded URL:', decodeURIComponent(endMeetingCallBackUrl))
			}
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

module.exports = {
	createMeeting,
	getRecordings,
}
