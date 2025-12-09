const common = require('@constants/common')
const reportmappingService = require('@services/report-mapping')

module.exports = class ReportMapping {
	async create(req) {
		try {
			const createReport = await reportmappingService.createMapping(req.body)
			return createReport
		} catch (error) {
			return error
		}
	}

	async read(req) {
		try {
			const getReportMapping = await reportmappingService.getMapping(req.query.code)
			return getReportMapping
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const filter = { id: req.query.id }
			const updatedReportMapping = await reportmappingService.updateMapping(filter, req.body)
			return updatedReportMapping
		} catch (error) {
			return error
		}
	}

	async delete(req) {
		try {
			const deleteReportMapping = await reportmappingService.deleteMapping(req.query.id)
			return deleteReportMapping
		} catch (error) {
			return error
		}
	}
}
