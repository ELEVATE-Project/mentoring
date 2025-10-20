const httpStatusCode = require('@generics/http-status')
const notificationTemplateQueries = require('@database/queries/notificationTemplate')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')
const cacheHelper = require('@generics/cacheHelper')
const common = require('@constants/common')

module.exports = class NotificationTemplateHelper {
	/**
	 * Create Notification template.
	 * @method
	 * @name create
	 * @param {Object} bodyData
	 * @returns {JSON} - Notification template creation data.
	 */

	static async create(bodyData, tokenInformation, tenantCode) {
		try {
			const template = await notificationTemplateQueries.findOne({ code: bodyData.code, tenant_code: tenantCode })
			if (template) {
				return responses.failureResponse({
					message: 'NOTIFICATION_TEMPLATE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			bodyData['organization_id'] = tokenInformation.organization_id
			bodyData['organization_code'] = tokenInformation.organization_code
			bodyData['tenant_code'] = tenantCode
			bodyData['created_by'] = tokenInformation.id

			const createdNotification = await notificationTemplateQueries.create(bodyData, tenantCode)

			// Invalidate notification template caches after successful creation
			await this._invalidateNotificationTemplateCaches({
				tenantCode,
				orgCode: tokenInformation.organization_code,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'NOTIFICATION_TEMPLATE_CREATED_SUCCESSFULLY',
				result: createdNotification,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Update Notification template.
	 * @method
	 * @name update
	 * @param {Object} bodyData
	 * @returns {JSON} - Update Notification template.
	 */

	static async update(id, bodyData, tokenInformation, tenantCode) {
		try {
			let filter = {
				organization_id: tokenInformation.organization_id,
				organization_code: tokenInformation.organization_code,
				tenant_code: tenantCode,
			}

			if (id) {
				filter.id = id
			} else {
				filter.code = bodyData.code
			}

			bodyData['organization_id'] = tokenInformation.organization_id
			bodyData['organization_code'] = tokenInformation.organization_code
			bodyData['updated_by'] = tokenInformation.id

			const result = await notificationTemplateQueries.updateTemplate(filter, bodyData, tenantCode)
			if (result == 0) {
				return responses.failureResponse({
					message: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Invalidate notification template caches after successful update
			await this._invalidateNotificationTemplateCaches({
				tenantCode,
				orgCode: tokenInformation.organization_code,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'NOTIFICATION_TEMPLATE_UPDATED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Read Notification template.
	 * @method
	 * @name read
	 * @param {Object} bodyData
	 * @returns {JSON} - Read Notification template.
	 */

	static async read(id = null, code = null, organizationCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode) {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business logic: Build filter for both current and default org/tenant
			let filter = {
				organization_code: organizationCode ? [organizationCode, defaults.orgCode] : [defaults.orgCode],
				tenant_code: [tenantCode, defaults.tenantCode],
			}

			if (id) {
				filter.id = id
			} else {
				filter.code = code
			}

			const notificationTemplates = await notificationTemplateQueries.findTemplatesByFilter(filter)

			if (!notificationTemplates || notificationTemplates.length === 0) {
				return responses.failureResponse({
					message: 'NOTIFICATION_TEMPLATE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business logic: Prefer current tenant and org over default
			const selectedTemplate =
				notificationTemplates.find(
					(t) => t.organization_code === organizationCode && t.tenant_code === tenantCode
				) ||
				notificationTemplates.find((t) => t.organization_code === organizationCode) ||
				notificationTemplates.find((t) => t.tenant_code === tenantCode) ||
				notificationTemplates[0]

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'NOTIFICATION_TEMPLATE_FETCHED_SUCCESSFULLY',
				result: selectedTemplate || {},
			})
		} catch (error) {
			throw error
		}
	}
	static async readAllNotificationTemplates(organizationCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode) {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business logic: Build filter for both current and default org/tenant
			const filter = {
				organization_code: organizationCode ? [organizationCode, defaults.orgCode] : [defaults.orgCode],
				tenant_code: [tenantCode, defaults.tenantCode],
			}

			const notificationTemplates = await notificationTemplateQueries.findTemplatesByFilter(filter)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'NOTIFICATION_TEMPLATE_FETCHED_SUCCESSFULLY',
				result: notificationTemplates || [],
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Get Email Template with Header and Footer composition
	 * @method
	 * @name findOneEmailTemplate
	 * @param {String} code - Template code
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Object|Error} - Composed template data
	 */
	static async findOneEmailTemplate(code, orgCode, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode) {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business logic: Build filter for both current and default org/tenant
			const filter = {
				code: code,
				type: 'email',
				status: 'active',
				organization_code: orgCode ? [orgCode, defaults.orgCode] : [defaults.orgCode],
				tenant_code: [tenantCode, defaults.tenantCode],
			}

			const templateData = await notificationTemplateQueries.findTemplatesByFilter(filter)

			if (!templateData || templateData.length === 0) {
				return null
			}

			// Business logic: Prefer current tenant and org over default
			let selectedTemplate =
				templateData.find((t) => t.organization_code === orgCode && t.tenant_code === tenantCode) ||
				templateData.find((t) => t.organization_code === orgCode) ||
				templateData.find((t) => t.tenant_code === tenantCode) ||
				templateData[0]

			// Business logic: Compose template with header and footer
			if (selectedTemplate && selectedTemplate.email_header) {
				const header = await this.getEmailHeader(selectedTemplate.email_header, tenantCode, orgCode)
				if (header && header.body) {
					selectedTemplate.body = header.body + selectedTemplate.body
				}
			}

			if (selectedTemplate && selectedTemplate.email_footer) {
				const footer = await this.getEmailFooter(selectedTemplate.email_footer, tenantCode, orgCode)
				if (footer && footer.body) {
					selectedTemplate.body += footer.body
				}
			}

			return selectedTemplate
		} catch (error) {
			return error
		}
	}

	/**
	 * Get Email Header Template
	 * @method
	 * @name getEmailHeader
	 * @param {String} header - Header code
	 * @param {String} tenantCode - Tenant code
	 * @param {String} orgCode - Organization code
	 * @returns {Object|Error} - Header template data
	 */
	static async getEmailHeader(header, tenantCode, orgCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode) {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business logic: Build filter for header template
			const filter = {
				code: header,
				type: 'emailHeader',
				status: 'active',
				organization_code: orgCode ? [orgCode, defaults.orgCode] : [defaults.orgCode],
				tenant_code: [tenantCode, defaults.tenantCode],
			}

			const headerData = await notificationTemplateQueries.findTemplatesByFilter(filter)

			if (!headerData || headerData.length === 0) {
				return null
			}

			// Business logic: Prefer current tenant and org over default
			return (
				headerData.find((h) => h.organization_code === orgCode && h.tenant_code === tenantCode) ||
				headerData.find((h) => h.organization_code === orgCode) ||
				headerData.find((h) => h.tenant_code === tenantCode) ||
				headerData[0]
			)
		} catch (error) {
			return error
		}
	}

	/**
	 * Get Email Footer Template
	 * @method
	 * @name getEmailFooter
	 * @param {String} footer - Footer code
	 * @param {String} tenantCode - Tenant code
	 * @param {String} orgCode - Organization code
	 * @returns {Object|Error} - Footer template data
	 */
	static async getEmailFooter(footer, tenantCode, orgCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode) {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business logic: Build filter for footer template
			const filter = {
				code: footer,
				type: 'emailFooter',
				status: 'active',
				organization_code: orgCode ? [orgCode, defaults.orgCode] : [defaults.orgCode],
				tenant_code: [tenantCode, defaults.tenantCode],
			}

			const footerData = await notificationTemplateQueries.findTemplatesByFilter(filter)

			if (!footerData || footerData.length === 0) {
				return null
			}

			// Business logic: Prefer current tenant and org over default
			return (
				footerData.find((f) => f.organization_code === orgCode && f.tenant_code === tenantCode) ||
				footerData.find((f) => f.organization_code === orgCode) ||
				footerData.find((f) => f.tenant_code === tenantCode) ||
				footerData[0]
			)
		} catch (error) {
			return error
		}
	}

	/**
	 * Invalidate notification template related caches after CUD operations
	 * Following the user service pattern for notification template cache invalidation
	 */
	static async _invalidateNotificationTemplateCaches({ tenantCode, orgCode }) {
		try {
			// Invalidate notification_templates namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: orgCode,
				ns: common.CACHE_CONFIG.namespaces.notification_templates.name,
			})

			// Special handling for default org - invalidate all orgs (similar to user service pattern)
			const defaults = await getDefaults()
			if (defaults.orgCode === orgCode) {
				await cacheHelper.evictTenantByPattern(tenantCode, {
					patternSuffix: `org:*:${common.CACHE_CONFIG.namespaces.notification_templates.name}:*`,
				})
			}
		} catch (err) {
			console.error('Notification template cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}

	/**
	 * Get Email Template with Header and Footer composition (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * Supports the same parameter formats as the query method for compatibility
	 * @method
	 * @name findOneEmailTemplateCached
	 * @param {String} code - Template code
	 * @param {String|Array|Object} orgCodeParam - Organization code(s) - supports same formats as query method
	 * @param {String|Array|Object} tenantCodeParam - Tenant code(s) - supports same formats as query method
	 * @returns {Object|Error} - Cached composed template data
	 */
	static async findOneEmailTemplateCached(code, orgCodeParam, tenantCodeParam) {
		try {
			const defaults = await getDefaults()
			if (!defaults.orgCode || !defaults.tenantCode) {
				throw new Error('DEFAULT_ORG_CODE_OR_TENANT_CODE_NOT_SET')
			}

			// Create cache ID based on parameters - normalize complex parameters for consistent caching
			const orgCodeForCache = Array.isArray(orgCodeParam)
				? orgCodeParam[0]
				: orgCodeParam && typeof orgCodeParam === 'object' && orgCodeParam[Op.in]
				? orgCodeParam[Op.in][0]
				: orgCodeParam || 'default'
			const tenantCodeForCache = Array.isArray(tenantCodeParam)
				? tenantCodeParam[0]
				: tenantCodeParam && typeof tenantCodeParam === 'object' && tenantCodeParam[Op.in]
				? tenantCodeParam[Op.in][0]
				: tenantCodeParam || defaults.tenantCode

			const cacheId = `email_template:${code}:${orgCodeForCache}:${tenantCodeForCache}`

			let templateData
			try {
				templateData = await cacheHelper.getOrSet({
					tenantCode: tenantCodeForCache,
					orgCode: orgCodeForCache,
					ns: common.CACHE_CONFIG.namespaces.notification_templates.name,
					id: cacheId,
					fetchFn: async () => {
						// Use the query method directly to maintain exact same parameter handling and business logic
						return await notificationTemplateQueries.findOneEmailTemplate(
							code,
							orgCodeParam,
							tenantCodeParam
						)
					},
				})
			} catch (cacheError) {
				console.warn('Cache system failed for email template, falling back to database:', cacheError.message)
				templateData = await notificationTemplateQueries.findOneEmailTemplate(
					code,
					orgCodeParam,
					tenantCodeParam
				)
			}

			return templateData
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find notification templates by filter (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findTemplatesByFilterCached
	 * @param {Object} filter - Filter criteria
	 * @param {String} orgCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Array} - Cached template data
	 */
	static async findTemplatesByFilterCached(filter, orgCode, tenantCode) {
		try {
			// Create cache ID based on filter to ensure cache uniqueness
			const cacheId = `templates_filter:${JSON.stringify(filter)}`

			let templateData
			try {
				templateData = await cacheHelper.getOrSet({
					tenantCode,
					orgCode: orgCode || 'default',
					ns: common.CACHE_CONFIG.namespaces.notification_templates.name,
					id: cacheId,
					fetchFn: async () => {
						return await notificationTemplateQueries.findTemplatesByFilter(filter)
					},
				})
			} catch (cacheError) {
				console.warn('Cache system failed for templates filter, falling back to database:', cacheError.message)
				templateData = await notificationTemplateQueries.findTemplatesByFilter(filter)
			}

			return templateData
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find one notification template (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findOneCached
	 * @param {Object} filter - Filter criteria
	 * @param {String} tenantCode - Tenant code
	 * @param {Object} options - Query options
	 * @returns {Object} - Cached template data
	 */
	static async findOneCached(filter, tenantCode, options = {}) {
		try {
			// Create cache ID based on all parameters to ensure cache uniqueness
			const cacheId = `one_template:${JSON.stringify({ filter, options })}`

			let templateData
			try {
				templateData = await cacheHelper.getOrSet({
					tenantCode,
					orgCode: filter.organization_code || 'default',
					ns: common.CACHE_CONFIG.namespaces.notification_templates.name,
					id: cacheId,
					fetchFn: async () => {
						return await notificationTemplateQueries.findOne(filter, tenantCode, options)
					},
				})
			} catch (cacheError) {
				console.warn('Cache system failed for one template, falling back to database:', cacheError.message)
				templateData = await notificationTemplateQueries.findOne(filter, tenantCode, options)
			}

			return templateData
		} catch (error) {
			throw error
		}
	}
}
