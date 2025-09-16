const ReportType = require('@database/models/index').ReportType
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')

module.exports = class ReportTypeQueries {
	static async createReportType(data, tenantCode) {
		try {
			data.tenant_code = tenantCode
			return await ReportType.create(data, { returning: true })
		} catch (error) {
			return error
		}
	}

	static async findReportTypeByTitle(title, tenantCode, options = {}) {
		try {
			const { where: optionsWhere = {}, ...rest } = options || {}
			const where = { ...optionsWhere, title: title, tenant_code: tenantCode }

			// First try to find report type for specific tenant
			let reportType = await ReportType.findOne({
				...rest,
				where,
				raw: true,
			})

			// If no report type found and not already using default tenant, try default tenant
			if (!reportType && tenantCode !== (await getDefaults()).tenantCode) {
				const defaults = await getDefaults()
				const defaultWhere = { ...optionsWhere, title: title, tenant_code: defaults.tenantCode }
				reportType = await ReportType.findOne({
					...rest,
					where: defaultWhere,
					raw: true,
				})
			}

			return reportType
		} catch (error) {
			return error
		}
	}

	static async updateReportType(filter, updateData, tenantCode) {
		try {
			filter.tenant_code = tenantCode
			const [rowsUpdated, [updatedReportType]] = await ReportType.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedReportType
		} catch (error) {
			return error
		}
	}

	static async deleteReportType(id, tenantCode) {
		try {
			const deletedRows = await ReportType.destroy({
				where: { id, tenant_code: tenantCode },
			})
			return deletedRows // Soft delete (paranoid enabled)
		} catch (error) {
			return error
		}
	}
}
