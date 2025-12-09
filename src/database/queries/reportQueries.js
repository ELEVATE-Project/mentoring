const ReportQuery = require('@database/models/index').ReportQuery

module.exports = class ReportQueryServiceQueries {
	static async createReportQuery(data) {
		try {
			return await ReportQuery.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findReportQueryById(id) {
		try {
			return await ReportQuery.findByPk(id)
		} catch (error) {
			throw error
		}
	}

	static async findAllReportQueries(filter, attributes, options = {}) {
		try {
			const reportQueries = await ReportQuery.findAndCountAll({
				where: filter,
				attributes,
				...options,
			})
			return reportQueries
		} catch (error) {
			throw error
		}
	}

	static async updateReportQueries(filter, updateData) {
		try {
			const [rowsUpdated, [updatedReportQuery]] = await ReportQuery.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedReportQuery
		} catch (error) {
			throw error
		}
	}

	static async deleteReportQueryById(id) {
		try {
			const deletedRows = await ReportQuery.destroy({
				where: { id },
			})
			return deletedRows
		} catch (error) {
			throw error
		}
	}

	static async findReportQueryByCode(code) {
		try {
			return await ReportQuery.findOne({
				where: { report_code: code },
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async findReportQueries(filter) {
		try {
			return await ReportQuery.findAll({
				where: filter,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}
}
