const httpStatusCode = require('@generics/http-status')
const utils = require('@generics/utils')
const form = require('@generics/form')
const KafkaProducer = require('@generics/kafka-communication')

const formQueries = require('../database/queries/form')
const { UniqueConstraintError } = require('sequelize')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')

const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')
const common = require('@constants/common')
const cacheService = require('@helpers/cache')

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

			// Invalidate form caches after successful creation
			await this._invalidateFormCaches({ tenantCode, orgCode })

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

			// Invalidate form caches after successful update
			await this._invalidateFormCaches({ tenantCode, orgCode })

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
				filter = { id: id, tenant_code: tenantCode }
			} else {
				filter = { ...bodyData, tenant_code: tenantCode }
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
			// Add organization code to filter if provided
			if (orgCode) {
				filter.organization_code = { [Op.in]: [orgCode, defaults.orgCode] }
			}

			// Use cached form lookup with inline implementation
			let form
			const cacheId = filter.type ? `${filter.type}:${filter.sub_type || 'default'}` : 'unknown'
			try {
				form = await cacheService.findFormCached(filter, orgCode, tenantCode)
			} catch (cacheError) {
				console.warn('Cache system failed for form details, falling back to database:', cacheError.message)
				const formFilter = {
					...filter,
					status: 'ACTIVE',
					tenant_code: { [Op.in]: [tenantCode, defaults.tenantCode] },
				}

				form = await formQueries.findOneForm(formFilter, { [Op.in]: [tenantCode, defaults.tenantCode] })
			}

			if (!form) {
				return responses.failureResponse({
					message: 'FORM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FORM_FETCHED_SUCCESSFULLY',
				result: form,
			})
		} catch (error) {
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

	/**
	 * Invalidate form-related caches after CUD operations
	 * Following the user service pattern for form cache invalidation
	 */
	static async _invalidateFormCaches({ tenantCode, orgCode }) {
		try {
			// Invalidate forms namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: orgCode,
				ns: common.CACHE_CONFIG.namespaces.forms.name,
			})

			// Special handling for default org - invalidate all orgs (similar to user service pattern)
			const defaults = await getDefaults()
			if (defaults.orgCode === orgCode) {
				await cacheHelper.evictTenantByPattern(tenantCode, {
					patternSuffix: `org:*:${common.CACHE_CONFIG.namespaces.forms.name}:*`,
				})
			}
		} catch (err) {
			console.error('Form cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}
}
