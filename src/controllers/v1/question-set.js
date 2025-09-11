/**
 * name : questionsSet.js
 * author : Rakesh Kumar
 * created-date : 01-Dec-2021
 * Description : Question Controller.
 */

// Dependencies
const questionSetService = require('@services/question-set')
const utilsHelper = require('@generics/utils')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')

module.exports = class QuestionsSet {
	/**
	 * create questions set
	 * @method
	 * @name create
	 * @param {Object} req -request data.
	 * @returns {JSON} - Questions Set creation.
	 */

	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code

			const createQuestionSet = await questionSetService.create(
				req.body,
				req.decodedToken,
				tenantCode,
				organizationCode
			)

			return createQuestionSet
		} catch (error) {
			return error
		}
	}

	/**
	 * update questions set
	 * @method
	 * @name update
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - question set id.
	 * @returns {JSON} - Questions Set updation.
	 */

	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code

			const updateQuestionsSet = await questionSetService.update(
				req.params.id,
				req.body,
				req.decodedToken,
				tenantCode
			)
			return updateQuestionsSet
		} catch (error) {
			return error
		}
	}

	/**
	 * read questions set
	 * @method
	 * @name read
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - question set id.
	 * @returns {JSON} - Questions set data.
	 */

	async read(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const questionsSetData = await questionSetService.read(req.params.id, req.body.code, tenantCode)
			return questionsSetData
		} catch (error) {
			return error
		}
	}
}
