const NotificationTemplate = require('@database/models/index').NotificationTemplate
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')

module.exports = class NotificationTemplateData {
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
			/**If data exists for both `orgId` and `defaultOrgId`, the query will return the first matching records
			 * we will filter required data based on condition from it
			 * if orgId passed -> get template defined by particular org or get default org template
			 */
			const filter = {
				code: code,
				type: 'email',
				status: 'active',
				organization_code: orgCode ? { [Op.or]: [orgCode, defaults.orgCode] } : defaults.orgCode,
				tenant_code: { [Op.or]: [tenantCode, defaults.tenantCode] },
			}

			let templateData = await NotificationTemplate.findAll({
				where: filter,
				raw: true,
			})

			// If there are multiple results, find the one matching orgCode
			templateData = templateData.find((template) => template.organization_code === orgCode) || templateData[0]

			if (templateData && templateData.email_header) {
				const header = await this.getEmailHeader(templateData.email_header, tenantCode)
				if (header && header.body) {
					templateData.body = header.body + templateData.body
				}
			}

			if (templateData && templateData.email_footer) {
				const footer = await this.getEmailFooter(templateData.email_footer, tenantCode)
				if (footer && footer.body) {
					templateData.body += footer.body
				}
			}
			return templateData
		} catch (error) {
			return error
		}
	}

	static async getEmailHeader(header, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			const headerData = await NotificationTemplate.findOne({
				where: {
					code: header,
					type: 'emailHeader',
					status: 'active',
					tenant_code: { [Op.or]: [tenantCode, defaults.tenantCode] },
				},
				raw: true,
			})

			return headerData
		} catch (error) {
			return error
		}
	}

	static async getEmailFooter(footer, tenantCode) {
		try {
			const defaults = await getDefaults()
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			const footerData = await NotificationTemplate.findOne({
				where: {
					code: footer,
					type: 'emailFooter',
					status: 'active',
					tenant_code: { [Op.or]: [tenantCode, defaults.tenantCode] },
				},
				raw: true,
			})

			return footerData
		} catch (error) {
			return error
		}
	}

	static async findOne(filter, tenantCode, options = {}) {
		try {
			const defaults = await getDefaults()
			if (!defaults.tenantCode) {
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			filter.tenant_code = { [Op.or]: [tenantCode, defaults.tenantCode] }
			return await NotificationTemplate.findOne({
				where: filter,
				...options,
				raw: true,
			})
		} catch (error) {
			return error
		}
	}

	static async updateTemplate(filter, update, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode
			const template = await NotificationTemplate.update(update, {
				where: filter,
				...options,
				individualHooks: true,
			})

			return template
		} catch (error) {
			return error
		}
	}

	static async findAllNotificationTemplates(filter, tenantCode, options = {}) {
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
			filter.tenant_code = { [Op.or]: [tenantCode, defaults.tenantCode] }
			if (filter.organization_code) {
				filter.organization_code = filter.organization_code
					? { [Op.or]: [orgCode, defaults.orgCode] }
					: defaults.orgCode
			}

			const templates = await NotificationTemplate.findAll({
				where: filter,
				...options,
				raw: true,
			})

			// templates.forEach(async(template) => {
			// 	if (template.email_header) {
			// 		const header = await this.getEmailHeader(template.email_header)
			// 		if (header && header.body) {
			// 			template['body'] = header.body + template['body']
			// 		}
			// 	}

			// 	if (template.email_footer) {
			// 		const footer = await this.getEmailFooter(template.email_footer)
			// 		if (footer && footer.body) {
			// 			template['body'] = template['body'] + footer.body
			// 		}
			// 	}
			// })

			return templates
		} catch (error) {
			return error
		}
	}

	static async create(data, tenantCode) {
		try {
			data.tenant_code = tenantCode
			return await NotificationTemplate.create(data)
		} catch (error) {
			return error
		}
	}
}
