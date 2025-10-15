const formQueries = require('../database/queries/form')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const cacheHelper = require('@generics/cacheHelper')
const common = require('@constants/common')

async function getAllFormsVersion(tenantCode, orgCode) {
	try {
		if (!tenantCode || !orgCode) {
			// Add safety check for getDefaults function
			if (typeof getDefaults !== 'function') {
				console.error('getDefaults is not a function - falling back to environment variables')
				tenantCode = tenantCode || process.env.DEFAULT_TENANT_CODE
				orgCode = orgCode || process.env.DEFAULT_ORGANISATION_CODE
			} else {
				const defaults = await getDefaults()
				tenantCode = tenantCode || defaults?.tenantCode
				orgCode = orgCode || defaults?.orgCode
			}
		}

		// Additional safety check - if we still don't have required parameters, return empty result
		if (!tenantCode || !orgCode) {
			console.warn('getAllFormsVersion: Missing tenantCode or orgCode, returning empty result')
			return []
		}

		let formVersions
		try {
			formVersions = await cacheHelper.getOrSet({
				tenantCode,
				orgCode: orgCode,
				ns: common.CACHE_CONFIG.namespaces.forms.name,
				id: 'all_type_versions',
				fetchFn: async () => {
					return await formQueries.findAllTypeFormVersion(tenantCode, orgCode)
				},
			})
		} catch (cacheError) {
			console.warn('Cache system failed for form versions, falling back to database:', cacheError.message)
			try {
				formVersions = await formQueries.findAllTypeFormVersion(tenantCode, orgCode)
			} catch (dbError) {
				console.error('Database query also failed:', dbError.message)
				return []
			}
		}
		return formVersions || []
	} catch (error) {
		console.error(error)
	}
}
module.exports = { getAllFormsVersion }
