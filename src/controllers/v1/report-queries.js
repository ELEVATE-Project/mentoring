const common = require('@constants/common')
const reportQueryService = require('@services/report-queries')

module.exports = class ReportQuery {
	async create(req) {
		try {
			const createReportQuery = await reportQueryService.createQuery(req.body)
			return createReportQuery
		} catch (error) {
			return error
		}
	}

	async read(req) {
		try {
			const getReportQuery = await reportQueryService.getQuery(req.query.code)
			return getReportQuery
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const updatedReportQuery = await reportQueryService.updateQuery(req.query.code, req.body)
			return updatedReportQuery
		} catch (error) {
			return error
		}
	}

	async delete(req) {
		try {
			const deleteReportQuery = await reportQueryService.deleteQuery(req.query.id)
			return deleteReportQuery
		} catch (error) {
			return error
		}
	}
}
