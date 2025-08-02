// Dependencies
const httpStatusCode = require('@generics/http-status')
const sessionQueries = require('@database/queries/sessions')
const path = require('path')
const responses = require('@helpers/responses')

const resourceQueries = require('@database/queries/resources')

module.exports = class SessionsHelper {
	/**
	 * Remove resources from session.
	 * @method
	 * @name deleteResource
	 * @param {String} resourceId 				- resource id.
	 * @param {String} sessionId 				- Session id.
	 * @returns {JSON} 							- deleted response
	 */

	static async deleteResource(resourceId, sessionId, userId, organizationId, tenantCode) {
		try {
			// check if session exists or not
			console.log('sessionId', sessionId)
			const sessionDetails = await sessionQueries.findOne({ id: sessionId }, tenantCode)

			if (!sessionDetails || Object.keys(sessionDetails).length === 0) {
				return responses.failureResponse({
					message: 'SESSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			await resourceQueries.deleteResourceById(resourceId, sessionId, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'RESOURCE_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}
}
