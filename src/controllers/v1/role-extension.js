const common = require('@constants/common')
const roleExtensionService = require('@services/role-extension')

module.exports = class Reports {
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const createReport = await roleExtensionService.createRoleExtension(
				req.body,
				userId,
				organizationCode,
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
			const userId = req.decodedToken.id

			const getReportById = await roleExtensionService.roleExtensionDetails(
				req.query.title,
				userId,
				organizationCode,
				tenantCode
			)
			return getReportById
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const updatedReport = await roleExtensionService.updateRoleExtension(
				req.query.title,
				req.body,
				userId,
				organizationCode,
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
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const deleteReport = await roleExtensionService.deleteRoleExtension(
				req.query.title,
				userId,
				organizationCode,
				tenantCode
			)
			return deleteReport
		} catch (error) {
			return error
		}
	}
}
