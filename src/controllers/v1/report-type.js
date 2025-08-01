const common = require('@constants/common')
const reportTypeService = require('@services/report-type')

module.exports = class ReportType {
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const userId = req.decodedToken.id
			const createReport = await reportTypeService.createReportType(req.body, userId, organizationId, tenantCode)
			return createReport
		} catch (error) {
			return error
		}
	}

	async read(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const getReportById = await reportTypeService.getReportType(req.query.title, organizationId, tenantCode)
			return getReportById
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const userId = req.decodedToken.id
			const filter = { id: req.query.id }
			const updatedReport = await reportTypeService.updateReportType(
				filter,
				req.body,
				userId,
				organizationId,
				tenantCode
			)
			return updatedReport
		} catch (error) {
			return error
		}
	}

	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const userId = req.decodedToken.id
			const deleteReport = await reportTypeService.deleteReportType(
				req.query.id,
				userId,
				organizationId,
				tenantCode
			)
			return deleteReport
		} catch (error) {
			return error
		}
	}
}
