const organizationService = require('@services/organization')

module.exports = class Organization {
	async update(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code

			return await organizationService.update(req.body, req.decodedToken, tenantCode)
		} catch (error) {
			return error
		}
	}

	async eventListener(req) {
		try {
			console.log('CONTROLLER REQUEST BODY: ', req.body)
			// Note: eventListener is a webhook handler - may not have JWT token/tenant context
			const tenantCode = req.decodedToken?.tenant_code
			return await organizationService.createOrgExtension(req.body, tenantCode)
		} catch (error) {
			throw error
		}
	}
}
