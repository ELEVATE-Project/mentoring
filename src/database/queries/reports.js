const Report = require('@database/models/index').Report

module.exports = class ReportQueries {
	static async createReport(data) {
		try {
			return await Report.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findReportById(title) {
		try {
			return await Report.findByPk(title)
		} catch (error) {
			throw error
		}
	}

	static async updateReport(filter, updateData) {
		try {
			const [rowsUpdated, [updatedReport]] = await Report.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedReport
		} catch (error) {
			throw error
		}
	}

	static async deleteReportById(id) {
		try {
			const deletedRows = await Report.destroy({
				where: { id: id },
			})
			return deletedRows
		} catch (error) {
			throw error
		}
	}

	static async findReportByCode(code) {
		try {
			return await Report.findOne({
				where: { code: code },
			})
		} catch (error) {
			throw error
		}
	}

	static async findReport(filter) {
		try {
			return await Report.findAll({
				where: filter,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}
}
