const Session = require('@database/queries/sessions')
const Connection = require('@database/queries/connection')
const RequestSession = require('@database/queries/requestSessions')
const userExtensionQueries = require('@database/queries/userExtension')

module.exports = class adminHelper {
	static async getPrivateSessionsWithDeletedMentee(menteeUserId) {
		try {
			const privateSessions = await Session.getPrivateUpComingSessionsOfMentee(menteeUserId)
			return privateSessions
		} catch (error) {
			console.error('Error getting private sessions with deleted mentee:', error)
			return []
		}
	}

	static async getConnectedMentors(menteeUserId) {
		try {
			// Use raw query to get connected mentors
			let mentorIds = await Connection.getConnectedUsers(menteeUserId, 'user_id', 'friend_id')

			if (mentorIds.length === 0) {
				return []
			}

			// Get mentor details for notification
			const mentors = await userExtensionQueries.getUsersByUserIds(mentorIds, {
				attributes: ['user_id', 'name', 'email'],
			})

			return mentors || []
		} catch (error) {
			console.error('Error getting connected mentors:', error)
			return []
		}
	}
	static async getUpcomingSessionsForMentor(mentorUserId) {
		try {
			const upcomingSessions = await Session.getUpcomingSessionsForMentor(mentorUserId)
			return upcomingSessions
		} catch (error) {
			console.error('Error getting upcoming sessions for mentor:', error)
			return []
		}
	}

	static async getUpcomingSessionsForMentee(menteeUserId) {
		try {
			// Get private sessions where the deleted mentee was enrolled and session is in future
			const upcomingSessions = await Session.getPrivateUpComingSessionsOfMentee(menteeUserId)
			return upcomingSessions
		} catch (error) {
			console.error('Error getting upcoming sessions for mentee:', error)
			return []
		}
	}

	static async getConnectedMentees(mentorUserId) {
		try {
			const menteeIds = await Connection.getConnectedUsers(mentorUserId, 'friend_id', 'user_id')

			const mentees = await userExtensionQueries.getUsersByUserIds(menteeIds, {
				attributes: ['user_id', 'name', 'email'],
			})

			return mentees || []
		} catch (error) {
			console.error('Error getting connected mentees:', error)
			return []
		}
	}

	static async getPendingSessionRequestsForMentor(mentorUserId) {
		try {
			const pendingRequests = await RequestSession.getPendingSessionRequests(mentorUserId)

			return pendingRequests || []
		} catch (error) {
			console.error('Error getting pending session requests for mentor:', error)
			return []
		}
	}
}
