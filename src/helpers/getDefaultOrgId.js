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
exports.getDefaultOrgCode = async () => {
	try {
		const { DEFAULT_ORG_CODE, DEFAULT_ORGANISATION_CODE } = process.env
		return DEFAULT_ORG_CODE || DEFAULT_ORGANISATION_CODE || null
	} catch (err) {
		console.error('Error in getDefaultOrgCode:', err)
		return null
	}
}
