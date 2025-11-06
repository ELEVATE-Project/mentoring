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

			// Invalidate specific form cache after creation (no "all forms" cache)
			if (bodyData.type && bodyData.sub_type) {
				try {
					await cacheHelper.forms.delete(tenantCode, orgCode, bodyData.type, bodyData.sub_type)
					console.log(`Form cache invalidated: ${bodyData.type}:${bodyData.sub_type}`)
				} catch (error) {
					console.warn('Failed to invalidate form cache:', error)
				}
			}

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

			// Fetch original form data before update to handle cache cleanup
			let originalForm = null
			try {
				if (id) {
					originalForm = await formQueries.findOne({ id: id }, tenantCode)
				} else {
					const originalForms = await formQueries.findFormsByFilter(filter, [tenantCode])
					originalForm = originalForms && originalForms.length > 0 ? originalForms[0] : null
				}
			} catch (error) {
				console.warn('Failed to fetch original form for cache cleanup:', error)
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

			// Handle cache invalidation after successful update
			try {
				// Delete old cache entry if original form had different type/subtype
				if (originalForm && originalForm.type && originalForm.sub_type) {
					await cacheHelper.forms.delete(
						tenantCode,
						originalForm.organization_code || orgCode,
						originalForm.type,
						originalForm.sub_type
					)
					console.log(`Old form cache deleted: ${originalForm.type}:${originalForm.sub_type}`)
				}

				// Cache new form if type/subtype provided in update
				if (bodyData.type && bodyData.sub_type) {
					// Fetch updated form and cache it
					const updatedForm = await formQueries.findFormsByFilter(
						{ type: bodyData.type, sub_type: bodyData.sub_type },
						[tenantCode]
					)
					if (updatedForm && updatedForm.length > 0) {
						await cacheHelper.forms.set(
							tenantCode,
							updatedForm[0].organization_code || orgCode,
							bodyData.type,
							bodyData.sub_type,
							updatedForm[0]
						)
						console.log(`New form cache set: ${bodyData.type}:${bodyData.sub_type}`)
					}
				}
			} catch (error) {
				console.warn('Failed to handle form cache invalidation:', error)
			}

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
			// Try to get from cache first if searching by type and subtype (not by ID)
			if (!id && bodyData?.type && bodyData?.sub_type) {
				const cachedData = await cacheHelper.forms.get(tenantCode, orgCode, bodyData.type, bodyData.sub_type)
				if (cachedData) {
					console.log(`Form ${bodyData.type}:${bodyData.sub_type} retrieved from cache`)
					return responses.successResponse({
						statusCode: httpStatusCode.ok,
						message: 'FORM_FETCHED_SUCCESSFULLY',
						result: cachedData,
					})
				}
			}

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

			// Business logic: Try both current tenant and default tenant
			const tenantCodes = [tenantCode, defaults.tenantCode]
			const forms = await formQueries.findFormsByFilter(filter, tenantCodes)

			if (!forms || forms.length === 0) {
				return responses.failureResponse({
					message: 'FORM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business logic: Prefer current tenant over default tenant
			const form = forms.find((f) => f.tenant_code === tenantCode) || forms[0]

			// Cache the result if it was searched by type and subtype
			if (!id && bodyData?.type && bodyData?.sub_type) {
				await cacheHelper.forms.set(tenantCode, orgCode, bodyData.type, bodyData.sub_type, form)
				console.log(`Form ${bodyData.type}:${bodyData.sub_type} cached successfully`)
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

			// Fetch all forms from database (no "all forms" cache to avoid duplication)
			const formsVersionData =
				(await form.getAllFormsVersion({ [Op.in]: [defaults.tenantCode, tenantCode] })) || {}

			// Cache each individual form for future individual reads
			try {
				if (Array.isArray(formsVersionData) && formsVersionData.length > 0) {
					console.log(`Populating individual form caches for ${formsVersionData.length} forms...`)
					const cachePromises = []

					// For each form in the version data, fetch complete form and cache it
					for (const formVersion of formsVersionData) {
						if (formVersion.type) {
							// Create a promise to fetch and cache the complete form
							const cachePromise = (async () => {
								try {
									// Fetch complete form data by type (this should include sub_type)
									const completeFormData = await formQueries.findFormsByFilter(
										{ type: formVersion.type },
										[tenantCode]
									)

									if (completeFormData && completeFormData.length > 0) {
										const formData = completeFormData[0]
										if (formData.sub_type) {
											await cacheHelper.forms.set(
												tenantCode,
												formData.organization_code || defaults.orgCode,
												formData.type,
												formData.sub_type,
												formData
											)
											console.log(`Individual form cached: ${formData.type}:${formData.sub_type}`)
										}
									}
								} catch (error) {
									console.warn(`Failed to cache individual form for type ${formVersion.type}:`, error)
								}
							})()

							cachePromises.push(cachePromise)
						}
					}

					// Execute all individual cache operations in parallel
					await Promise.all(cachePromises)
					console.log(`Individual forms cache population completed for tenant: ${tenantCode}`)
				}
			} catch (individualCacheError) {
				console.warn('Failed to populate individual forms cache:', individualCacheError)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FORM_VERSION_FETCHED_SUCCESSFULLY',
				result: formsVersionData,
			})
		} catch (error) {
			return error
		}
	}
}
