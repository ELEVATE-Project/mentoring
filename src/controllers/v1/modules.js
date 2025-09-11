const common = require('@constants/common')
const modulesService = require('@services/modules')

module.exports = class modules {
	/**
	 * create modules
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - modules creation object.
	 */

	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const createdModules = await modulesService.create(req.body, userId, organizationCode, tenantCode)
			return createdModules
		} catch (error) {
			return error
		}
	}

	/**
	 * updates modules
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - modules updation response.
	 */

	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const updatedModules = await modulesService.update(
				req.params.id,
				req.body,
				userId,
				organizationCode,
				tenantCode
			)
			return updatedModules
		} catch (error) {
			return error
		}
	}

	/**
	 * Get all available modules
	 * @method
	 * @name list
	 * @param {String} req.pageNo - Page No.
	 * @param {String} req.pageSize - Page size limit.
	 * @param {String} req.searchText - Search text.
	 * @returns {JSON} - modules List.
	 */

	async list(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const modulesDetails = await modulesService.list(
				req.pageNo,
				req.pageSize,
				req.searchText,
				userId,
				organizationCode,
				tenantCode
			)
			return modulesDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * deletes modules
	 * @method
	 * @name delete
	 * @param {Object} req - request data.
	 * @returns {JSON} - modules deletion response.
	 */

	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const modulesDelete = await modulesService.delete(req.params.id, userId, organizationCode, tenantCode)
			return modulesDelete
		} catch (error) {
			return error
		}
	}
}
