const common = require('@constants/common')
const reportTypeService = require('@services/report-type')

module.exports = class ReportType {
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const createReport = await reportTypeService.createReportType(req.body, organizationCode, tenantCode)
			return createReport
		} catch (error) {
			return error
		}
	}

	async read(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const getReportById = await reportTypeService.getReportType(req.query.title, tenantCode)
			return getReportById
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const filter = { id: req.query.id }
			const updatedReport = await reportTypeService.updateReportType(filter, req.body, tenantCode)
			return updatedReport
		} catch (error) {
			return error
		}
	}

	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const deleteReport = await reportTypeService.deleteReportType(req.query.id, tenantCode)
			return deleteReport
		} catch (error) {
			return error
		}
	}
}
