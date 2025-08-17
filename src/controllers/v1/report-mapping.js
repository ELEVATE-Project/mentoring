const common = require('@constants/common')
const reportmappingService = require('@services/report-mapping')

module.exports = class ReportMapping {
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const organizationId = req.decodedToken.organization_id
			const userId = req.decodedToken.id
			const createReport = await reportmappingService.createMapping(
				req.body,
				organizationCode,
				organizationId,
				tenantCode
			)
			return createReport
		} catch (error) {
			return error
		}
	}

	async read(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const getReportMapping = await reportmappingService.getMapping(req.query.code, organizationCode, tenantCode)
			return getReportMapping
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const filter = { id: req.query.id }
			const updatedReportMapping = await reportmappingService.updateMapping(filter, req.body, tenantCode)
			return updatedReportMapping
		} catch (error) {
			return error
		}
	}

	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id
			const deleteReportMapping = await reportmappingService.deleteMapping(
				req.query.id,
				userId,
				organizationCode,
				tenantCode
			)
			return deleteReportMapping
		} catch (error) {
			return error
		}
	}
}
