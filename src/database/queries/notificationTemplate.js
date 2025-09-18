const NotificationTemplate = require('@database/models/index').NotificationTemplate
const { Op } = require('sequelize')

module.exports = class NotificationTemplateData {
	static async findOne(filter, tenantCode, options = {}) {
		try {
			filter.tenant_code = tenantCode

			// Safe merge: tenant filtering cannot be overridden by options.where
			const { where: optionsWhere, ...otherOptions } = options

			return await NotificationTemplate.findOne({
				where: {
					...optionsWhere, // Allow additional where conditions
					...filter, // But tenant filtering takes priority
				},
				...otherOptions,
				raw: true,
			})
		} catch (error) {
			return error
		}
	}

	static async findTemplatesByFilter(filter, options = {}) {
		try {
			const whereClause = {
				...filter,
			}

			// Handle array values for organization_code and tenant_code
			if (Array.isArray(filter.organization_code)) {
				whereClause.organization_code = { [Op.in]: filter.organization_code }
			}
			if (Array.isArray(filter.tenant_code)) {
				whereClause.tenant_code = { [Op.in]: filter.tenant_code }
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
}
