'use strict'

const userRequests = require('@requests/user')

/**
 * Retrieves the default organization ID.
 * First checks environment variable, else fetches from org service.
 * @returns {Promise<string|null>} Default organization ID or null if not found.
 */
exports.getDefaultOrgId = async () => {
	try {
		const { DEFAULT_ORG_ID, DEFAULT_ORG_CODE, DEFAULT_ORGANISATION_CODE } = process.env
		if (DEFAULT_ORG_ID) {
			return DEFAULT_ORG_ID
		}

		const { success, data } = await userRequests.fetchOrgDetails({
			organizationCode: DEFAULT_ORG_CODE || DEFAULT_ORGANISATION_CODE,
		})

		return success && data?.result?.id ? data.result.id.toString() : null
	} catch (err) {
		console.error('Error in getDefaultOrgId:', err)
		return null
	}
}

/**
 * Retrieves the default organization code.
 * @returns {Promise<string|null>} Default organization code or null if not found.
 */
exports.getDefaults = async () => {
	try {
		const { DEFAULT_ORG_CODE, DEFAULT_ORGANISATION_CODE, DEFAULT_TENANT_CODE } = process.env
		if (DEFAULT_ORG_CODE) {
			return (orgCode = DEFAULT_ORG_CODE), (tenantCode = DEFAULT_TENANT_CODE)
		}

		const { success, data } = await userRequests.fetchOrgDetails({
			organizationCode: DEFAULT_ORG_CODE || DEFAULT_ORGANISATION_CODE,
		})

		return (orgcode = success && data?.result?.code), (tenantCode = data?.result?.tenant_code)
	} catch (err) {
		console.error('Error in getDefaultOrgCode:', err)
		return null
	}
}
