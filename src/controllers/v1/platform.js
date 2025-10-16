const platformService = require('@services/platform')

module.exports = class Config {
	/**
	 * Get app related config details
	 * @method
	 * @name getConfig
	 * @returns {JSON} - returns success response.
	 */

	async config(req) {
		try {
			const tenantCode = req.decodedToken ? req.decodedToken.tenant_code : process.env.DEFAULT_TENANT_CODE
			const config = await platformService.getConfig(tenantCode)
			return config
		} catch (error) {
			return error
		}
	}
}
