const ReportType = require('@database/models/index').ReportType

module.exports = class ReportTypeQueries {
	static async createReportType(data) {
		try {
			return await ReportType.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findReportTypeByTitle(title) {
		try {
			const reportType = await ReportType.findByPk(title)
			return reportType
		} catch (error) {
			throw error
		}
	}

	static async updateReportType(filter, updateData) {
		try {
			const [rowsUpdated, [updatedReportType]] = await ReportType.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedReportType
		} catch (error) {
			throw error
		}
	}

	static async deleteReportType(id) {
		try {
			const deletedRows = await ReportType.destroy({
				where: { id: id },
			})
			return deletedRows // Soft delete (paranoid enabled)
		} catch (error) {
			throw error
		}
	}
}
