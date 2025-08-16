const ReportType = require('@database/models/index').ReportType

module.exports = class ReportTypeQueries {
	static async createReportType(data, tenantCode) {
		try {
			data.tenant_code = tenantCode
			return await ReportType.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findReportTypeByTitle(Title, tenantCode, options = {}) {
		try {
			const reportType = await ReportType.findAll({
				where: { title: Title, tenant_code: tenantCode },
				...options,
				raw: true,
			})
			return reportType
		} catch (error) {
			throw error
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
			throw error
		}
	}

	static async deleteReportType(id, tenantCode) {
		try {
			const deletedRows = await ReportType.destroy({
				where: { id, tenant_code: tenantCode },
			})
			return deletedRows // Soft delete (paranoid enabled)
		} catch (error) {
			throw error
		}
	}
}
