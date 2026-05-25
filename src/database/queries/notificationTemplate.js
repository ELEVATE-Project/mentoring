const NotificationTemplate = require('@database/models/index').NotificationTemplate
const { Op } = require('sequelize')
// const { getDefaults } = require('@helpers/getDefaultOrgId')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
// Removed cacheHelper import to break circular dependency

module.exports = class NotificationTemplateData {
	static async findOne(filter, tenantCode, options = {}) {
		try {
			// Direct database query - cache logic moved to caller level

			filter.tenant_code = tenantCode

			// Safe merge: tenant filtering cannot be overridden by options.where
			const { where: optionsWhere, ...otherOptions } = options

			const result = await NotificationTemplate.findOne({
				where: {
					...optionsWhere, // Allow additional where conditions
					...filter, // But tenant filtering takes priority
				},
				...otherOptions,
				raw: true,
			})

			// Cache logic removed - cache managed at caller level

			return result
		} catch (error) {
			return error
		}
	}

	static async findTemplatesByFilter(filter, options = {}) {
		try {
			const whereClause = {
				...filter,
			}

			if (Array.isArray(filter.organization_code)) {
				whereClause.organization_code = { [Op.in]: filter.organization_code }
			}

			// Safe merge: tenant filtering cannot be overridden by options.where
			const { where: optionsWhere, ...otherOptions } = options

			return await NotificationTemplate.findAll({
				where: {
					...optionsWhere, // Allow additional where conditions
					...whereClause, // But tenant filtering takes priority
				},
				...otherOptions,
				raw: true,
			})
		} catch (error) {
			return error
		}
	}

	static async updateTemplate(filter, update, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode

			// Safe merge: tenant filtering cannot be overridden by options.where
			const { where: optionsWhere, ...otherOptions } = options

			const template = await NotificationTemplate.update(update, {
				where: {
					...optionsWhere, // Allow additional where conditions
					...filter, // But tenant filtering takes priority
				},
				...otherOptions,
				individualHooks: true,
			})

			return template
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

	static async findOneEmailTemplate(code, orgCodeParam, tenantCode) {
		try {
			// Direct database query - cache logic moved to caller level

			// Handle different parameter formats that callers might use
			let orgCodes = []

			// Parse organization codes
			if (Array.isArray(orgCodeParam)) {
				orgCodes = orgCodeParam
			} else if (orgCodeParam && typeof orgCodeParam === 'object' && orgCodeParam[Op.in]) {
				orgCodes = orgCodeParam[Op.in]
			} else if (orgCodeParam) {
				orgCodes = [orgCodeParam]
			}

			// Build filter for template search
			const filter = {
				code: code,
				type: 'email',
				status: 'active',
				organization_code: { [Op.in]: orgCodes },
				tenant_code: tenantCode,
			}

			let templateData = await NotificationTemplate.findAll({
				where: filter,
				raw: true,
			})

			if (!templateData || templateData.length === 0) {
				return null
			}

			// Priority: user's org template > default org template
			const userOrgCode = Array.isArray(orgCodeParam) ? orgCodeParam[0] : orgCodeParam
			const orgMatch = templateData.find((template) => template.organization_code === userOrgCode)
			const selectedTemplate = orgMatch || templateData[0]

			// Compose template with header and footer
			if (selectedTemplate && selectedTemplate.email_header) {
				const header = await this.getEmailHeader(selectedTemplate.email_header, tenantCode, orgCodes)
				if (header && header.body) {
					selectedTemplate.body = header.body + selectedTemplate.body
				}
			}

			if (selectedTemplate && selectedTemplate.email_footer) {
				const footer = await this.getEmailFooter(selectedTemplate.email_footer, tenantCode, orgCodes)
				if (footer && footer.body) {
					selectedTemplate.body += footer.body
				}
			}

			// Cache logic removed - cache managed at caller level

			return selectedTemplate
		} catch (error) {
			return error
		}
	}

	static async getEmailHeader(headerCode, tenantCode, orgCodes = []) {
		try {
			const normalizedOrgCodes = Array.isArray(orgCodes) ? orgCodes.filter(Boolean) : [orgCodes].filter(Boolean)
			const where = {
				code: headerCode,
				type: 'emailHeader',
				status: 'active',
				tenant_code: tenantCode,
			}
			if (normalizedOrgCodes.length > 0) where.organization_code = { [Op.in]: normalizedOrgCodes }
			const results = await NotificationTemplate.findAll({ where, raw: true })
			if (!results || results.length === 0) return null
			const preferredOrg = normalizedOrgCodes[0]
			return results.find((r) => r.organization_code === preferredOrg) || results[0]
		} catch (error) {
			return null
		}
	}

	static async getEmailFooter(footerCode, tenantCode, orgCodes = []) {
		try {
			const normalizedOrgCodes = Array.isArray(orgCodes) ? orgCodes.filter(Boolean) : [orgCodes].filter(Boolean)
			const where = {
				code: footerCode,
				type: 'emailFooter',
				status: 'active',
				tenant_code: tenantCode,
			}
			if (normalizedOrgCodes.length > 0) where.organization_code = { [Op.in]: normalizedOrgCodes }
			const results = await NotificationTemplate.findAll({ where, raw: true })
			if (!results || results.length === 0) return null
			const preferredOrg = normalizedOrgCodes[0]
			return results.find((r) => r.organization_code === preferredOrg) || results[0]
		} catch (error) {
			return null
		}
	}

	static async bulkCreate(records, tenantCode, options = {}) {
		try {
			const dataWithTenant = records.map((item) => ({
				...item,
				tenant_code: tenantCode,
			}))
			return await NotificationTemplate.bulkCreate(dataWithTenant, {
				ignoreDuplicates: true,
				...options,
			})
		} catch (error) {
			throw error
		}
	}
}
