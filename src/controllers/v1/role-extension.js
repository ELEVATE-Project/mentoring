const common = require('@constants/common')
const roleExtensionService = require('@services/role-extension')

module.exports = class Reports {
	async create(req) {
		try {
			const createReport = await roleExtensionService.createRoleExtension(req.body)
			return createReport
		} catch (error) {
			return error
		}
	}

	async read(req) {
		try {
			const getReportById = await roleExtensionService.roleExtensionDetails(req.query.title)
			return getReportById
		} catch (error) {
			return error
		}
	}

	async update(req) {
		try {
			const updatedReport = await roleExtensionService.updateRoleExtension(req.query.title, req.body)
			return updatedReport
		} catch (error) {
			return error
		}
	}

	async delete(req) {
		try {
			const deleteReport = await roleExtensionService.deleteRoleExtension(req.query.title)
			return deleteReport
		} catch (error) {
			return error
		}
	}
}
