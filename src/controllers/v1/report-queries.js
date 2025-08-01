const common = require('@constants/common')
const reportQueryService = require('@services/report-queries')

module.exports = class ReportQuery {
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const userId = req.decodedToken.id
			const createReportQuery = await reportQueryService.createQuery(req.body, userId, organizationId, tenantCode)
			return createReportQuery
		} catch (error) {
			return error
		}
	}

	async read(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const getReportQuery = await reportQueryService.getQuery(req.query.code, organizationId, tenantCode)
			return getReportQuery
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const userId = req.decodedToken.id
			const updatedReportQuery = await reportQueryService.updateQuery(
				req.query.code,
				req.body,
				userId,
				organizationId,
				tenantCode
			)
			return updatedReportQuery
		} catch (error) {
			return error
		}
	}

	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id
			const userId = req.decodedToken.id
			const deleteReportQuery = await reportQueryService.deleteQuery(
				req.query.id,
				userId,
				organizationId,
				tenantCode
			)
			return deleteReportQuery
		} catch (error) {
			return error
		}
	}
}
