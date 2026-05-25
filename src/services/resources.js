// Dependencies
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')

const resourceQueries = require('@database/queries/resources')
const cacheHelper = require('@generics/cacheHelper')

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
			// Validate resource belongs to the specified session and delete it
			const deletedRows = await resourceQueries.deleteResourceByIdWithSessionValidation(
				resourceId,
				sessionId,
				tenantCode
			)

			if (deletedRows === 0) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND_OR_SESSION_INVALID',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Invalidate session cache after deleting resource
			try {
				await cacheHelper.sessions.delete(tenantCode, sessionId)
			} catch (cacheError) {
				console.log('Error in invalidating session cache:', cacheError)
				// Cache invalidation failure - continue operation
			}

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'RESOURCE_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}
}
