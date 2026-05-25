'use strict'

/**
 * Retrieves the default organization code.
 * @returns {Promise<string|null>} Default organization code or null if not found.
 */
exports.getDefaults = async () => {
	try {
		const { DEFAULT_ORGANISATION_CODE, DEFAULT_TENANT_CODE } = process.env
		if (DEFAULT_ORGANISATION_CODE && DEFAULT_TENANT_CODE) {
			return {
				orgCode: DEFAULT_ORGANISATION_CODE,
				tenantCode: DEFAULT_TENANT_CODE,
			}
		}
	} catch (err) {
		console.error('Error in getDefaults:', err)
		return null
	}
}
