/**
 * name : resources.js
 * author : Rakesh
 * created-date : 10-April-2025
 * Description : Resource Controller.
 */

// Dependencies
const resourcesService = require('@services/resources')

module.exports = class Resources {
	/**
	 * delete resource
	 * @method
	 * @name delete
	 * @param {Object} req -request data.
	 * @returns {JSON} - resource object.
	 */

	async delete(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const deletedResource = await resourcesService.deleteResource(
				req.params.id,
				req.query.sessionId,
				userId,
				organizationCode,
				tenantCode
			)
			return deletedResource
		} catch (error) {
			return error
		}
	}
}
