const httpStatusCode = require('@generics/http-status')
const utils = require('@generics/utils')
const form = require('@generics/form')
const KafkaProducer = require('@generics/kafka-communication')

const formQueries = require('../database/queries/form')
const { UniqueConstraintError } = require('sequelize')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')

const responses = require('@helpers/responses')

module.exports = class FormsHelper {
	/**
	 * Create Form.
	 * @method
	 * @name create
	 * @param {Object} bodyData - Form data
	 * @param {String} orgId - Organization ID
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {JSON} - Form creation data.
	 */

	static async create(bodyData, orgId, orgCode, tenantCode) {
		try {
			bodyData['organization_id'] = orgId
			bodyData['organization_code'] = orgCode
			const form = await formQueries.createForm(bodyData, tenantCode)

			await utils.internalDel('formVersion')

			await KafkaProducer.clearInternalCache('formVersion')

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'FORM_CREATED_SUCCESSFULLY',
				result: form,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'FORM_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update Form.
	 * @method
	 * @name update
	 * @param {Object} bodyData
	 * @returns {JSON} - Update form data.
	 */

	static async update(id, bodyData, orgCode, tenantCode) {
		try {
			let filter = {}
			if (id) {
				filter = {
					id: id,
				}
			} else {
				filter = {
					type: bodyData.type,
					sub_type: bodyData.sub_type,
				}
			}

			const result = await formQueries.updateOneForm(filter, bodyData, tenantCode, orgCode)

			if (result === 'ENTITY_ALREADY_EXISTS') {
				return responses.failureResponse({
					message: 'FORM_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else if (result === 'ENTITY_NOT_FOUND') {
				return responses.failureResponse({
					message: 'FORM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			await utils.internalDel('formVersion')
			await KafkaProducer.clearInternalCache('formVersion')
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'FORM_UPDATED_SUCCESSFULLY',
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'FORM_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Read Form.
	 * @method
	 * @name read
	 * @param {Object} bodyData
	 * @returns {JSON} - Read form data.
	 */

	static async read(id, bodyData, orgCode, tenantCode) {
		try {
			let filter = {}
			if (id) {
				filter = { id: id }
			} else {
				filter = { ...bodyData }
			}
			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const form = await formQueries.findOneForm(filter)
			let defaultOrgForm
			if (!form) {
				filter = id ? { id: id } : { ...bodyData }
				defaultOrgForm = await formQueries.findOneForm(filter, defaults.tenantCode, defaults.orgCode)
			}
			if (!form && !defaultOrgForm) {
				return responses.failureResponse({
					message: 'FORM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FORM_FETCHED_SUCCESSFULLY',
				result: form ? form : defaultOrgForm,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}
	static async readAllFormsVersion(tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FORM_VERSION_FETCHED_SUCCESSFULLY',
				result: (await form.getAllFormsVersion({ [Op.in]: [defaults.tenantCode, tenantCode] })) || {},
			})
		} catch (error) {
			return error
		}
	}
}
