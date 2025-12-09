const ReportRoleMapping = require('@database/models/index').ReportRoleMapping

module.exports = class ReportRoleMappingQueries {
	static async createReportRoleMapping(data) {
		try {
			return await ReportRoleMapping.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findAllReportRoleMappings(filter, attributes, options = {}) {
		try {
			const reportRoleMappings = await ReportRoleMapping.findAndCountAll({
				where: filter,
				attributes,
				...options,
			})
			return reportRoleMappings
		} catch (error) {
			throw error
		}
	}

	static async updateReportRoleMappings(filter, updateData) {
		try {
			const [rowsUpdated, [updatedReportRoleMapping]] = await ReportRoleMapping.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedReportRoleMapping
		} catch (error) {
			throw error
		}
	}

	static async deleteReportRoleMappingById(id) {
		try {
			const deletedRows = await ReportRoleMapping.destroy({
				where: { id },
			})
			return deletedRows
		} catch (error) {
			throw error
		}
	}

	static async findReportRoleMappingByReportCode(reportCode) {
		try {
			return await ReportRoleMapping.findOne({
				where: { report_code: reportCode },
			})
		} catch (error) {
			throw error
		}
	}
}
