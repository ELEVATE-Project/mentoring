const httpStatusCode = require('@generics/http-status')
const notificationTemplateQueries = require('@database/queries/notificationTemplate')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')

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
}
