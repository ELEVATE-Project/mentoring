const httpStatusCode = require('@generics/http-status')
const questionQueries = require('../database/queries/questions')
const responses = require('@helpers/responses')
module.exports = class questionsHelper {
	/**
	 * Create questions.
	 * @method
	 * @name create
	 * @param {Object} bodyData
	 * @returns {JSON} - Create questions
	 */

	static async create(bodyData, decodedToken, tenantCode) {
		try {
			bodyData['created_by'] = decodedToken.id
			bodyData['updated_by'] = decodedToken.id
			bodyData['tenant_code'] = tenantCode
			let question = await questionQueries.createQuestion(bodyData, tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'QUESTION_CREATED_SUCCESSFULLY',
				result: question,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	/**
	 * Update questions.
	 * @method
	 * @name update
	 * @param {String} questionId - question id.
	 * @param {Object} bodyData
	 * @returns {JSON} - Update questions.
	 */

	static async update(questionId, bodyData, decodedToken, tenantCode) {
		try {
			const filter = { id: questionId, created_by: decodedToken.id, tenant_code: tenantCode }
			const result = await questionQueries.updateOneQuestion(filter, bodyData, tenantCode)

			if (result === 'QUESTION_NOT_FOUND') {
				return responses.failureResponse({
					message: 'QUESTION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'QUESTION_UPDATED_SUCCESSFULLY',
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}

	/**
	 * Read question.
	 * @method
	 * @name read
	 * @param {String} questionId - question id.
	 * @returns {JSON} - Read question.
	 */

	static async read(questionId, tenantCode) {
		try {
			const filter = { id: questionId, tenant_code: tenantCode }
			const question = await questionQueries.findOneQuestion(filter, tenantCode)
			if (!question) {
				return responses.failureResponse({
					message: 'QUESTION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'QUESTION_FETCHED_SUCCESSFULLY',
				result: question,
			})
		} catch (error) {
			throw error
		}
	}
}
