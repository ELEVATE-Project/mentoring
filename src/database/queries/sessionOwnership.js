const SessionOwnership = require('@database/models/index').SessionOwnership
const { ValidationError: SequelizeValidationError } = require('sequelize')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')

exports.create = async (data) => {
	try {
		return await SessionOwnership.create(data)
	} catch (error) {
		if (error instanceof SequelizeValidationError) {
			return responses.failureResponse({
				message: 'INVALID_DATA_PASSED',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
		throw error
	}
}

/**
 * Find session ownership data based on provided filter and options.
 *
 * @param {Object} filter - The filter criteria for the query.
 * @param {Object} options - Additional options for the query.
 * @param {boolean} returnUniqueSessionIds - Whether to return unique session IDs.
 * @returns {Promise<Array>|Promise<Array<number>>|Error} - Returns an array of session ownership data
 *   or an array of unique session IDs if returnUniqueSessionIds is true.
 *   Returns an error if there's an issue with the query.
 */

exports.findAll = async (filter, options = {}, returnUniqueSessionIds = false) => {
	try {
		const foundSessionOwnerships = await SessionOwnership.findAll({
			where: filter,
			...options,
			raw: true,
		})

		// if flag is passed return unique session_ids
		if (returnUniqueSessionIds) {
			const sessionIdsSet = new Set(foundSessionOwnerships.map((ownership) => ownership.session_id))
			const sessionIds = [...sessionIdsSet]
			return sessionIds
		}
		return foundSessionOwnerships
	} catch (error) {
		return error
	}
}
